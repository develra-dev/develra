import type { RegistryCheckResult, ScanResult } from "@develra/core";
import {
  renderDiffMarkdown,
  renderRegistryConsole,
  renderSarif,
} from "@develra/reporters";
import { describe, expect, it } from "vitest";

const scan: ScanResult = {
  project: { root: ".", languages: ["typescript"] },
  providers: [],
  mcp_servers: [],
  unknowns: [],
  diagnostics: [],
  stats: { filesScanned: 1 },
};

const registry: RegistryCheckResult = {
  status: "changes",
  findings: [
    {
      change: {
        id: "openai-responses-change",
        providerId: "openai",
        observedAt: "2026-08-29T12:00:00Z",
        severity: "breaking",
        operations: ["responses.create"],
        endpoints: [],
        summary: "The response contract changed.",
        confidence: "confirmed",
        provenance: {
          kind: "remote",
          sourceId: "registry:openai",
          retrievedAt: "2026-08-29T12:05:00Z",
          sourceUrl: "https://registry.example.test/sources/openai",
        },
      },
      match: "operation",
      strength: "strong",
      matchedOperations: ["responses.create"],
      files: ["src/ai.ts"],
      message: "OpenAI changed responses.create.",
    },
  ],
};

describe("registry reporters", () => {
  it("distinguishes no changes and includes provenance for changes", () => {
    expect(
      renderRegistryConsole({ status: "no_changes", findings: [] }),
    ).toContain("no relevant contract changes");
    expect(renderRegistryConsole(registry)).toContain("registry:openai");

    const markdown = renderDiffMarkdown(
      { changed: false, changes: [] },
      registry,
    );
    expect(markdown).toContain("## Remote registry");
    expect(markdown).toContain("registry:openai");

    const sarif = JSON.parse(
      renderSarif(scan, { changed: false, changes: [] }, registry),
    ) as {
      runs: { results: { ruleId: string; properties: unknown }[] }[];
    };
    expect(sarif.runs[0]?.results[0]).toMatchObject({
      ruleId: "develra/registry-change",
      properties: {
        sourceId: "registry:openai",
        sourceUrl: "https://registry.example.test/sources/openai",
      },
    });
  });
});
