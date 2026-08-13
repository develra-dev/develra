import { createHash } from "node:crypto";

import type {
  Confidence,
  Diagnostic,
  InventoryChange,
  LockfileDiff,
  LockfileDocument,
  ProviderFinding,
  ScanResult,
} from "@develra/core";

const SCORE: Readonly<Record<Confidence, number>> = {
  possible: 0,
  probable: 1,
  confirmed: 2,
};

function visible(confidence: Confidence, minimum: Confidence): boolean {
  return SCORE[confidence] >= SCORE[minimum];
}

function displayId(id: string): string {
  const canonicalNames: Readonly<Record<string, string>> = {
    github: "GitHub",
    openai: "OpenAI",
  };
  if (canonicalNames[id]) return canonicalNames[id];
  return id
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function renderConsole(
  result: ScanResult,
  minimum: Confidence = "possible",
): string {
  const providers = result.providers.filter((provider) =>
    visible(provider.confidence, minimum),
  );
  const unknowns = result.unknowns.filter((unknown) =>
    visible(unknown.confidence, minimum),
  );
  const lines = [
    `Develra scanned ${result.stats.filesScanned} file${result.stats.filesScanned === 1 ? "" : "s"}`,
    "",
    `External contracts: ${providers.length + result.mcp_servers.length + unknowns.length}`,
    "",
  ];
  for (const provider of providers) {
    lines.push(
      `${provider.confidence.toUpperCase().padEnd(10)} ${displayId(provider.id)}`,
    );
    for (const packageRef of provider.packages) {
      lines.push(
        `           package ${packageRef.name}${packageRef.version ? `@${packageRef.version}` : ""}`,
      );
    }
    for (const operation of provider.operations)
      lines.push(`           operation ${operation.id}`);
    if (provider.evidenceKinds?.includes("import"))
      lines.push("           evidence package import");
    if (provider.files.length > 0)
      lines.push(`           files ${provider.files.join(", ")}`);
    if (
      provider.confidence === "possible" &&
      provider.operations.length === 0
    ) {
      lines.push("           no import plus operation evidence");
    }
    lines.push("");
  }
  for (const server of result.mcp_servers) {
    lines.push(`CONFIRMED  MCP ${server.id}`);
    lines.push(
      `           ${server.transport} configured in ${server.config_files.join(", ")}`,
    );
    lines.push("");
  }
  for (const unknown of unknowns) {
    lines.push(`UNKNOWN    ${unknown.value}`);
    lines.push(`           ${unknown.kind} in ${unknown.files.join(", ")}`);
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function changeSign(type: InventoryChange["type"]): string {
  return type === "added" ? "+" : type === "removed" ? "-" : "~";
}

export function renderDiffConsole(diff: LockfileDiff): string {
  if (!diff.changed) return "External contract inventory is current.\n";
  const lines = ["External contract inventory changed", ""];
  for (const change of diff.changes) {
    lines.push(
      `${changeSign(change.type)} ${change.confidence.toUpperCase()} ${change.providerId ? `${change.providerId}.` : ""}${change.key}`,
    );
    if (change.before || change.after)
      lines.push(
        `  ${change.before ?? "(none)"} → ${change.after ?? "(none)"}`,
      );
    if (change.files.length > 0) lines.push(`  ${change.files.join(", ")}`);
  }
  lines.push("", "Run `develra scan` and review develra.lock.");
  return `${lines.join("\n")}\n`;
}

export interface JsonEnvelope {
  readonly schema_version: 1;
  readonly command: "scan" | "check";
  readonly status: "ok" | "changed" | "error";
  readonly result: unknown;
  readonly diagnostics: readonly Diagnostic[];
}

export function renderJson(envelope: JsonEnvelope): string {
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

function markdownText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll("\r", " ")
    .replaceAll("\n", " ");
}

function markdownCode(value: string): string {
  return `\`${markdownText(value).replaceAll("`", "\\`")}\``;
}

function providerReason(provider: ProviderFinding): string {
  const reasons: string[] = [];
  if (provider.packages.length) reasons.push("package");
  for (const kind of provider.evidenceKinds ?? [])
    if (!reasons.includes(kind)) reasons.push(kind);
  if (provider.operations.length) reasons.push("operation");
  if (provider.endpoints.length) reasons.push("endpoint");
  return reasons.join(", ") || "normalized evidence";
}

export function renderMarkdown(
  result: ScanResult,
  title = "Develra external-contract inventory",
): string {
  const lines = [
    `# ${markdownText(title)}`,
    "",
    `Scanned **${result.stats.filesScanned}** files. Found **${result.providers.length}** recognized providers, **${result.mcp_servers.length}** MCP servers, and **${result.unknowns.length}** unknown external signals.`,
    "",
    "## Providers",
    "",
  ];
  if (result.providers.length === 0) lines.push("No recognized providers.", "");
  else {
    lines.push("| Confidence | Provider | Why | Files |", "|---|---|---|---|");
    for (const provider of result.providers) {
      lines.push(
        `| ${provider.confidence} | ${markdownCode(provider.id)} | ${markdownText(providerReason(provider))} | ${provider.files.map(markdownCode).join(", ")} |`,
      );
    }
    lines.push("");
    for (const provider of result.providers) {
      lines.push(`### ${markdownCode(provider.id)}`, "");
      if (provider.packages.length) {
        lines.push(
          `Packages: ${provider.packages.map((item) => markdownCode(`${item.name}${item.version ? `@${item.version}` : ""}`)).join(", ")}`,
          "",
        );
      }
      if (provider.operations.length) {
        lines.push("Operations:", "");
        for (const operation of provider.operations) {
          lines.push(
            `- ${markdownCode(operation.id)} — ${operation.confidence}; ${operation.files.map(markdownCode).join(", ")}`,
          );
        }
        lines.push("");
      }
      if (provider.endpoints.length) {
        lines.push("Endpoints:", "");
        for (const endpoint of provider.endpoints) {
          lines.push(
            `- ${markdownCode(`${endpoint.method} ${endpoint.host ?? ""}${endpoint.path}`)} — ${endpoint.confidence}`,
          );
        }
        lines.push("");
      }
    }
  }
  lines.push("## MCP servers", "");
  if (result.mcp_servers.length === 0)
    lines.push("No project-level MCP server configuration found.", "");
  else {
    for (const server of result.mcp_servers) {
      lines.push(
        `- ${markdownCode(server.id)} — ${server.transport}, configured in ${server.config_files.map(markdownCode).join(", ")}`,
      );
    }
    lines.push("");
  }
  lines.push("## Unknown signals", "");
  if (result.unknowns.length === 0)
    lines.push("No unknown external signals.", "");
  else
    for (const unknown of result.unknowns)
      lines.push(
        `- ${unknown.kind} ${markdownCode(unknown.value)} — ${unknown.files.map(markdownCode).join(", ")}`,
      );
  if (result.diagnostics.length) {
    lines.push("", "## Diagnostics", "");
    for (const diagnostic of result.diagnostics) {
      lines.push(
        `- **${diagnostic.severity}** ${markdownCode(diagnostic.code)}${diagnostic.file ? ` in ${markdownCode(diagnostic.file)}` : ""}: ${markdownText(diagnostic.message)}`,
      );
    }
  }
  lines.push(
    "",
    "_Generated locally by Develra. No source code was uploaded._",
    "",
  );
  return lines.join("\n");
}

export function renderDiffMarkdown(diff: LockfileDiff): string {
  const lines = ["# Develra external-contract check", ""];
  if (!diff.changed)
    return `${lines.join("\n")}**Status:** Inventory is current.\n`;
  lines.push(
    "**Status:** Contract inventory changed",
    "",
    "| Change | Contract | Confidence | Evidence |",
    "|---|---|---|---|",
  );
  for (const change of diff.changes) {
    lines.push(
      `| ${change.type} ${change.kind} | ${markdownCode(`${change.providerId ? `${change.providerId}.` : ""}${change.key}`)} | ${change.confidence} | ${change.files.map(markdownCode).join(", ")} |`,
    );
  }
  lines.push(
    "",
    "Run `npx develra scan` locally and review `develra.lock`.",
    "",
  );
  return lines.join("\n");
}

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export interface GraphOptions {
  readonly title?: string;
  readonly includeUnknowns?: boolean;
  readonly minimumConfidence?: Confidence;
}

export function renderSvg(
  lockfile: LockfileDocument,
  options: GraphOptions = {},
): string {
  const minimum = options.minimumConfidence ?? "possible";
  const providers = lockfile.providers.filter((provider) =>
    visible(provider.confidence, minimum),
  );
  const unknowns = options.includeUnknowns
    ? lockfile.unknowns.filter((item) => visible(item.confidence, minimum))
    : [];
  const nodes = [
    ...providers.map((provider) => ({
      id: provider.id,
      confidence: provider.confidence,
      detail: `${provider.operations.length} operations`,
    })),
    ...lockfile.mcp_servers.map((server) => ({
      id: `MCP: ${server.id}`,
      confidence: server.confidence,
      detail: server.transport,
    })),
    ...unknowns.map((item) => ({
      id: item.value,
      confidence: item.confidence,
      detail: `unknown ${item.kind}`,
    })),
  ];
  const width = 900;
  const rowHeight = 82;
  const height = Math.max(260, 150 + nodes.length * rowHeight);
  const centerY = Math.round(height / 2);
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`,
    `<title id="title">${xml(options.title ?? "External contract map")}</title>`,
    '<desc id="desc">A deterministic graph of repository external contracts generated by Develra.</desc>',
    "<style>",
    ":root{color-scheme:light dark}.bg{fill:#fff}.text{fill:#18181b;font:14px ui-monospace,SFMono-Regular,Consolas,monospace}.muted{fill:#52525b;font:12px system-ui,sans-serif}.edge{stroke:#a1a1aa;stroke-width:1.5}.repo{fill:#6d28d9;stroke:#4c1d95;stroke-width:2}.confirmed{fill:#dcfce7;stroke:#166534}.probable{fill:#fef3c7;stroke:#92400e;stroke-dasharray:6 3}.possible{fill:#f4f4f5;stroke:#52525b;stroke-dasharray:2 3}@media(prefers-color-scheme:dark){.bg{fill:#09090b}.text{fill:#fafafa}.muted{fill:#a1a1aa}.repo{fill:#7c3aed}.confirmed{fill:#14532d;stroke:#86efac}.probable{fill:#713f12;stroke:#fde68a}.possible{fill:#27272a;stroke:#d4d4d8}}",
    "</style>",
    `<rect class="bg" width="${width}" height="${height}" rx="16"/>`,
    `<text class="text" x="32" y="38" font-size="20">${xml(options.title ?? "External contract map")}</text>`,
    `<rect class="repo" x="64" y="${centerY - 38}" width="240" height="76" rx="12"/>`,
    `<text x="184" y="${centerY - 4}" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif" font-weight="700">Repository</text>`,
    `<text x="184" y="${centerY + 18}" text-anchor="middle" fill="#ede9fe" font-family="system-ui,sans-serif" font-size="12">${nodes.length} external contracts</text>`,
  ];
  nodes.forEach((node, index) => {
    const y = 76 + index * rowHeight;
    lines.push(
      `<line class="edge" x1="304" y1="${centerY}" x2="430" y2="${y + 29}"/>`,
    );
    lines.push(
      `<rect class="${node.confidence}" x="430" y="${y}" width="410" height="58" rx="10" stroke-width="2"/>`,
    );
    lines.push(
      `<text class="text" x="450" y="${y + 24}">${xml(node.id)}</text>`,
    );
    lines.push(
      `<text class="muted" x="450" y="${y + 43}">${xml(`${node.confidence} · ${node.detail}`)}</text>`,
    );
  });
  lines.push(
    `<text class="muted" x="${width - 28}" y="${height - 20}" text-anchor="end">Generated by Develra · develra.dev</text>`,
    "</svg>",
    "",
  );
  return lines.join("\n");
}

function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sarifLevel(confidence: Confidence): "error" | "warning" | "note" {
  return confidence === "confirmed"
    ? "error"
    : confidence === "probable"
      ? "warning"
      : "note";
}

export function renderSarif(result: ScanResult, diff?: LockfileDiff): string {
  const changes: readonly InventoryChange[] =
    diff?.changes ??
    result.providers.map(
      (provider) =>
        ({
          type: "added",
          kind: "provider",
          key: provider.id,
          confidence: provider.confidence,
          files: provider.files,
        }) satisfies InventoryChange,
    );
  const bounded = changes.slice(0, 1000);
  const rules = [
    ...new Set(
      bounded.map((change) => `develra/${change.kind}-${change.type}`),
    ),
  ].sort();
  const sarif = {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "Develra",
            informationUri: "https://develra.dev",
            rules: rules.map((id) => ({
              id,
              shortDescription: {
                text: id.replace("develra/", "External contract "),
              },
            })),
          },
        },
        results: bounded.map((change) => ({
          ruleId: `develra/${change.kind}-${change.type}`,
          level: sarifLevel(change.confidence),
          message: {
            text: `${change.type} ${change.kind}: ${change.providerId ? `${change.providerId}.` : ""}${change.key}`,
          },
          ...(change.files[0]
            ? {
                locations: [
                  {
                    physicalLocation: {
                      artifactLocation: {
                        uri: change.files[0],
                        uriBaseId: "%SRCROOT%",
                      },
                    },
                  },
                ],
              }
            : {}),
          partialFingerprints: {
            primaryLocationLineHash: fingerprint(
              `${change.type}:${change.kind}:${change.providerId ?? ""}:${change.key}`,
            ),
          },
        })),
      },
    ],
  };
  return `${JSON.stringify(sarif, null, 2)}\n`;
}
