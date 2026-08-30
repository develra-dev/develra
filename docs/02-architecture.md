# Architecture

## Context

Develra has two architectural eras:

1. **Local open-source era:** repository scan, lockfile, reports, CI, provider contributions.
2. **Hosted monitoring era:** upstream source polling, contract history, change classification, organization-wide exposure, alert delivery.

The first era must stand alone. The second must consume the artifacts and interfaces of the first without forcing the local scanner to become a thin client.

## Recommended repository structure

```text
.
├── AGENTS.md
├── START_HERE.md
├── README.md
├── LICENSE
├── action.yml
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── apps/
│   └── cli/
│       ├── src/
│       └── package.json
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── discovery/
│   │   │   ├── detection/
│   │   │   ├── normalization/
│   │   │   ├── lockfile/
│   │   │   ├── policy/
│   │   │   └── types/
│   │   └── package.json
│   ├── providers/
│   │   ├── src/
│   │   ├── data/
│   │   └── package.json
│   ├── reporters/
│   │   ├── src/
│   │   └── package.json
│   └── action/
│       ├── src/
│       ├── dist/
│       └── package.json
├── schemas/
│   ├── develra-lock.schema.json
│   └── provider.schema.json
├── fixtures/
│   ├── repositories/
│   ├── providers/
│   ├── contracts/
│   └── expected/
├── examples/
├── docs/
└── scripts/
```

This is one GitHub repository even though it contains internal workspace packages.

## Module responsibilities

### `apps/cli`

Responsibilities:

- command parsing;
- terminal capability detection;
- config resolution;
- composition of core services;
- exit code selection;
- user-facing error formatting.

Must not contain:

- manifest parsing;
- provider scoring;
- lockfile normalization;
- report serialization logic beyond selecting a reporter.

### `packages/core`

Responsibilities:

- filesystem inventory interface;
- manifest and source adapters;
- evidence model;
- scan orchestration;
- confidence calculation;
- normalization;
- lockfile comparison;
- policy evaluation;
- diagnostics;
- registry interface.

It must not depend on CLI-specific rendering or GitHub Action APIs.

### `packages/providers`

Responsibilities:

- bundled provider data;
- provider schema validation;
- provider indexing;
- package/domain/import/operation lookup;
- conflict diagnostics.

Provider data must be declarative. Loading a provider must never evaluate code from the provider file.

### `packages/reporters`

Responsibilities:

- console-neutral report model;
- JSON serialization;
- YAML lockfile serialization;
- Markdown;
- SVG;
- SARIF.

Reporters receive normalized results and do not rescan files.

### `packages/action`

Responsibilities:

- map Action inputs to CLI/core options;
- write `GITHUB_STEP_SUMMARY`;
- expose Action outputs;
- map exceptions to Action failure;
- bundle runtime dependencies.

The Action should call the same public core/CLI entry point used locally.

## Runtime data flow

```text
Repository root
      │
      ▼
Safe file inventory ───────────────┐
      │                            │
      ├─ manifests/lockfiles       │
      ├─ source files              │
      └─ MCP config                │
      │                            │
      ▼                            │
Language and config adapters       │
      │                            │
      ▼                            │
Raw evidence                       │
      │                            │
      ├─ package                   │
      ├─ import                    │
      ├─ host                      │
      ├─ operation                 │
      ├─ endpoint                  │
      ├─ api version               │
      └─ MCP config                │
      │                            │
      ▼                            │
Provider index and matcher ◄───────┘
      │
      ▼
Evidence aggregation
      │
      ▼
Confidence and normalization
      │
      ├──────────────► diagnostics
      │
      ▼
Normalized ScanResult
      │
      ├─ lockfile reporter
      ├─ console reporter
      ├─ JSON reporter
      ├─ Markdown reporter
      ├─ SVG reporter
      └─ SARIF reporter
```

## Core types

The exact TypeScript names may evolve, but the conceptual model should remain:

```ts
type Confidence = "confirmed" | "probable" | "possible";

type EvidenceKind =
  | "manifest"
  | "lockfile"
  | "import"
  | "operation-call"
  | "hostname"
  | "http-endpoint"
  | "api-version"
  | "mcp-config";

interface Evidence {
  kind: EvidenceKind;
  relativePath: string;
  providerId?: string;
  package?: PackageRef;
  operationId?: string;
  endpoint?: EndpointRef;
  apiVersion?: string;
  metadata?: Record<string, string | boolean | number>;
}

interface ScanResult {
  project: ProjectSummary;
  providers: ProviderFinding[];
  mcpServers: McpServerFinding[];
  unknowns: UnknownFinding[];
  diagnostics: Diagnostic[];
}
```

Evidence metadata must never include source snippets or secret values.

## Filesystem abstraction

Define a narrow interface used by the scanner:

```ts
interface ScanFileSystem {
  realpath(path: string): Promise<string>;
  stat(path: string): Promise<FileStat>;
  readFile(path: string, maxBytes: number): Promise<Uint8Array>;
  walk(root: string, options: WalkOptions): AsyncIterable<FileEntry>;
}
```

The implementation must:

- enforce root containment;
- normalize output paths;
- detect symlink escapes;
- apply size limits before reading;
- avoid dependency/build directories;
- support fixture-backed tests.

## Adapter model

Use small adapters rather than one universal parser.

```ts
interface EvidenceAdapter {
  id: string;
  supports(file: FileDescriptor): boolean;
  scan(context: AdapterContext): Promise<AdapterResult>;
}
```

Initial adapters:

- npm manifest;
- npm lockfiles;
- Python manifest;
- Python lockfiles;
- TypeScript/JavaScript imports and calls;
- Python imports and calls;
- generic hostname/URL;
- selected raw HTTP endpoints;
- MCP project config.

Adapters emit raw evidence. They do not assign final provider confidence independently.

## Provider index

Build indexes at startup:

```text
package ecosystem + package name → provider
domain → provider
language + import source → provider
language + package + member chain → canonical operation
method + path template → canonical operation/provider
```

Conflicting indexes must produce deterministic diagnostics. A provider pack may not silently override another provider unless an explicit precedence rule exists.

## Confidence engine

Confidence is based on aggregated independent signals, not on a single parser's intuition.

Example:

```text
package only                              → possible
hostname only                             → possible
package + matching import                 → probable
package + import + provider method call   → confirmed
raw host + canonical method/path          → confirmed
explicit MCP project configuration        → confirmed configured dependency
```

`confirmed configured dependency` does not mean the service was successfully invoked.

## Lockfile comparison

Comparison operates on normalized structures, not raw YAML text.

```ts
interface LockfileDiff {
  providersAdded: ProviderFinding[];
  providersRemoved: ProviderFinding[];
  providersChanged: ProviderChange[];
  mcpAdded: McpServerFinding[];
  mcpRemoved: McpServerFinding[];
  unknownsAdded: UnknownFinding[];
  unknownsRemoved: UnknownFinding[];
}
```

The human reporter explains changes. Policy decides whether they fail CI.

## Registry interface

Do not couple the scanner to an HTTP endpoint.

```ts
type RegistryMode = "offline" | "fixture" | "remote";

interface RegistryProvenance {
  kind: "fixture" | "remote";
  sourceId: string;
  retrievedAt: string;
  sourceUrl?: string;
  contentHash?: string;
}

interface ProviderContractState {
  providerId: string;
  revision: string;
  operations: string[];
  endpoints: EndpointRef[];
  confidence: Confidence;
  provenance: RegistryProvenance;
}

interface ContractChange {
  id: string;
  providerId: string;
  observedAt: string;
  effectiveAt?: string;
  severity: "breaking" | "warning" | "informational" | "unknown";
  operations: string[];
  endpoints: EndpointRef[];
  summary: string;
  confidence: Confidence;
  provenance: RegistryProvenance;
}

interface ContractRegistry {
  readonly mode: RegistryMode;
  getCapabilities(): Promise<RegistryCapabilities>;
  getProviderState(providerId: string): Promise<ProviderContractState | null>;
  getChanges(query: ChangeQuery): Promise<readonly ContractChange[]>;
}
```

Provide:

- `NoopRegistry` for offline default;
- `FixtureRegistry` for tests;
- `HttpRegistry` only for an explicitly supplied remote URL.

