export const CONFIDENCE = ["possible", "probable", "confirmed"] as const;
export type Confidence = (typeof CONFIDENCE)[number];
export type Language = "javascript" | "typescript" | "python";
export type Ecosystem = "npm" | "pypi";

export type DiagnosticSeverity = "info" | "warning" | "error";

export interface Diagnostic {
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly file?: string;
}

export interface PackageRef {
  readonly ecosystem: Ecosystem;
  readonly name: string;
  readonly version?: string;
  readonly direct: boolean;
}

export interface EndpointRef {
  readonly method: string;
  readonly path: string;
  readonly host?: string;
}

export type EvidenceKind =
  | "manifest"
  | "lockfile"
  | "import"
  | "operation-call"
  | "hostname"
  | "http-endpoint"
  | "api-version"
  | "mcp-config";

export type EvidenceStrength = "weak" | "moderate" | "strong";

export interface EvidenceMetadata {
  readonly binding?: string;
  readonly importedName?: string;
  readonly manifestSection?:
    | "dependencies"
    | "devDependencies"
    | "optionalDependencies"
    | "peerDependencies";
  readonly networkContext?: boolean;
  readonly resolved?: boolean;
}

export interface Evidence {
  readonly kind: EvidenceKind;
  readonly relativePath: string;
  readonly strength: EvidenceStrength;
  readonly providerId?: string;
  readonly package?: PackageRef;
  readonly operationId?: string;
  readonly endpoint?: EndpointRef;
  readonly apiVersion?: string;
  readonly importSource?: string;
  readonly metadata?: EvidenceMetadata;
}

export interface OperationFinding {
  readonly id: string;
  readonly confidence: Confidence;
  readonly files: readonly string[];
}

export interface EndpointFinding extends EndpointRef {
  readonly confidence: Confidence;
  readonly files: readonly string[];
}

export interface ProviderFinding {
  readonly id: string;
  readonly confidence: Confidence;
  readonly packages: readonly PackageRef[];
  readonly api_versions: readonly string[];
  readonly operations: readonly OperationFinding[];
  readonly endpoints: readonly EndpointFinding[];
  readonly files: readonly string[];
  readonly evidenceKinds?: readonly EvidenceKind[];
}

export interface McpServerFinding {
  readonly id: string;
  readonly transport: "stdio" | "http" | "sse" | "unknown";
  readonly confidence: "confirmed";
  readonly command?: string;
  readonly package?: string;
  readonly url_host?: string;
  readonly config_files: readonly string[];
}

export interface UnknownFinding {
  readonly kind: "package" | "import" | "host" | "endpoint" | "mcp";
  readonly value: string;
  readonly confidence: Confidence;
  readonly files: readonly string[];
}

export interface ProjectSummary {
  readonly root: ".";
  readonly languages: readonly Language[];
}

export interface ScanStats {
  readonly filesScanned: number;
}

export interface ScanResult {
  readonly project: ProjectSummary;
  readonly providers: readonly ProviderFinding[];
  readonly mcp_servers: readonly McpServerFinding[];
  readonly unknowns: readonly UnknownFinding[];
  readonly diagnostics: readonly Diagnostic[];
  readonly stats: ScanStats;
}

export interface LockfileDocument {
  readonly version: 1;
  readonly project: ProjectSummary;
  readonly providers: readonly ProviderFinding[];
  readonly mcp_servers: readonly McpServerFinding[];
  readonly unknowns: readonly UnknownFinding[];
}

export type ChangeKind =
  "provider" | "package" | "operation" | "endpoint" | "mcp" | "unknown";
export type ChangeType = "added" | "removed" | "changed";

export interface InventoryChange {
  readonly type: ChangeType;
  readonly kind: ChangeKind;
  readonly key: string;
  readonly confidence: Confidence;
  readonly providerId?: string;
  readonly files: readonly string[];
  readonly before?: string;
  readonly after?: string;
}

export interface LockfileDiff {
  readonly changes: readonly InventoryChange[];
  readonly changed: boolean;
}

export interface PolicyResult {
  readonly passed: boolean;
  readonly violations: readonly InventoryChange[];
}

export type MemberCallMatcher = {
  readonly language: Language;
  readonly kind: "member-call";
  readonly package: string;
  readonly chain: readonly string[];
};

export type FunctionCallMatcher = {
  readonly language: Language;
  readonly kind: "function-call";
  readonly package: string;
  readonly function: string;
};

export type HttpEndpointMatcher = {
  readonly language: Language | "any";
  readonly kind: "http-endpoint";
  readonly method: string;
  readonly path: string;
};

export type OperationMatcher =
  MemberCallMatcher | FunctionCallMatcher | HttpEndpointMatcher;

export interface ProviderDefinition {
  readonly version: 1;
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly homepage?: string;
  readonly categories?: readonly string[];
  readonly packages?: Readonly<Partial<Record<Ecosystem, readonly string[]>>>;
  readonly imports?: readonly {
    readonly language: Language;
    readonly source: string;
  }[];
  readonly domains?: readonly string[];
  readonly api_versions?: readonly {
    readonly language: Language | "any";
    readonly kind:
      "object-property" | "assignment" | "header" | "environment-key";
    readonly key: string;
  }[];
  readonly operations?: readonly {
    readonly id: string;
    readonly display_name?: string;
    readonly matchers: readonly OperationMatcher[];
  }[];
}

export interface ProviderCatalog {
  readonly providers: readonly ProviderDefinition[];
  readonly packageIndex: ReadonlyMap<string, ProviderDefinition>;
  readonly importIndex: ReadonlyMap<string, ProviderDefinition>;
  readonly domainIndex: ReadonlyMap<string, ProviderDefinition>;
}

export interface ScanOptions {
  readonly root: string;
  readonly catalog: ProviderCatalog;
  readonly include?: readonly string[];
  readonly exclude?: readonly string[];
  readonly maxFileSize?: number;
  readonly maxFiles?: number;
  readonly strict?: boolean;
  readonly signal?: AbortSignal;
}
