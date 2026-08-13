import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import nodePath from "node:path";

import {
  DevelraError,
  diffLockfiles,
  discoverFiles,
  evaluatePolicy,
  normalizeRelativePath,
  parseLockfile,
  parseMcpConfig,
  parseNpmManifest,
  parseYamlUnique,
  resolveReadableInsideRoot,
  scanJavascriptSource,
  serializeLockfile,
  toLockfile,
  validateConfig,
  writeLockfileAtomic,
  type LockfileDocument,
  type ScanResult,
} from "@develra/core";
import { loadBundledProviders, validateProviderPath } from "@develra/providers";
import { renderMarkdown, renderSvg } from "@develra/reporters";
import { afterEach, describe, expect, it } from "vitest";

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(nodePath.join(os.tmpdir(), "develra-unit-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("path safety", () => {
  it("normalizes Windows separators and rejects escapes", () => {
    expect(normalizeRelativePath("src\\client.ts")).toBe("src/client.ts");
    expect(() => normalizeRelativePath("../secret.env")).toThrow(DevelraError);
    expect(() => normalizeRelativePath("C:\\secret.env")).toThrow(DevelraError);
  });

  it("does not follow symlinks outside the root", async () => {
    const root = await temporaryRoot();
    const outside = await temporaryRoot();
    await writeFile(nodePath.join(outside, "outside.ts"), "export {};", "utf8");
    await symlink(
      nodePath.join(outside, "outside.ts"),
      nodePath.join(root, "escape.ts"),
    );
    const result = await discoverFiles({ root });
    expect(result.files).toEqual([]);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      "DVL_PATH_SYMLINK_ESCAPE",
    );
  });

  it("honors ignore files and size limits before reads", async () => {
    const root = await temporaryRoot();
    await mkdir(nodePath.join(root, "ignored"));
    await writeFile(
      nodePath.join(root, ".develraignore"),
      "ignored/\n",
      "utf8",
    );
    await writeFile(
      nodePath.join(root, "ignored", "client.ts"),
      "export {};",
      "utf8",
    );
    await writeFile(nodePath.join(root, "huge.ts"), "x".repeat(2048), "utf8");
    const result = await discoverFiles({ root, maxFileSize: 1024 });
    expect(result.files.map((item) => item.relativePath)).toEqual([
      ".develraignore",
    ]);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      "DVL_SCAN_FILE_TOO_LARGE",
    );
  });

  it("rejects writes through a directory symlink outside the root", async () => {
    const root = await temporaryRoot();
    const outside = await temporaryRoot();
    await symlink(outside, nodePath.join(root, "reports"));
    await expect(
      writeLockfileAtomic(root, "reports/develra.lock", "version: 1\n"),
    ).rejects.toMatchObject({
      diagnosticCode: "DVL_PATH_SYMLINK_ESCAPE",
    });
    await expect(
      readFile(nodePath.join(outside, "develra.lock"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects explicit reads through a symlink outside the root", async () => {
    const root = await temporaryRoot();
    const outside = await temporaryRoot();
    const outsideConfig = nodePath.join(outside, "develra.config.yaml");
    await writeFile(outsideConfig, "version: 1\n", "utf8");
    await symlink(outsideConfig, nodePath.join(root, "develra.config.yaml"));
    await expect(
      resolveReadableInsideRoot(root, "develra.config.yaml"),
    ).rejects.toMatchObject({
      diagnosticCode: "DVL_PATH_SYMLINK_ESCAPE",
    });
  });
});

describe("parsers and detection", () => {
  it("rejects duplicate JSON keys without executing scripts", () => {
    const parsed = parseNpmManifest(
      '{"dependencies":{"openai":"1"},"dependencies":{"stripe":"1"}}',
      "package.json",
    );
    expect(parsed.evidence).toEqual([]);
    expect(parsed.diagnostics[0]?.code).toBe("DVL_PARSE_PACKAGE_JSON");
  });

  it("requires a trustworthy import binding for operations", async () => {
    const catalog = await loadBundledProviders();
    const positive = scanJavascriptSource(
      'import OpenAI from "openai"; const ai = new OpenAI(); ai.responses.create({});',
      "src/ai.ts",
      "typescript",
      catalog,
    );
    const negative = scanJavascriptSource(
      "const ai = makeUnrelatedClient(); ai.responses.create({});",
      "src/unrelated.ts",
      "typescript",
      catalog,
    );
    expect(
      positive.evidence.some((item) => item.operationId === "responses.create"),
    ).toBe(true);
    expect(
      negative.evidence.some((item) => item.operationId === "responses.create"),
    ).toBe(false);
  });

  it("supports CommonJS destructuring aliases", async () => {
    const catalog = await loadBundledProviders();
    const result = scanJavascriptSource(
      'const { WebClient: Client } = require("@slack/web-api"); const web = new Client(); web.chat.postMessage({});',
      "src/slack.js",
      "javascript",
      catalog,
    );
    expect(
      result.evidence.some((item) => item.operationId === "chat.postMessage"),
    ).toBe(true);
  });

  it("redacts MCP arguments, environment values, URL paths, and queries", () => {
    const secret = "very-secret-token";
    const result = parseMcpConfig(
      JSON.stringify({
        mcpServers: {
          github: {
            command: "/usr/bin/npx",
            args: ["@modelcontextprotocol/server-github", "--token", secret],
            env: { TOKEN: secret },
          },
          remote: { url: `https://mcp.example.com/private?token=${secret}` },
        },
      }),
      ".mcp.json",
    );
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.servers).toMatchObject([
      {
        id: "github",
        command: "npx",
        package: "@modelcontextprotocol/server-github",
      },
      { id: "remote", url_host: "mcp.example.com" },
    ]);
  });
});

