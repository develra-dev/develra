# Scope, requirements, and roadmap

## Version naming

Use semantic versioning for the CLI package.

- `0.1.0-alpha`: internal or limited preview of the offline scanner and deterministic lockfile.
- `0.1.0`: first promoted public release, including the GitHub Action, reporters, provider contribution workflow, and release polish in M0–M5.
- `0.2.0`: optional public registry client and upstream-change checks.
- `1.0.0`: stable lockfile/config contracts and documented migration policy.

The implementation milestones below are engineering milestones, not required package version numbers.

## In scope for the first public release

### Discovery

- repository root discovery;
- ignore handling;
- JavaScript/TypeScript manifests and lockfiles;
- Python manifests and lockfiles;
- direct package detection;
- import detection;
- provider hostname detection;
- selected operation-call detection;
- selected raw HTTP endpoint detection;
- project-level MCP configuration detection;
- unknown external package/host preservation.

### Normalization

- provider identity;
- package ecosystem, name, version, and directness;
- API-version literals or configuration where safely detectable;
- canonical operation IDs;
- canonical endpoint method/path;
- confidence;
- relative evidence files;
- deterministic ordering.

### Outputs

- console;
- `develra.lock`;
- JSON;
- Markdown;
- SVG dependency graph;
- SARIF 2.1.0-compatible output for supported findings.

### Commands

- `develra scan`;
- `develra check`;
- `develra graph`;
- `develra providers list`;
- `develra providers validate`;
- `develra doctor`.

### GitHub integration

- root `action.yml`;
- bundled JavaScript Action;
- job summary;
- exit status suitable for required checks;
- optional SARIF artifact output;
- Marketplace-ready metadata;
- example workflow.

### Contribution

- provider schema;
- provider validator;
- provider fixtures;
- contribution guide;
- issue templates;
- initial breakage examples.

## Out of scope for the first public release

- user accounts;
- hosted repository connection;
- authentication and billing;
- continuous polling;
- public changelog directory;
- full OpenAPI history service;
- arbitrary docs-page scraping;
- AI-generated summaries;
- Slack, email, or webhook alerts;
- pull-request comments by default;
- code modification or migration generation;
- runtime packet or traffic capture;
- full field-level dataflow analysis;
- executing package scripts or project code;
- executing or connecting to MCP servers;
- enterprise policy administration;
- support for every language or package ecosystem.

## Functional requirements

### FR-001: offline default scan

`develra scan` must complete without network access. A test must fail if the default scan path instantiates or calls a network transport.

### FR-002: repository inventory

The scan result must represent:

- recognized providers;
- detected packages;
- API versions when found;
- operations;
- endpoints;
- MCP servers;
- unknown external signals;
- evidence types and files;
- confidence.

### FR-003: confidence semantics

All provider, operation, endpoint, MCP, and unknown findings must be labeled `confirmed`, `probable`, or `possible` according to documented rules.

### FR-004: deterministic lockfile

Equivalent scans must produce byte-identical lockfiles regardless of filesystem enumeration order, operating system path separator, terminal width, or wall-clock time.

### FR-005: local check

`develra check` must rescan the repository and compare the normalized result with the committed lockfile. It must report additions, removals, and material changes.

### FR-006: explainability

Console and Markdown reports must show why a provider was detected. The lockfile stores evidence file paths but no source text.

### FR-007: provider extensibility

A new provider with supported matching primitives must be addable through a YAML provider pack plus fixtures, without modifying core scanner code.

### FR-008: safe MCP detection

The scanner may parse known project configuration formats. It must not launch an MCP command, connect to a server, interpolate environment values, or reveal argument secrets.

### FR-009: Action

The same scanner and rules used locally must run in GitHub Actions. The Action must not require repository write permissions for its core behavior.

### FR-010: machine interfaces

JSON output and exit codes must be stable enough for shell and CI consumption. Schema-breaking changes before 1.0 require explicit release notes and tests.

## Non-functional requirements

### NFR-001: trust

No default telemetry. No source upload. No implicit network. No project code execution.

### NFR-002: portability

Support macOS, Linux, and Windows on currently supported Node versions chosen by CI. Normalize paths to POSIX style in serialized output.

