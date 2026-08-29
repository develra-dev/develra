# Detection engine

## Goal

Produce an accurate, explainable external-contract inventory from repository files without executing code or requiring network access.

The engine should favor precision and clear confidence over exhaustive speculative detection.

## Pipeline

```text
root resolution
→ safe file inventory
→ file classification
→ manifest/config adapters
→ source adapters
→ raw evidence
→ provider matching
→ evidence aggregation
→ confidence assignment
→ normalization
→ scan result
```

## 1. Root resolution

Resolve the requested root and its real path.

Rules:

- root must exist and be a directory;
- all scanned files must resolve beneath root;
- symlinks outside root are excluded with a diagnostic;
- serialized paths are relative to root and use `/`;
- Git repository detection may improve defaults but is not required.

## 2. File inventory

### Default ignored directories

At minimum:

```text
.git
node_modules
vendor
.venv
venv
__pycache__
dist
build
coverage
.next
.nuxt
.turbo
.cache
```

Also honor:

- `.gitignore`;
- `.develraignore`;
- config excludes;
- CLI excludes.

Precedence should be documented and tested. An explicit include must not bypass root containment or secret-file safety without an explicit supported mechanism.

### File limits

Default:

- maximum source/config file size: 2 MiB;
- maximum files: high bounded value with diagnostic, such as 100,000;
- no binary parsing;
- no archive extraction;
- no device or socket files.

The exact file-count limit may be configurable.

### Secret-sensitive default excludes

Do not parse generic environment files by default:

```text
.env
.env.*
*.pem
*.key
```

Configuration files with known structure may be parsed only to identify key names or sanitized hosts. Never serialize values likely to contain secrets.

## 3. File classification

Initial classes:

- npm manifest: `package.json`;
- npm lockfiles: `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`;
- Python manifests: `pyproject.toml`, `requirements*.txt`, `Pipfile`;
- Python lockfiles: `poetry.lock`, `uv.lock`, `Pipfile.lock`;
- JS/TS source;
- Python source;
- MCP project config;
- generic text source for bounded URL/hostname extraction.

Generated/minified files should be skipped through filename, path, and size heuristics.

## 4. Manifest evidence

Manifest adapters emit:

```ts
interface PackageEvidence {
  ecosystem: "npm" | "pypi";
  name: string;
  version?: string;
  direct: boolean;
  source: "manifest" | "lockfile";
  relativePath: string;
}
```

Package version precedence:

1. resolved direct version from lockfile when trustworthy;
2. exact manifest version;
3. normalized declared range;
4. omitted.

Python lockfiles contribute resolved versions only for packages that a Python
manifest in the same directory already declares as direct. Locked transitive
packages are never promoted to direct dependencies, non-registry sources (path,
editable, virtual, git, URL) never contribute versions, and a package locked to
multiple marker-specific versions — or to a mix of registry and non-registry
sources — falls back to manifest evidence.

Do not attempt package installation or run package-manager commands during scan.

## 5. Import evidence

### JavaScript and TypeScript

Use a syntax parser, not regex alone, to detect:

- static `import`;
- `require`;
- selected dynamic import literals;
- imported identifiers and default bindings.

Examples:

```ts
import OpenAI from "openai";
import Stripe from "stripe";
const { WebClient } = require("@slack/web-api");
```

Do not resolve or execute modules.

Track binding information needed for operation matching:

```text
package openai → local binding OpenAI
constructed client → local binding client
```

### Python

Use a Python syntax parser to detect:

```py
import openai
from openai import OpenAI
import stripe as stripe_sdk
```

Track aliases and constructed client bindings without importing Python modules.

Malformed files produce diagnostics and continue.

## 6. Hostname and URL evidence

Detect string literals used in likely network contexts where feasible:

- `fetch`;
- `axios`;
- common HTTP clients;
- `requests`;
- client base URL configuration;
- webhook target configuration.

A generic text fallback may detect hosts but should remain `possible`.

Normalize:

- lowercase host;
- remove scheme;
- remove credentials;
- remove query and fragment;
- omit default ports;
- preserve non-default port only in transient evidence, not provider mapping unless required.

Never serialize full URLs containing tokens.

Avoid treating documentation links, comments, tests, or README URLs as active contract evidence by default. Source context and file class affect confidence.

## 7. Operation-call evidence

Operation detection is provider-specific and declarative.

### Binding-aware matching

For:

```ts
import OpenAI from "openai";
const client = new OpenAI();
await client.responses.create(...);
```

The engine must establish:

```text
OpenAI constructor derives from package openai
client derives from OpenAI
client.responses.create maps to openai/responses.create
```

It must not match:

```ts
const client = makeUnrelatedClient();
client.responses.create();
```

solely because the member chain matches.

### Alias handling

Support simple aliases:

```ts
const ai = new OpenAI();
ai.responses.create();
```

Do not attempt whole-program pointer analysis in the initial release.

### Raw HTTP matching

An endpoint operation becomes confirmed only when enough context exists.

Strong:

```text
host api.stripe.com + POST + /v1/checkout/sessions
```

Weak:

```text
string "/v1/checkout/sessions" alone
```

Dynamic URLs that cannot be normalized remain possible or omitted.

## 8. API-version evidence

Detect explicit version configuration such as:

- provider-specific client option;
- provider-specific assignment;
- literal request header;
- literal config key.

Rules:

- only literal, safely normalized values enter the lockfile;
- environment variable names may be evidence that versioning is configured, but values are not read from the process environment;
- SDK-version-to-API-version inference is report metadata at most unless a verified provider rule makes it reliable;
- do not claim a deployment date or impact date from SDK presence.

## 9. MCP configuration evidence

Initial support is project-level static configuration.

Candidate files may include:

```text
.mcp.json
mcp.json
*.mcp.json
.vscode/mcp.json
.cursor/mcp.json
```

Support common object shapes such as a top-level `mcpServers` mapping when present.

Extract safely:

- config key/server ID;
- transport;
- executable basename;
- recognizable package name from command arguments;
- remote host;
- config file path.

Do not:

- execute the command;
- resolve environment placeholders;
- connect to remote HTTP/SSE servers;
- store raw arguments;
- store environment values;
- infer tool lists.

A separate explicit snapshot command could be designed later, but it is out of scope.

## 10. Raw evidence model

Every adapter emits evidence with:

- kind;
- relative file;
- normalized value;
- parser/adaptor ID;
- optional provider candidate;
- optional package;
- optional operation;
- optional endpoint;
- strength class;
- diagnostics.

Line and column may exist transiently for console/SARIF, but must not enter the lockfile.

## 11. Evidence aggregation

Group evidence by canonical provider ID.

Avoid double counting:

- package declaration and same package lock entry are related evidence, not independent proof of active use;
- ten identical host literals are not ten independent confidence boosts;
- generated files do not boost confidence;
- import plus binding-aware operation call are independent enough to support confirmed use.

## 12. Confidence rules

Use categorical rules first. Numeric internal scores are acceptable only when the user-visible mapping is deterministic and tested.

### Provider confidence

#### `possible`

Examples:

- direct package present but no import;
- provider hostname in an ambiguous string;
- unknown package alias;
- operation-like path without trusted host/context.

#### `probable`

Examples:

- direct package plus matching import;
- recognized provider host in network-call context;
- package plus recognized client construction without operation call.

#### `confirmed`

Examples:

- binding-aware recognized SDK operation call;
- recognized provider host plus method and canonical endpoint;
- explicit project-level MCP configuration;
- explicit provider client configuration plus import and host.

“Confirmed” means confirmed repository dependency evidence, not confirmed successful runtime use.

### Operation confidence

- recognized binding-aware call: confirmed;
- raw host + method + canonical path: confirmed;
- method chain without trustworthy provider binding: possible or omitted;
- package presence alone: no operation.

### Confidence floor

Provider confidence is at least the maximum confidence of any confirmed child operation/endpoint, but it may not exceed the evidence supporting the provider identity.

## 13. Negative evidence and exclusions

The engine should reduce or exclude findings in:

- documentation and Markdown;
- comments when parser can distinguish them;
- test snapshots;
- generated SDK code;
- vendored code;
- example directories when configured;
- dependency directories;
- strings assigned to obvious display/documentation fields.

Do not hide all test code by default; tests may represent real contract dependencies. Instead mark file role in transient evidence and allow config policy.

## 14. User overrides

A future config may support:

```yaml
overrides:
  providers:
    slack:
      status: ignored
      reason: unused transitive dependency
  unknowns:
    api.internal.example.com:
      provider: internal-analytics
```

For the initial release, minimal ignore-by-provider and ignore-by-path support is acceptable. Do not allow overrides to fabricate confirmed evidence.

## 15. Diagnostics

Diagnostic levels:

- `info`;
- `warning`;
- `error`.

Examples:

- unsupported Python syntax;
- malformed manifest;
- skipped oversized file;
- provider conflict;
- unknown API host;
- symlink escape;
- lockfile schema mismatch.

Diagnostics include a stable code, message, and relative file when applicable.

Example codes:

```text
DVL_SCAN_FILE_TOO_LARGE
DVL_PARSE_PACKAGE_JSON
DVL_PROVIDER_PACKAGE_CONFLICT
DVL_PATH_SYMLINK_ESCAPE
DVL_LOCK_UNSUPPORTED_VERSION
```

## 16. Performance

Optimization order:

1. prune directories early;
2. classify before reading;
3. parse manifests before source;
4. use provider package/domain indexes;
5. parse only supported source extensions;
6. bound concurrency;
7. cache parser initialization;
8. avoid retaining source text after adapter completion.

Do not sacrifice determinism or root safety for parallelism.

## 17. Security tests

Required:

- symlink to parent directory;
- path traversal in include patterns;
- huge source file;
- malformed recursive YAML;
- duplicate YAML keys;
- URL containing credentials/token;
- MCP args containing environment placeholders and secrets;
- SVG injection in provider/unknown name;
- Markdown injection;
- catastrophic pattern input;
- binary file with source extension;
- invalid Unicode path.

## 18. Precision benchmark

Maintain a small labeled fixture corpus.

For each fixture finding:

- expected provider;
- expected operation;
- expected confidence;
- expected evidence kind;
- expected absence cases.

Track:

- provider precision;
- operation precision;
- known false positives;
- known false negatives.

The first release should prioritize high precision on bundled providers. Do not claim generalized static-analysis accuracy.