function sampleResult(): ScanResult {
  return {
    project: { root: ".", languages: ["typescript"] },
    providers: [
      {
        id: "openai",
        confidence: "confirmed",
        packages: [
          { ecosystem: "npm", name: "openai", version: "5.4.0", direct: true },
        ],
        api_versions: [],
        operations: [
          {
            id: "responses.create",
            confidence: "confirmed",
            files: ["src/ai.ts"],
          },
        ],
        endpoints: [],
        files: ["package.json", "src/ai.ts"],
      },
    ],
    mcp_servers: [],
    unknowns: [],
    diagnostics: [],
    stats: { filesScanned: 2 },
  };
}

describe("lockfile, policy, and reporters", () => {
  it("serializes byte-identically and validates on parse", async () => {
    const lockfile = toLockfile(sampleResult());
    const first = serializeLockfile(lockfile);
    const second = serializeLockfile(lockfile);
    expect(first).toBe(second);
    expect(first).not.toMatch(/generated|timestamp|\/Users\//u);
    expect(await parseLockfile(first)).toEqual(lockfile);
  });

  it("applies confidence thresholds to structural diffs", () => {
    const before = toLockfile(sampleResult());
    const after: LockfileDocument = {
      ...before,
      providers: [
        ...before.providers,
        {
          id: "slack",
          confidence: "possible",
          packages: [],
          api_versions: [],
          operations: [],
          endpoints: [],
          files: ["package.json"],
        },
      ],
    };
    const diff = diffLockfiles(before, after);
    expect(evaluatePolicy(diff, "probable").passed).toBe(true);
    expect(evaluatePolicy(diff, "possible").passed).toBe(false);
  });

  it("escapes Markdown and SVG user-controlled text", () => {
    const result = {
      ...sampleResult(),
      unknowns: [
        {
          kind: "host" as const,
          value: "bad|host<script>",
          confidence: "possible" as const,
          files: ["src/x.ts"],
        },
      ],
    };
    expect(renderMarkdown(result)).toContain("bad\\|host&lt;script&gt;");
    expect(
      renderSvg(toLockfile(result), {
        includeUnknowns: true,
        title: "<script>",
      }),
    ).not.toContain("<script>");
    expect(renderSvg(toLockfile(result), { includeUnknowns: true })).toContain(
      "&lt;script&gt;",
    );
  });

  it("validates the ten bundled provider packs", async () => {
    const catalog = await loadBundledProviders();
    expect(catalog.providers).toHaveLength(10);
    const result = await validateProviderPath(
      nodePath.resolve("packages/providers/data"),
    );
    expect(result.valid).toBe(true);
  });

  it("validates the bundled lockfile, config, and provider examples", async () => {
    await expect(
      parseLockfile(await readFile("examples/develra.lock.yaml", "utf8")),
    ).resolves.toBeDefined();
    const config = parseYamlUnique(
      await readFile("examples/develra.config.yaml", "utf8"),
      "example config",
    );
    await expect(validateConfig(config)).resolves.toBeUndefined();
    const provider = await validateProviderPath(
      nodePath.resolve("examples/stripe.provider.yaml"),
    );
    expect(provider.valid).toBe(true);
  });
});
