import { normalizeRelativePath, sortUnique } from "./path.js";
import type {
  Confidence,
  Diagnostic,
  EndpointFinding,
  Evidence,
  EvidenceKind,
  Language,
  McpServerFinding,
  PackageRef,
  ProviderFinding,
  ScanResult,
  UnknownFinding,
} from "./types.js";

const CONFIDENCE_SCORE: Readonly<Record<Confidence, number>> = {
  possible: 0,
  probable: 1,
  confirmed: 2,
};

export function maxConfidence(values: Iterable<Confidence>): Confidence {
  let result: Confidence = "possible";
  for (const value of values)
    if (CONFIDENCE_SCORE[value] > CONFIDENCE_SCORE[result]) result = value;
  return result;
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizePackageEvidence(items: readonly Evidence[]): PackageRef[] {
  const grouped = new Map<string, Evidence[]>();
  for (const item of items) {
    if (!item.package) continue;
    const key = `${item.package.ecosystem}:${item.package.name}`;
    const existing = grouped.get(key) ?? [];
    existing.push(item);
    grouped.set(key, existing);
  }
  return [...grouped.values()]
    .map((values) => {
      const sorted = [...values].sort((left, right) => {
        const leftScore =
          (left.kind === "lockfile" ? 4 : 0) +
          (left.metadata?.resolved ? 2 : 0) +
          (left.package?.version ? 1 : 0);
        const rightScore =
          (right.kind === "lockfile" ? 4 : 0) +
          (right.metadata?.resolved ? 2 : 0) +
          (right.package?.version ? 1 : 0);
        return (
          rightScore - leftScore ||
          compare(left.relativePath, right.relativePath)
        );
      });
      const selected = sorted[0]?.package;
      if (!selected)
        throw new TypeError("Package evidence unexpectedly missing a package");
      return selected;
    })
    .sort((left, right) =>
      compare(
        `${left.ecosystem}:${left.name}`,
        `${right.ecosystem}:${right.name}`,
      ),
    );
}

function confidenceForProvider(evidence: readonly Evidence[]): Confidence {
  if (
    evidence.some(
      (item) => item.kind === "operation-call" && item.strength === "strong",
    )
  )
    return "confirmed";
  if (
    evidence.some(
      (item) => item.kind === "http-endpoint" && item.strength === "strong",
    )
  )
    return "confirmed";
  const hasPackage = evidence.some((item) => item.package);
  const hasImport = evidence.some((item) => item.kind === "import");
  if (hasPackage && hasImport) return "probable";
  if (
    evidence.some(
      (item) => item.kind === "hostname" && item.strength === "moderate",
    )
  )
    return "probable";
  if (hasImport && evidence.some((item) => item.kind === "api-version"))
    return "probable";
  return "possible";
}

function operationFindings(
  evidence: readonly Evidence[],
): ProviderFinding["operations"] {
  const grouped = new Map<string, Evidence[]>();
  for (const item of evidence) {
    if (!item.operationId) continue;
    const existing = grouped.get(item.operationId) ?? [];
    existing.push(item);
    grouped.set(item.operationId, existing);
  }
  return [...grouped.entries()]
    .map(([id, values]) => ({
      id,
      confidence: values.some((item) => item.strength === "strong")
        ? ("confirmed" as const)
        : ("possible" as const),
      files: sortUnique(
        values.map((item) => normalizeRelativePath(item.relativePath)),
      ),
    }))
    .sort((left, right) => compare(left.id, right.id));
}

function endpointKey(endpoint: Evidence["endpoint"]): string {
  return endpoint
    ? `${endpoint.method}:${endpoint.host ?? ""}:${endpoint.path}`
    : "";
}

function endpointFindings(evidence: readonly Evidence[]): EndpointFinding[] {
  const grouped = new Map<string, Evidence[]>();
  for (const item of evidence) {
    if (item.kind !== "http-endpoint" || !item.endpoint) continue;
    const key = endpointKey(item.endpoint);
    const existing = grouped.get(key) ?? [];
    existing.push(item);
    grouped.set(key, existing);
  }
  return [...grouped.values()]
    .map((values) => {
      const endpoint = values[0]?.endpoint;
      if (!endpoint)
        throw new TypeError("Endpoint evidence unexpectedly missing endpoint");
      return {
        method: endpoint.method.toUpperCase(),
        ...(endpoint.host ? { host: endpoint.host.toLowerCase() } : {}),
        path: endpoint.path,
        confidence: values.some((item) => item.strength === "strong")
          ? ("confirmed" as const)
          : ("probable" as const),
        files: sortUnique(
          values.map((item) => normalizeRelativePath(item.relativePath)),
        ),
      };
    })
    .sort((left, right) =>
      compare(endpointKey({ ...left }), endpointKey({ ...right })),
    );
}

export function aggregateProviders(
  evidence: readonly Evidence[],
): ProviderFinding[] {
  const grouped = new Map<string, Evidence[]>();
  for (const item of evidence) {
    if (!item.providerId) continue;
    const existing = grouped.get(item.providerId) ?? [];
    existing.push(item);
    grouped.set(item.providerId, existing);
  }
  return [...grouped.entries()]
    .map(([id, values]) => {
      const operations = operationFindings(values);
      const endpoints = endpointFindings(values);
      const ownConfidence = confidenceForProvider(values);
      const confidence = maxConfidence([
        ownConfidence,
        ...operations.map((item) => item.confidence),
        ...endpoints.map((item) => item.confidence),
      ]);
      return {
        id,
        confidence,
        packages: normalizePackageEvidence(values),
        api_versions: sortUnique(
          values.flatMap((item) => (item.apiVersion ? [item.apiVersion] : [])),
        ),
        operations,
        endpoints,
        files: sortUnique(
          values.map((item) => normalizeRelativePath(item.relativePath)),
        ),
        evidenceKinds: sortUnique(
          values.map((item) => item.kind),
        ) as EvidenceKind[],
      } satisfies ProviderFinding;
    })
    .sort((left, right) => compare(left.id, right.id));
}

function normalizeMcp(
  servers: readonly McpServerFinding[],
): McpServerFinding[] {
  const grouped = new Map<string, McpServerFinding[]>();
  for (const server of servers) {
    const key = `${server.id}:${server.transport}`;
    const existing = grouped.get(key) ?? [];
    existing.push(server);
    grouped.set(key, existing);
  }
  return [...grouped.values()]
    .map((values) => {
      const selected = values[0];
      if (!selected) throw new TypeError("MCP server group was empty");
      return {
        id: selected.id,
        transport: selected.transport,
        confidence: "confirmed" as const,
        ...(selected.command ? { command: selected.command } : {}),
        ...(selected.package ? { package: selected.package } : {}),
        ...(selected.url_host ? { url_host: selected.url_host } : {}),
        config_files: sortUnique(
          values.flatMap((item) =>
            item.config_files.map(normalizeRelativePath),
          ),
        ),
      };
    })
    .sort((left, right) =>
      compare(`${left.id}:${left.transport}`, `${right.id}:${right.transport}`),
    );
}

export function aggregateUnknowns(
  evidence: readonly Evidence[],
): UnknownFinding[] {
  const raw: UnknownFinding[] = [];
  for (const item of evidence) {
    if (item.providerId) continue;
    if (
      item.package &&
      item.metadata?.manifestSection !== "devDependencies" &&
      /(?:^|[-_/@])(api|sdk|client|mcp)(?:$|[-_/])/iu.test(item.package.name)
    ) {
      raw.push({
        kind: "package",
        value: `${item.package.ecosystem}:${item.package.name}`,
        confidence: "possible",
        files: [item.relativePath],
      });
    } else if (item.kind === "import" && item.importSource) {
      raw.push({
        kind: "import",
        value: item.importSource,
        confidence: "possible",
        files: [item.relativePath],
      });
    } else if (item.kind === "hostname" && item.endpoint?.host) {
      raw.push({
        kind: "host",
        value: item.endpoint.host,
        confidence: "possible",
        files: [item.relativePath],
      });
    }
  }
  const grouped = new Map<string, UnknownFinding[]>();
  for (const item of raw) {
    const key = `${item.kind}:${item.value}`;
    const existing = grouped.get(key) ?? [];
    existing.push(item);
    grouped.set(key, existing);
  }
  return [...grouped.values()]
    .map((values) => {
      const selected = values[0];
      if (!selected) throw new TypeError("Unknown group was empty");
      return {
        kind: selected.kind,
        value: selected.value.slice(0, 2048),
        confidence: maxConfidence(values.map((item) => item.confidence)),
        files: sortUnique(
          values.flatMap((item) => item.files.map(normalizeRelativePath)),
        ),
      };
    })
    .sort((left, right) =>
      compare(`${left.kind}:${left.value}`, `${right.kind}:${right.value}`),
    );
}

export interface NormalizeScanInput {
  readonly evidence: readonly Evidence[];
  readonly mcpServers: readonly McpServerFinding[];
  readonly languages: readonly Language[];
  readonly diagnostics: readonly Diagnostic[];
  readonly filesScanned: number;
}

export function normalizeScanResult(input: NormalizeScanInput): ScanResult {
  return {
    project: {
      root: ".",
      languages: sortUnique(input.languages) as Language[],
    },
    providers: aggregateProviders(input.evidence),
    mcp_servers: normalizeMcp(input.mcpServers),
    unknowns: aggregateUnknowns(input.evidence),
    diagnostics: [...input.diagnostics].sort((left, right) =>
      compare(
        `${left.file ?? ""}:${left.code}:${left.message}`,
        `${right.file ?? ""}:${right.code}:${right.message}`,
      ),
    ),
    stats: { filesScanned: input.filesScanned },
  };
}
