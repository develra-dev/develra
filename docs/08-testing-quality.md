# Testing and quality plan

## Quality objective

Develra handles untrusted source trees and produces a committed artifact. A false confirmed finding, privacy leak, non-deterministic lockfile, or unsafe path traversal is more damaging than a missed low-confidence integration.

Testing prioritizes:

1. trust and safety;
2. deterministic serialization;
3. detection precision;
4. cross-platform behavior;
5. useful failure messages;
6. performance.

## Test layers

## Unit tests

Cover pure behavior:

- path normalization;
- ignore precedence;
- manifest parsing;
- package normalization;
- provider indexing;
- evidence aggregation;
- confidence rules;
- lockfile canonicalization;
- diff semantics;
- policy thresholds;
- output escaping;
- exit-code mapping.

Use table-driven tests where possible.

## Adapter tests

Each adapter receives isolated fixtures and emits normalized raw evidence.

Examples:

- npm manifest with dependencies/devDependencies/peerDependencies;
- pnpm/yarn/npm lock data;
- Python requirements variants;
- TypeScript aliases;
- CommonJS imports;
- Python aliases;
- malformed syntax;
- MCP config variants;
- raw HTTP calls;
- URLs in comments versus calls.

Adapter tests must not rely on installed fixture dependencies.

## Provider tests

Every provider pack must pass:

- schema validation;
- semantic conflict validation;
- package-only fixture;
- import fixture;
- selected operation fixture;
- negative fixture;
- expected confidence;
- deterministic result.

Provider fixture failures block merge.

## Golden repository fixtures

Create realistic small repositories:

```text
fixtures/repositories/
├── ts-saas/
├── python-service/
├── mixed-monorepo/
├── mcp-project/
├── unknown-hosts/
├── malformed/
└── adversarial/
```

Each has:

- source files;
- manifests/lockfiles;
- config;
- expected normalized result;
- expected lockfile;
- expected Markdown;
- expected graph where stable.

Avoid real secrets and copyrighted application code.

## Snapshot policy

Snapshots are appropriate for:

- lockfile bytes;
- normalized JSON;
- Markdown report;
- selected SVG structure;
- CLI output with volatile values removed.

Snapshots must be reviewed. Do not update all snapshots blindly.

Duration, absolute temporary path, runtime version, and terminal width must not enter stable snapshots.

## Determinism tests

Required:

- scan same fixture twice;
- reverse filesystem enumeration;
- randomize evidence emission order;
- run with Windows-style internal paths;
- run with different locale/timezone;
- run with color enabled/disabled;
- run with concurrency 1 and default concurrency.

Lockfile bytes must match.

## Property and fuzz tests

Use bounded property tests for:

- path normalization never yields absolute/parent traversal;
- sort order is total and stable;
- normalization is idempotent;
- parse/serialize/parse preserves meaning;
- arbitrary provider strings are escaped in Markdown/SVG;
- arbitrary URLs do not leak credentials/query secrets;
- malformed YAML/JSON fails safely.

Do not let fuzz tests make CI unpredictable; use fixed seeds and bounded cases.

## Security fixtures

Include:

- symlink escaping root;
- nested symlink loop;
- file larger than limit;
- binary file named `.ts`;
- YAML duplicate keys;
- deeply nested YAML/JSON;
- malicious SVG provider name;
- Markdown table injection;
- URL with `user:password@host`;
- URL query containing token;
- MCP config with token-like arguments;
- `.env` references;
- huge generated directory;
- weird Unicode and reserved Windows names.

Expected behavior must be explicit.

## Precision fixtures

Maintain labeled findings:

```json
{
  "expected": [
    {
      "provider": "openai",
      "operation": "responses.create",
      "confidence": "confirmed"
    }
  ],
  "forbidden": [
    {
      "provider": "stripe",
      "operation": "checkout.sessions.create"
    }
  ]
}
```

A provider cannot be merged based only on positive examples.

## CLI integration tests

Run packaged CLI in subprocesses.

Cases:

- `--help`;
- `--version`;
- scan and write;
- scan `--no-write`;
- JSON to stdout;
- invalid config;
- local check pass;
- local check policy fail;
- graph output;
- provider validate;
- doctor;
- no-color/non-TTY behavior;
- expected exit codes.

Verify no files beyond requested outputs are modified.

## Network isolation test

Default scan and local check must run in a test environment where network calls fail immediately.

Additionally, inject a transport factory that throws if instantiated. The offline code path should never instantiate it.

## Action tests

See `docs/07-github-action.md`.

Use a local runner harness or invoke the bundled Action entry with mocked GitHub environment variables. Also maintain a real workflow smoke test in the repository after the Action is stable.

## Cross-platform CI

Recommended matrix:

- Ubuntu;
- macOS;
- Windows.

Node versions:

- minimum supported;
- current active LTS selected by the project.

Run the full unit and fixture suite on Ubuntu. Run build, representative tests, and packaged CLI smoke on macOS and Windows if CI cost becomes material.

## Quality commands

Expected:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:fixtures
pnpm build
pnpm package:action
```

A combined command may be added:

```bash
pnpm verify
```

It must run all release-blocking checks.

## Coverage

Use coverage as a diagnostic, not a vanity target.

Minimum expectations:

- high branch coverage in normalization, confidence, lockfile, and policy modules;
- every provider matcher primitive has positive and negative tests;
- every exit code has an integration test;
- security boundaries have direct tests.

Do not add low-value tests merely to satisfy a global percentage.

## Performance benchmark

Create a generated fixture of approximately 1,000 representative source files.

Benchmark:

- discovery;
- parsing;
- normalization;
- total scan;
- peak memory if practical.

Store benchmark code, not machine-specific pass numbers. CI may enforce a generous ceiling to catch catastrophic regressions.

Profile before optimizing.

## Diagnostics quality

Tests should assert:

- stable diagnostic code;
- concise message;
- repository-relative file;
- no stack trace by default;
- no source snippet or secret;
- helpful remediation where known.

Example:

```text
DVL_PARSE_PACKAGE_JSON package.json: Invalid JSON; skipped npm manifest evidence.
```

## Release checklist

Before a release:

- [ ] schemas validate examples;
- [ ] all bundled provider fixtures pass;
- [ ] lockfile determinism tests pass;
- [ ] network isolation tests pass;
- [ ] security fixtures pass;
- [ ] CLI package smoke passes;
- [ ] Action bundle is current;
- [ ] Action fixture passes;
- [ ] README commands match real behavior;
- [ ] changelog describes compatibility changes;
- [ ] generated reports contain no absolute paths;
- [ ] package contents contain no fixture secrets or private source;
- [ ] license files are present;
- [ ] no public publishing action has occurred without owner approval.

## Bug severity

### Release blocker

- source or secret leak;
- code/MCP execution;
- path escape;
- default network access;
- non-deterministic lockfile;
- invalid confirmed finding in a core fixture;
- corrupt lockfile rewrite;
- Action requiring unexpected write permission.

### High

- common repository crash;
- incorrect local check result;
- provider conflict silently resolved;
- broken Windows paths;
- unusable report output.

### Medium

- missed supported operation;
- weak diagnostic;
- graph layout defect;
- uncommon manifest form unsupported.

### Low

- cosmetic terminal issue;
- optional metadata omission;
- documentation polish.