`NoopRegistry` advertises `mode: "offline"` and `remote: false`, returns no
provider state or changes, and performs no I/O. Current `scan` and ordinary
`check` paths do not query a registry at all. `check --registry <url>` is the
only remote-capable path and the transport is never instantiated by default.

`FixtureRegistry` accepts already-loaded local provider states and changes. It
advertises `mode: "fixture"` and `remote: false`, canonicalizes fixture arrays,
returns defensive copies, filters changes by provider and an exclusive `since`
timestamp, and performs no filesystem or network I/O. Synthetic snapshots live
under `fixtures/registry/`; tests load them explicitly so fixture behavior does
not become an implicit production data source.

The pure `mapContractChangesToInventory` helper maps normalized changes to the
providers and operations already present in a lockfile inventory:

- changes for absent providers are irrelevant and omitted;
- a provider match without an affected operation is weak evidence, and its
  message says relevance is uncertain;
- an affected-operation intersection is strong evidence and carries the
  operation's repository-relative evidence paths into the message.

Registry source confidence is retained on the change and is not promoted by
inventory relevance. The mapper performs exact structural matching without an
LLM. Endpoint- and field-level relevance remain outside DVL-061.

## Registry HTTP contract and client

`schemas/registry.openapi.yaml` is the canonical transport contract for a
compatible public registry. The deployed v1 surface contains only capabilities
and change-query operations. Every success or error body carries
`api_version: v1`; change responses use bounded opaque cursors; successful
responses support ETag revalidation and explicit public cache directives;
errors use bounded `application/problem+json` envelopes with no-store caching.

The contract identifies `https://www.develra.dev/api` and has no security
scheme, request body, inventory-upload operation, authentication, billing, or
mutation surface. Provider metadata/state schemas remain available to the
reusable client boundary, but the public service reports `provider_state:
false` and does not expose those routes. Synthetic examples under
`fixtures/registry-api/` are validated without making a network request.

`HttpRegistry` uses the Node.js built-in `fetch` implementation only after an
explicit `check --registry` option. It accepts HTTPS URLs, with loopback HTTP
only for testing; rejects credentials, query strings, fragments, and redirects;
omits credentials and authorization headers; applies a five-second timeout;
and reads at most 512 KiB of decompressed JSON per response. Runtime responses
are validated against `schemas/registry-response.schema.json`. Provider queries
and opaque-cursor pagination are bounded, repeated cursors and duplicate change
IDs are rejected, and remote failures are typed as exit code 4. The CLI sends
only detected provider IDs, maps returned changes locally, and never uploads
source, lockfile contents, or evidence paths.

The deployed handler is a dependency-free Vercel Function beside the static
website. It reads a bounded, reviewed JSON file in the repository and has no
database, background poller, user account, inventory store, or source upload.
Each record links to an official HTTPS source and must use bundled provider and
operation IDs. Updating the feed is an ordinary reviewed repository change.

## Configuration layers

Resolve config in this order:

1. built-in defaults;
2. repository `develra.config.yaml`;
3. environment variables for non-secret behavior;
4. CLI flags.

No config source may enable source upload or project code execution because those behaviors do not exist in the initial release.

## Error model

Use typed errors and diagnostics.

- Fatal configuration/schema errors stop the command.
- A malformed source file creates a warning and continues.
- Unsafe path traversal creates an error and excludes the path.
- Invalid provider packs block startup for bundled data and block only the selected file for validation commands.
- Registry errors in optional remote mode produce a distinct exit condition or policy result.

Avoid exposing stack traces by default. Include `--debug` for local diagnostics, while still redacting paths and secrets where required.

## Dependency policy

Prefer established libraries for:

- YAML;
- JSON Schema;
- glob/ignore semantics;
- TypeScript parsing;
- Python syntax parsing;
- CLI argument parsing;
- SVG escaping;
- SARIF serialization.

Do not adopt a heavy framework when a small library or standard API suffices. Do not depend on a cloud SDK in the core.

## Future hosted architecture

The hosted implementation stack is intentionally not prescribed by the local
scanner. The shared contract is the normalized lockfile, provider IDs,
operation IDs, and registry interface.

See `docs/10-hosted-service-boundary.md`.
