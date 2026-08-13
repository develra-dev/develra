# `develra.lock` specification

## Purpose

`develra.lock` is a deterministic, reviewable inventory of a repository's external contract surface.

It is not:

- a cache;
- a scan log;
- a vulnerability database;
- a copy of provider schemas;
- a record of every line of evidence;
- proof that a remote service was successfully called.

## File format

- YAML 1.2-compatible serialization.
- UTF-8.
- LF line endings.
- Top-level integer `version`.
- Validated against `schemas/develra-lock.schema.json`.
- Canonical serialization owned by Develra.

JSON is a supported machine report format, but the committed lockfile is YAML.

## Design principles

### Deterministic

No timestamps, random IDs, machine names, absolute paths, parser timing, or filesystem enumeration order.

### Minimal but explanatory

Store normalized contract inventory and repository-relative evidence files. Do not store source snippets or volatile line numbers.

### Human-reviewable

A code review should show that an integration, operation, endpoint, API version, or MCP server was added or removed.

### Provider-stable

Canonical provider and operation IDs must remain stable even when display names change.

### Safe

The file must not contain:

- secrets;
- environment variable values;
- request headers;
- tokens;
- full URLs with query strings;
- source text;
- home-directory paths;
- CI runner paths.

## Example

```yaml
version: 1

project:
  root: .
  languages:
    - typescript

providers:
  - id: openai
    confidence: confirmed
    packages:
      - ecosystem: npm
        name: openai
        version: 5.4.0
        direct: true
    api_versions: []
    operations:
      - id: responses.create
        confidence: confirmed
        files:
          - src/ai/generate.ts
    endpoints: []
    files:
      - src/ai/client.ts
      - src/ai/generate.ts

  - id: stripe
    confidence: confirmed
    packages:
      - ecosystem: npm
        name: stripe
        version: 18.2.1
        direct: true
    api_versions:
      - "2025-04-30"
    operations:
      - id: checkout.sessions.create
        confidence: confirmed
        files:
          - src/billing/checkout.ts
    endpoints:
      - method: POST
        path: /v1/checkout/sessions
        confidence: confirmed
        files:
          - src/billing/checkout.ts
    files:
      - src/billing/checkout.ts

mcp_servers:
  - id: github
    transport: stdio
    confidence: confirmed
    config_files:
      - .mcp.json

unknowns:
  - kind: host
    value: api.example-analytics.com
    confidence: possible
    files:
      - src/analytics/client.ts
```

## Top-level fields

### `version`

Required integer. Initial value is `1`.

The version governs the entire serialized contract. Additive optional fields may be introduced within a version only when older readers can ignore them safely. Otherwise increment the version.

### `project`

Required object.

- `root`: always `"."` in a committed lockfile.
- `languages`: sorted unique list of detected supported languages.

Do not store the absolute root, repository remote, branch, commit SHA, or private project name by default.

### `providers`

Required array, sorted by provider `id`.

Each provider has:

- `id`;
- `confidence`;
- `packages`;
- `api_versions`;
- `operations`;
- `endpoints`;
- `files`.

### `mcp_servers`

Required array, sorted by `id`, then transport.

Represents configured project dependencies. It does not assert that a server started successfully or that tools were invoked.

### `unknowns`

Required array preserving useful external signals that could not be matched to a provider.

Unknowns make provider coverage gaps visible and create contribution opportunities.

## Provider object

### `id`

Canonical lowercase slug from the provider pack.

Examples:

```text
stripe
openai
anthropic
github
```

### `confidence`

One of:

```text
confirmed
probable
possible
```

Provider confidence is the maximum trustworthy aggregate confidence supported by its evidence. It must not be inflated merely because multiple copies of the same weak evidence appear.

### `packages`

Sorted by ecosystem then package name.

```yaml
packages:
  - ecosystem: npm
    name: stripe
    version: 18.2.1
    direct: true
```

Supported initial ecosystems:

- `npm`;
- `pypi`.

The schema anticipates future ecosystems, but implementation should not claim support until an adapter exists.

`version` is optional because some manifests do not yield a safe resolved version. Preserve a normalized version string; do not infer a version from source imports.

`direct` indicates direct versus transitive declaration when the parser can determine it.

### `api_versions`

Sorted unique strings that are explicitly configured or safely detected.

