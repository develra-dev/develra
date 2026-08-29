# CLI contract

## Binary

Primary command:

```text
develra
```

Expected zero-install invocation:

```bash
npx develra
```

A scoped package may be used internally if the unscoped npm name is unavailable, but the installed binary remains `develra`.

## Global behavior

```text
develra <command> [options]
```

Global options:

```text
--root <path>          Repository root; default current directory
--config <path>        Config path; default auto-discovery
--quiet                Suppress nonessential output
--no-color             Disable ANSI color
--debug                Include debug diagnostics
--strict               Treat recoverable parse diagnostics as errors
--version
--help
```

All commands must support noninteractive CI use.

## Exit codes

Use stable exit codes:

| Code | Meaning                                                            |
| ---: | ------------------------------------------------------------------ |
|    0 | Command completed and policy passed                                |
|    1 | Unexpected internal or I/O failure                                 |
|    2 | Invalid CLI arguments, config, provider pack, or lockfile          |
|    3 | Scan/check completed but policy failed                             |
|    4 | Optional registry/network operation failed                         |
|    5 | Unsafe path or permission condition prevented a trustworthy result |

A command that finds warnings but passes policy exits 0.

## `develra scan`

### Purpose

Discover the current external-contract inventory and optionally write artifacts.

### Synopsis

```bash
develra scan [path]
```

### Options

```text
--write / --no-write             Write develra.lock; default write
--lockfile <path>                Default <root>/develra.lock
--report <path>                  Write Markdown report
--json <path>                    Write normalized JSON result
--graph <path>                   Write SVG graph
--sarif <path>                   Write SARIF
--confidence <level>             Minimum visible level; default possible
--include <glob>                 Additional include; repeatable
--exclude <glob>                 Additional exclude; repeatable
--max-file-size <bytes>          Override bounded default
```

### Default behavior

- resolves root;
- loads config;
- validates bundled provider packs;
- performs an offline scan;
- prints summary;
- writes `develra.lock`;
- never uses the registry;
- never executes repository code;
- never creates any file other than requested/default outputs.

### Console example

```text
Develra scanned 147 files

External contracts: 4

CONFIRMED  stripe
           package stripe@18.2.1
           operation checkout.sessions.create
           files src/billing/checkout.ts

PROBABLE   openai
           package openai@5.4.0
           import openai
           files src/ai/client.ts

POSSIBLE   slack
           package @slack/web-api@7.9.2
           no import or operation evidence

UNKNOWN    api.example-analytics.com
           hostname in src/analytics/client.ts

Wrote develra.lock
```

### Acceptance behavior

- Package-only Slack must not be printed as confirmed.
- Equivalent rerun must not modify the lockfile.
- `--no-write` must not modify the filesystem.
- `--json -` may write JSON to stdout; human logs then go to stderr.

## `develra check`

### Purpose

Verify that the committed lockfile matches the repository.

### Synopsis

```bash
develra check [path]
```

### Options

```text
--lockfile <path>
--fail-on <level>          none|possible|probable|confirmed; default probable
--fail-on-change <kind>    any|provider|operation|endpoint|mcp; repeatable
--json <path|->
--markdown <path>
--sarif <path>
--registry <url>          query a compatible read-only remote registry
```

### Behavior

`check`:

1. loads and validates the lockfile;
2. rescans offline;
3. normalizes both structures;
4. reports additions, removals, and changes;
5. exits 3 when selected policy is violated.

Without `--registry`, `check` does not instantiate a transport and remains
offline. With an explicit registry URL, it sends only the detected provider IDs
to the registry capabilities and changes endpoints. It does not send source,
lockfile contents, credentials, file paths, or authorization headers.

Registry URLs must use HTTPS; HTTP is accepted only for loopback development.
Responses must be JSON matching `schemas/registry-response.schema.json`, are
limited to 512 KiB each, time out after five seconds, and use bounded
pagination. A successful response distinguishes no relevant changes from
relevant changes and includes provenance in console, JSON, Markdown, and SARIF
reports. Remote findings are informational and do not change local policy.
Transport, capability, pagination, or validation failure exits 4.

Example:

```text
External contract inventory changed

+ CONFIRMED openai.responses.create
  src/ai/generate.ts

~ stripe package 17.7.0 → 18.2.1

Run `develra scan` and review develra.lock.
```

## `develra graph`

### Purpose

Render a graph from a lockfile.

### Synopsis

```bash
develra graph [path]
```

### Options

```text
--lockfile <path>
--output <path>            Required unless stdout is selected
--confidence <level>
--include-unknowns
--title <text>
```

### Graph rules

- user-controlled text is XML-escaped;
- layout is deterministic;
- no remote images, scripts, fonts, or network resources;
- output remains legible in light and dark GitHub surfaces;
- graph includes discreet “Generated by Develra” attribution with a project URL;
- graph is useful without the attribution.

## `develra providers list`

Lists bundled provider IDs, names, package aliases, and domains.

```bash
develra providers list --json
```

## `develra providers validate`

Validates one provider file or a directory.

```bash
develra providers validate providers/acme.yaml
```

Checks:

- JSON Schema validity;
- unique provider ID;
- package/domain conflicts;
- operation ID uniqueness;
- matcher support;
- fixture presence when validating bundled packs;
- safe declarative pattern restrictions.

Exit 2 on invalid input.

## `develra doctor`

Reports local environment and configuration without scanning source content.

```text
Node                  22.x
Repository root       /redacted/project
Config                develra.config.yaml
Bundled providers     12 valid
Lockfile              valid v1
Network for scan      disabled
```

Absolute paths may appear interactively in `doctor`, but never in serialized reports or lockfiles. In CI, prefer repository-relative display.

## Configuration file

Default location:

```text
develra.config.yaml
```

Example:

```yaml
version: 1

scan:
  include:
    - "src/**"
    - "apps/**"
  exclude:
    - "**/*.generated.ts"
    - "fixtures/**"
  max_file_size: 2097152
  confidence: possible

lockfile:
  path: develra.lock

policy:
  fail_on: probable
  fail_on_changes:
    - provider
    - operation
    - endpoint
    - mcp

reporters:
  markdown: develra-report.md
  graph: develra-graph.svg

privacy:
  telemetry: false
```

`privacy.telemetry` is reserved and must remain `false` in the initial release. Setting it to true should be rejected or ignored with a diagnostic until telemetry is intentionally designed.

## Output stream rules

- Human-readable primary output: stdout.
- Warnings and debug logs: stderr.
- Machine output requested as `-`: stdout exclusively; human summary moves to stderr.
- No ANSI in non-TTY output unless explicitly forced.
- Secrets and source snippets are never printed.
- File paths in reports are repository-relative.

## Stable JSON envelope

Machine-readable command output should use an envelope:

```json
{
  "schema_version": 1,
  "command": "scan",
  "status": "ok",
  "result": {},
  "diagnostics": []
}
```

Do not expose internal class names or stack traces as API fields.

## Policy semantics

`fail_on` relates to confidence of material inventory changes, not diagnostic severity.

Examples:

- `fail_on: confirmed` ignores package-only additions but fails on operation additions.
- `fail_on: probable` fails on package-plus-import additions.
- `fail_on: possible` fails on every inventory change.
- `fail_on: none` reports but never exits 3.

Removal is evaluated using the confidence of the removed item.

## Compatibility

Before 1.0, CLI flags may evolve, but breaking changes require:

- changelog entry;
- updated examples;
- tests for the new behavior;
- migration note.

After 1.0, command names, exit codes, lockfile schema, config keys, and JSON envelopes are public compatibility surfaces.