### NFR-003: performance

For the release fixture representing roughly 1,000 source files:

- warm scan target: under 5 seconds in CI;
- memory target: under 512 MB;
- no individual source file larger than 2 MiB is parsed by default;
- ignored dependency/build directories are not traversed.

Performance targets are budgets. A documented exception is acceptable only when accompanied by profiling evidence.

### NFR-004: resilience

Malformed manifests, unsupported syntax, and invalid provider packs must produce clear diagnostics. One malformed source file should not abort the entire scan unless strict mode is enabled.

### NFR-005: security

All paths must remain inside the scan root. Output renderers must escape untrusted content. Provider patterns must be bounded and declarative.

### NFR-006: testability

Core scanning must accept injected filesystem, ignore, clock, and registry abstractions. Tests must not depend on the public internet.

### NFR-007: maintainability

Public types and schemas are documented. Provider pack changes are fixture-tested. Command handlers do not contain detection logic.

## Milestones

## M0 — Repository foundation

Deliver:

- pnpm workspace;
- strict TypeScript build;
- lint, formatting, unit-test, fixture-test, and packaging scripts;
- core types;
- JSON schemas;
- fixture harness;
- CI skeleton;
- license and draft README.

Exit criteria:

- all expected commands run;
- packaged CLI prints a version and help;
- schemas validate bundled examples;
- CI passes on the supported matrix.

## M1 — Offline inventory skeleton

Deliver:

- safe file inventory;
- ignore rules;
- JS/TS and Python manifest parsing;
- basic MCP config parsing;
- normalized scan-result model;
- console output;
- `scan --no-write`.

Exit criteria:

- representative fixtures produce stable provider/package candidates;
- scan performs no network requests;
- malformed files yield diagnostics rather than crashes.

## M2 — Provider packs and source evidence

Deliver:

- provider-pack loader and validator;
- at least ten provider packs;
- JS/TS import and selected method detection;
- Python import and selected method detection;
- hostname and selected endpoint detection;
- evidence aggregation;
- confidence engine;
- unknown-signal output.

Exit criteria:

- provider fixtures demonstrate package-only, import, operation, host, endpoint, and conflict cases;
- no arbitrary provider code executes;
- false-confidence tests pass.

## M3 — Lockfile and reporters

Deliver:

- deterministic `develra.lock`;
- `scan` write mode;
- `check`;
- Markdown, JSON, SVG, and SARIF reporters;
- graph generation;
- golden serialization tests.

Exit criteria:

- repeated scans are byte-identical;
- adding/removing an operation changes only the expected lockfile section;
- `check` exits according to policy;
- reports contain no absolute paths or source snippets.

## M4 — GitHub Action

Deliver:

- root `action.yml`;
- bundled Action;
- job summary;
- example workflows;
- Action smoke fixture;
- release packaging;
- Marketplace-ready repository metadata.

Exit criteria:

- Action can run `check` in a sample repository;
- core use requires only `contents: read`;
- optional SARIF path is produced;
- bundled `dist` is reproducible.

## M5 — Public-repository polish

Deliver:

- final README;
- animated or recorded terminal demo source;
- contribution guide;
- provider template;
- issue/PR templates;
- Breakage Museum starter corpus;
- good-first-issue labels/documentation;
- release checklist.

Exit criteria:

- a new contributor can add a provider using documentation alone;
- a new user can reach a useful report in under five minutes;
- repository pages explain privacy and confidence clearly;
- launch artifacts are ready.

## M6 — Optional registry boundary

This milestone is not required for the first public release.

Deliver:

- explicit registry-client interface;
- local fixture registry;
- optional `check --registry`;
- upstream-change result model;
- no hosted account dependency.

Exit criteria:

- offline behavior remains unchanged;
- remote data is treated as untrusted;
- registry failures degrade clearly;
- upstream findings map to lockfile operations or providers with confidence.

## M7 — Hosted service

Deferred. See `docs/10-hosted-service-boundary.md`.

## Release gate

Do not publish the first release until all M0–M5 exit criteria pass.

A known false negative may be accepted with documentation. A known privacy violation, non-deterministic lockfile, default network request, project code execution, or misleading confirmed finding blocks release.