Do not infer an API version solely from SDK package version unless a provider-specific rule documents that mapping and the result is labeled appropriately in reports. The lockfile should prefer observed configuration.

### `operations`

Sorted by canonical operation `id`.

```yaml
operations:
  - id: checkout.sessions.create
    confidence: confirmed
    files:
      - src/billing/checkout.ts
```

Files are sorted, unique, repository-relative POSIX paths.

No line numbers or source snippets.

### `endpoints`

Sorted by method, host if present, and path.

```yaml
endpoints:
  - method: POST
    host: api.stripe.com
    path: /v1/checkout/sessions
    confidence: confirmed
    files:
      - src/billing/checkout.ts
```

Rules:

- method is uppercase;
- host omits scheme, credentials, port unless semantically required, path, query, and fragment;
- path omits query and fragment;
- dynamic segments may use a canonical placeholder such as `{id}`;
- no complete URL with secrets.

### `files`

Union of repository-relative files supporting the provider finding. This is a convenience summary and must be derivable from normalized evidence.

## MCP server object

```yaml
- id: github
  transport: stdio
  confidence: confirmed
  command: npx
  package: "@modelcontextprotocol/server-github"
  config_files:
    - .mcp.json
```

Potential fields:

- `id`: normalized server key or recognized package/provider ID;
- `transport`: `stdio`, `http`, `sse`, or `unknown`;
- `command`: executable basename only, never an absolute path;
- `package`: safely detected package name, if any;
- `url_host`: host only for remote transports;
- `confidence`;
- `config_files`.

Never store:

- arguments likely to contain secrets;
- environment values;
- authorization headers;
- full remote URLs with paths or queries;
- absolute executable paths.

For an unrecognized server, use a normalized ID derived from its project config key and preserve it as an MCP finding or unknown without leaking values.

## Unknown object

```yaml
- kind: host
  value: api.example.com
  confidence: possible
  files:
    - src/client.ts
```

Initial kinds:

- `package`;
- `import`;
- `host`;
- `endpoint`;
- `mcp`.

Unknown values are normalized and bounded. Remove query strings, credentials, and secret-like tokens.

## Canonical ordering

Serializer order:

1. `version`;
2. `project`;
3. `providers`;
4. `mcp_servers`;
5. `unknowns`.

Provider field order:

1. `id`;
2. `confidence`;
3. `packages`;
4. `api_versions`;
5. `operations`;
6. `endpoints`;
7. `files`.

All arrays use documented canonical sort keys. All file paths are POSIX style even on Windows.

## Omission versus empty collections

Top-level arrays are always present, including when empty.

Within provider objects:

- `packages`, `api_versions`, `operations`, `endpoints`, and `files` are always present;
- optional scalar fields are omitted when unknown;
- never serialize `null`.

This reduces reader ambiguity and simplifies schema validation.

## Comparison semantics

`develra check` parses and normalizes the lockfile before comparing it with a scan.

Material changes include:

- provider added or removed;
- confidence crossing a policy threshold;
- package added, removed, or version changed;
- API version added or removed;
- operation added or removed;
- endpoint added or removed;
- MCP server added, removed, or materially reconfigured;
- unknown external signal added or removed.

Changes to display formatting, input enumeration order, or diagnostic text are not material.

## Schema evolution

### Additive change

A new optional field may be added in version 1 only when:

- old readers safely ignore it;
- canonical ordering is specified;
- golden fixtures are updated;
- the field does not alter existing meaning.

### Breaking change

Increment the top-level version when:

- required fields change;
- an existing field changes type or meaning;
- canonical IDs change;
- comparison semantics become incompatible.

Provide a migration command before 1.0 if real repositories already depend on the previous format.

## Validation

The implementation must:

1. validate parsed YAML structurally;
2. reject duplicate mapping keys;
3. enforce bounded string and array sizes;
4. reject absolute or parent-traversal paths;
5. reject unsupported versions with a clear message;
6. normalize before comparison, but never silently repair a committed invalid lockfile.

## Golden tests

Required cases:

- empty repository;
- TypeScript provider with package, import, and operation;
- Python provider with package and import;
- raw hostname unknown;
- MCP config with redacted sensitive arguments;
- Windows input paths serialized as POSIX;
- random filesystem order produces identical bytes;
- repeated scan produces identical bytes;
- source line movement does not alter lockfile;
- adding one operation alters only the expected operation/files sections.
