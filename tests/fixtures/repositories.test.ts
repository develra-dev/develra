import { readFile } from "node:fs/promises";
import nodePath from "node:path";

import { scanRepository, serializeLockfile, toLockfile } from "@develra/core";
import { loadBundledProviders } from "@develra/providers";
import { describe, expect, it, vi } from "vitest";

const fixture = (name: string): string =>
  nodePath.resolve("fixtures/repositories", name);

describe("repository fixtures", () => {
  it("finds confirmed, probable-capable, possible, endpoint, and API-version evidence in TypeScript", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network forbidden"));
    const result = await scanRepository({
      root: fixture("ts-saas"),
      catalog: await loadBundledProviders(),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    expect(
      result.providers.map(({ id, confidence }) => ({ id, confidence })),
    ).toEqual([
      { id: "openai", confidence: "confirmed" },
      { id: "slack", confidence: "possible" },
      { id: "stripe", confidence: "confirmed" },
    ]);
    expect(
      result.providers.find((item) => item.id === "stripe")?.api_versions,
    ).toEqual(["2025-04-30"]);
    expect(
      result.providers
        .find((item) => item.id === "stripe")
        ?.endpoints.map(({ method, host, path }) => ({ method, host, path })),
    ).toContainEqual({
      method: "POST",
      host: "api.stripe.com",
      path: "/v1/payment_intents",
    });
    expect(result.unknowns).toEqual([
      {
        kind: "host",
        value: "api.example-analytics.com",
        confidence: "possible",
        files: ["src/contracts.ts"],
      },
      {
        kind: "host",
        value: "hooks.partner-events.com",
        confidence: "possible",
        files: ["src/endpoints.ts"],
      },
    ]);
    expect(serializeLockfile(toLockfile(result))).not.toContain(
      "never-serialize",
    );
  });

  it("uses a syntax parser and binding-aware matching for Python", async () => {
    const result = await scanRepository({
      root: fixture("python-service"),
      catalog: await loadBundledProviders(),
    });
    expect(result.providers).toMatchObject([
      {
        id: "anthropic",
        confidence: "confirmed",
        packages: [
          {
            ecosystem: "pypi",
            name: "anthropic",
            version: "0.68.0",
            direct: true,
          },
        ],
        operations: [{ id: "messages.create", confidence: "confirmed" }],
      },
    ]);
    expect(result.unknowns).toEqual([
      {
        kind: "host",
        value: "hooks.example-events.com",
        confidence: "possible",
        files: ["app/main.py"],
      },
    ]);
  });

  it("parses MCP configuration without retaining secrets", async () => {
    const result = await scanRepository({
      root: fixture("mcp-project"),
      catalog: await loadBundledProviders(),
    });
    const lock = serializeLockfile(toLockfile(result));
    expect(result.mcp_servers).toHaveLength(2);
    expect(lock).not.toMatch(/never-serialize|authorization|GITHUB_TOKEN/u);
    expect(lock).toContain("url_host: mcp.example-tools.com");
  });

  it("produces identical bytes across repeated scans", async () => {
    const catalog = await loadBundledProviders();
    const first = serializeLockfile(
      toLockfile(await scanRepository({ root: fixture("ts-saas"), catalog })),
    );
    const second = serializeLockfile(
      toLockfile(await scanRepository({ root: fixture("ts-saas"), catalog })),
    );
    expect(first).toBe(second);
    expect(first).toBe(
      await readFile(
        nodePath.resolve("fixtures/expected/ts-saas.lock"),
        "utf8",
      ),
    );
  });
});
