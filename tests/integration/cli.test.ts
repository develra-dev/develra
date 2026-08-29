import { execFile, execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import os from "node:os";
import nodePath from "node:path";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const execute = promisify(execFile);
const roots: string[] = [];
const cli = nodePath.resolve("apps/cli/dist/index.js");

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("Loopback registry did not expose a TCP address.");
  return `http://127.0.0.1:${address.port}`;
}

beforeAll(() => {
  const pnpmEntry = process.env.npm_execpath;
  const command = pnpmEntry
    ? process.execPath
    : process.platform === "win32"
      ? "pnpm.cmd"
      : "pnpm";
  const args = pnpmEntry ? [pnpmEntry, "build"] : ["build"];
  execFileSync(command, args, {
    cwd: nodePath.resolve("."),
    stdio: "pipe",
    shell: !pnpmEntry && process.platform === "win32",
  });
}, 120_000);

afterAll(async () => {
  await Promise.all(
    roots.map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function copyFixture(name: string): Promise<string> {
  const root = await mkdtemp(nodePath.join(os.tmpdir(), "develra-cli-"));
  roots.push(root);
  await cp(nodePath.resolve("fixtures/repositories", name), root, {
    recursive: true,
  });
  return root;
}

describe("packaged CLI", () => {
  it("prints version and planned commands", async () => {
    const metadata = JSON.parse(
      await readFile(nodePath.resolve("apps/cli/package.json"), "utf8"),
    ) as { version: string };
    expect(
      (await execute(process.execPath, [cli, "--version"])).stdout.trim(),
    ).toBe(metadata.version);
    const help = (await execute(process.execPath, [cli, "--help"])).stdout;
    expect(help).toContain("scan");
    expect(help).toContain("check");
    expect(help).toContain("providers");
  });

  it("writes, checks, graphs, and emits machine JSON", async () => {
    const root = await copyFixture("ts-saas");
    await execute(process.execPath, [
      cli,
      "scan",
      root,
      "--report",
      "report.md",
      "--graph",
      "graph.svg",
      "--sarif",
      "develra.sarif",
    ]);
    expect(
      await readFile(nodePath.join(root, "develra.lock"), "utf8"),
    ).toContain("responses.create");
    expect(await readFile(nodePath.join(root, "graph.svg"), "utf8")).toContain(
      "<svg",
    );
    expect(
      (await execute(process.execPath, [cli, "check", root])).stdout,
    ).toContain("inventory is current");
    const machine = await execute(process.execPath, [
      cli,
      "scan",
      root,
      "--no-write",
      "--json",
      "-",
    ]);
    expect(JSON.parse(machine.stdout)).toMatchObject({
      schema_version: 1,
      command: "scan",
      status: "ok",
    });
  });

  it("uses exit 3 for a policy failure and exit 2 for an invalid lockfile", async () => {
    const root = await copyFixture("ts-saas");
    await execute(process.execPath, [cli, "scan", root]);
    await rm(nodePath.join(root, "src", "contracts.ts"));
    await expect(
      execute(process.execPath, [cli, "check", root]),
    ).rejects.toMatchObject({ code: 3 });
    await rm(nodePath.join(root, "develra.lock"));
    await expect(
      execute(process.execPath, [cli, "check", root]),
    ).rejects.toMatchObject({ code: 2 });
  });

  it("uses the registry only when explicitly requested and reports provenance", async () => {
    const root = await copyFixture("ts-saas");
    await execute(process.execPath, [cli, "scan", root]);
    let requests = 0;
    let mode: "empty" | "change" | "unavailable" = "empty";
    const server = createServer((request, response) => {
      requests += 1;
      if (mode === "unavailable") {
        response.writeHead(503, { "content-type": "application/json" });
        response.end("{}");
        return;
      }
      const path = new URL(request.url ?? "/", "http://localhost").pathname;
      const data = path.endsWith("/v1/capabilities")
        ? {
            api_version: "v1",
            data: {
              mode: "remote",
              remote: true,
              provider_state: true,
              changes: true,
            },
          }
        : {
            api_version: "v1",
            data:
              mode === "change"
                ? [
                    {
                      id: "openai-responses-change",
                      provider_id: "openai",
                      observed_at: "2026-08-29T12:00:00Z",
                      severity: "breaking",
                      operations: ["responses.create"],
                      endpoints: [],
                      summary: "The Responses API contract changed.",
                      confidence: "confirmed",
                      provenance: {
                        kind: "remote",
                        source_id: "registry:openai",
                        retrieved_at: "2026-08-29T12:05:00Z",
                        source_url:
                          "https://registry.example.test/sources/openai",
                      },
                    },
                  ]
                : [],
            page: { next_cursor: null },
          };
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(data));
    });
    const registryUrl = await listen(server);

    try {
      await execute(process.execPath, [cli, "check", root]);
      expect(requests).toBe(0);

      const empty = await execute(process.execPath, [
        cli,
        "check",
        root,
        "--registry",
        registryUrl,
      ]);
      expect(empty.stdout).toContain(
        "Remote registry: no relevant contract changes.",
      );

      mode = "change";
      const changed = await execute(process.execPath, [
        cli,
        "check",
        root,
        "--registry",
        registryUrl,
        "--json",
        "-",
      ]);
      expect(changed.stderr).toContain("relevant contract changes");
      expect(JSON.parse(changed.stdout)).toMatchObject({
        result: {
          registry: {
            status: "changes",
            findings: [
              {
                change: {
                  id: "openai-responses-change",
                  provenance: { sourceId: "registry:openai" },
                },
              },
            ],
          },
        },
      });

      mode = "unavailable";
      await expect(
        execute(process.execPath, [
          cli,
          "check",
          root,
          "--registry",
          registryUrl,
        ]),
      ).rejects.toMatchObject({ code: 4 });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
