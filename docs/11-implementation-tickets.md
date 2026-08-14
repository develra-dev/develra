# Implementation tickets

## How to use this file

Execute tickets in dependency order. A ticket is complete only when:

- implementation exists;
- tests pass;
- public behavior is documented;
- examples/schemas are updated when relevant;
- the implementation log in `docs/12-decisions-open-questions.md` is updated.

Mark completed tickets by changing `[ ]` to `[x]`.

Do not begin hosted-service work from this backlog.

---

# M0 — Repository foundation

## [x] DVL-001 — Bootstrap the workspace

**Depends on:** none

Create the pnpm workspace and recommended directory structure.

Deliver:

- root `package.json`;
- `pnpm-workspace.yaml`;
- strict shared TypeScript config;
- workspace packages for CLI, core, providers, reporters, and Action;
- `.editorconfig`;
- `.gitignore`;
- lint and formatting configuration;
- Apache-2.0 license;
- initial `README.md` based on `README_DRAFT.md`.

Required scripts:

```text
build
lint
typecheck
test
test:fixtures
package:action
verify
```

Acceptance:

- `pnpm install` succeeds;
- `pnpm build` succeeds;
- `pnpm lint` and `pnpm typecheck` succeed;
- package boundaries compile without circular dependency;
- no hosted or web application package is created.

## [x] DVL-002 — Create CLI skeleton

**Depends on:** DVL-001

Create the `develra` binary with:

- `--help`;
- `--version`;
- placeholder command registration;
- typed error-to-exit-code mapping;
- TTY/no-color handling;
- debug mode.

Acceptance:

- packaged binary runs in a subprocess;
- help lists planned commands but unimplemented commands fail clearly;
- machine-output mode can reserve stdout;
- no network dependency is present.

## [x] DVL-003 — Define core domain types

**Depends on:** DVL-001

Implement typed models for:

- confidence;
- diagnostics;
- package refs;
- endpoints;
- evidence;
- provider findings;
- MCP findings;
- unknowns;
- project summary;
- scan result;
- lockfile diff;
- policy result.

Acceptance:

- types do not import CLI or GitHub APIs;
- evidence metadata cannot directly accept arbitrary source text;
- confidence values exactly match documented strings;
- unit tests cover ordering/comparison helpers.

## [x] DVL-004 — Integrate JSON Schema validation

**Depends on:** DVL-001, DVL-003

Load and validate:

- `schemas/develra-lock.schema.json`;
- `schemas/provider.schema.json`.

Deliver reusable validators and clear validation diagnostics.

Acceptance:

- bundled examples validate;
- malformed examples fail with useful paths;
- duplicate YAML keys are rejected before schema validation;
- validation does not mutate input.

## [x] DVL-005 — Build fixture harness and CI skeleton

**Depends on:** DVL-001

Create:

- fixture repository loader;
- expected-result helper;
- golden-file update command requiring explicit flag;
- CI workflow for build/lint/typecheck/test;
- supported OS/Node matrix.

Acceptance:

- tests never use public network;
- fixture roots are isolated temporary directories;
- golden updates cannot run accidentally during ordinary tests;
- CI can run the packaged CLI smoke test.

---

# M1 — Safe offline inventory

## [x] DVL-010 — Implement root-safe filesystem walker

**Depends on:** DVL-003, DVL-005

Implement:

- real-root resolution;
- root containment;
- symlink escape rejection;
- bounded file count and file size;
- default directory ignores;
- `.gitignore`;
- `.develraignore`;
- config/CLI include and exclude hooks;
- POSIX relative paths.

Acceptance:

- symlink and traversal security fixtures pass;
- ignored dependency/build directories are not traversed;
- enumeration order can be injected/randomized;
- no file is read before size/type checks;
- walker exposes no absolute path in normalized results.

## [x] DVL-011 — Implement file classification

**Depends on:** DVL-010

Classify:

- npm manifests/lockfiles;
- Python manifests/lockfiles;
- JS/TS source;
- Python source;
- MCP config;
- generic bounded text;
- binary/generated/unsupported.

Acceptance:

- minified/generated heuristics are tested;
- binary content with source extension is skipped safely;
- classification is deterministic;
- unsupported files do not create noisy diagnostics.

## [x] DVL-012 — Parse npm manifests

**Depends on:** DVL-003, DVL-010, DVL-011

Parse `package.json` dependencies, devDependencies, optionalDependencies, and peerDependencies.

Emit package evidence with directness and declared version.

Acceptance:

- malformed JSON creates diagnostic and continues;
- duplicate keys are rejected;
- scripts are never executed;
- package names are normalized;
- source file remains unmodified.

## [x] DVL-013 — Parse npm lockfiles

**Depends on:** DVL-012

Support reliable resolved direct versions from:

- `package-lock.json`;
- `pnpm-lock.yaml`;
- `yarn.lock` only when a robust bounded parser is selected.

Do not block M1 on every lock format. Document supported versions.

Acceptance:

- lockfile version precedence is tested;
- transitive packages do not become direct;
- parser failure falls back to manifest evidence with a diagnostic;
- no package-manager process is launched.

## [x] DVL-014 — Parse Python manifests

**Depends on:** DVL-003, DVL-010, DVL-011

Support:

- `pyproject.toml` common dependency tables;
- `requirements*.txt`;
- `Pipfile` if a safe parser is readily available.

Acceptance:

- environment markers and version ranges are preserved safely;
- editable/local path dependencies do not escape root or execute;
- malformed files create diagnostics and continue;
- exact ecosystem normalization is tested.

## [ ] DVL-015 — Parse Python lockfiles where reliable

**Depends on:** DVL-014

Implement only lock formats with a reliable parser and fixture coverage. It is acceptable to defer a format rather than parse it incorrectly.

Acceptance:

- supported formats are documented;
- resolved direct version behavior is tested;
- unsupported formats create at most one concise diagnostic;
- no environment creation or package-manager command.

## [x] DVL-016 — Parse project-level MCP configuration

**Depends on:** DVL-003, DVL-010, DVL-011

Recognize documented project config paths and common `mcpServers`-style shapes.

Extract only:

- server key/normalized ID;
- transport;
- executable basename;
- recognizable package;
- remote host;
- config file path.

Acceptance:

- commands are never executed;
- environment values and raw secret-like args are not serialized;
- absolute executable paths are reduced or omitted;
- unknown shapes produce diagnostics without crashing;
- MCP findings use `confirmed` only to mean configured dependency.

## [x] DVL-017 — Compose initial scan service

**Depends on:** DVL-010 through DVL-016

Create scan orchestration for manifests and MCP config.

Acceptance:

- service returns normalized candidates and diagnostics;
- offline network transport is not instantiated;
- cancellation/abort signal is supported where practical;
- fixture scan completes with no reporter dependency.

---

# M2 — Provider packs and source evidence

## [x] DVL-020 — Implement provider-pack loader

**Depends on:** DVL-004, DVL-017

Load bundled YAML packs, validate, normalize, and build indexes.

Indexes:

- ecosystem/package;
- domain;
- language/import source;
- language/package/member chain;
- method/path endpoint.

Acceptance:

- conflicts are deterministic errors;
- provider YAML executes no code;
- unsupported matcher kinds fail validation;
- indexes are immutable after load.

## [ ] DVL-021 — Add provider template and first three packs

**Depends on:** DVL-020

Add high-quality packs for:

- Stripe;
- OpenAI;
- Anthropic.

Each requires package, import, operation, negative, and expected-result fixtures.

Acceptance:

- package-only does not become confirmed;
- at least two operation matchers per provider where verified;
- package names and SDK shapes are sourced from official current documentation before merge;
- placeholder contract-source URLs are not shipped.

## [x] DVL-022 — Implement JS/TS import and binding detection

**Depends on:** DVL-010, DVL-011, DVL-020

Use a syntax parser to detect:

- ESM imports;
- CommonJS require;
- aliases;
- selected literal dynamic imports;
- client construction bindings needed for operation calls.

Acceptance:

- no module resolution or execution;
- comments/strings do not count as imports;
- aliases work;
- unrelated same-name identifiers do not map to providers;
- malformed file warning does not abort scan.

## [x] DVL-023 — Implement Python import and binding detection

**Depends on:** DVL-010, DVL-011, DVL-020

Detect:

- `import package`;
- `import package as alias`;
- `from package import Name`;
- simple client construction bindings.

Acceptance:

- no Python import or subprocess;
- aliases work;
- comments/strings do not count;
- syntax errors are recoverable;
- unrelated names do not map.

## [x] DVL-024 — Implement binding-aware operation matching

**Depends on:** DVL-021, DVL-022, DVL-023

Match declarative `member-call` and `function-call` patterns only when provider binding evidence is trustworthy.

Acceptance:

- positive JS/TS and Python fixtures;
- negative unrelated-client fixtures;
- simple alias propagation;
- no whole-program analysis;
- operation evidence includes provider ID, canonical operation ID, confidence basis, and relative file.

## [x] DVL-025 — Implement hostname and URL evidence

**Depends on:** DVL-010, DVL-011, DVL-020

Extract bounded string literals in likely network contexts and a weaker generic fallback.

Acceptance:

- credentials/query/fragment are removed;
- docs/comments do not become strong evidence;
- known provider host maps correctly;
- unknown host is preserved;
- secret-like URL fixtures do not leak.

## [x] DVL-026 — Implement selected raw HTTP endpoint matching

**Depends on:** DVL-021, DVL-025

Detect method/path for common JS/TS and Python HTTP-call shapes.

Acceptance:

- provider host + method + path can become confirmed;
- path alone is not confirmed;
- dynamic unresolved path remains possible or omitted;
- query parameters do not enter endpoint key;
- `{parameter}` normalization is deterministic.

## [x] DVL-027 — Implement API-version detection

**Depends on:** DVL-020, DVL-022, DVL-023

Support declarative literal detectors for selected providers.

Acceptance:

- literal values only enter lockfile;
- environment variable values are not read;
- package version is not silently treated as API version;
- Stripe-like override behavior does not produce an unjustified effective-date claim;
- tests cover redaction.

## [ ] DVL-028 — Add remaining initial provider packs

**Depends on:** DVL-024 through DVL-027

Add verified packs for:

- GitHub;
- Slack;
- Shopify;
- Twilio;
- Resend;
- Clerk;
- Supabase.

Acceptance:

- each pack has positive and negative fixtures;
- at least package/import/domain support;
- operation matchers only where verified;
- all semantic indexes remain conflict-free;
- provider list is documented.

## [x] DVL-029 — Implement evidence aggregation and confidence engine

**Depends on:** DVL-017, DVL-020 through DVL-028

Aggregate related evidence and assign documented confidence.

Acceptance:

- package-only possible;
- package + import probable;
- binding-aware operation confirmed;
- host + method + canonical path confirmed;
- duplicate weak evidence does not inflate confidence;
- provider confidence respects child evidence;
- user-facing rationale can be generated without source snippets.

---

# M3 — Lockfile, diff, and reports

## [x] DVL-030 — Implement normalized scan result

**Depends on:** DVL-029

Create canonical normalization:

- deduplicate;
- stable provider/operation/endpoint IDs;
- POSIX relative paths;
- stable sorting;
- no line numbers or snippets in serialized model;
- unknown preservation.

Acceptance:

- normalization is idempotent;
- randomized evidence order yields identical result;
- Windows path fixture matches POSIX golden;
- all result objects validate internal invariants.

## [x] DVL-031 — Implement lockfile serializer/parser

**Depends on:** DVL-004, DVL-030

Implement `develra.lock` read/write against schema.

Acceptance:

- byte-identical repeated output;
- canonical key order;
- LF endings;
- no timestamp;
- no `null`;
- atomic write;
- invalid existing lockfile is not silently overwritten by `check`;
- examples validate.

## [x] DVL-032 — Implement `scan` command

**Depends on:** DVL-002, DVL-031

Wire root resolution, config, scan, normalization, console, and optional outputs.

Acceptance:

- default writes lockfile;
- `--no-write` modifies nothing;
- no network path;
- JSON stdout reserves stdout;
- clear summary and confidence labels;
- expected exit codes.

## [x] DVL-033 — Implement lockfile diff and `check`

**Depends on:** DVL-031, DVL-032

Compare current scan with lockfile.

Acceptance:

- additions/removals/version/operation/endpoint/MCP changes;
- confidence-threshold policy;
- no raw YAML text diff;
- remediation command shown;
- unchanged inventory exits 0;
- policy failure exits 3;
- invalid lockfile exits 2.

## [x] DVL-034 — Implement JSON and Markdown reporters

**Depends on:** DVL-030

Deliver:

- stable JSON envelope;
- human Markdown report;
- escaped user/provider content;
- diagnostics section;
- evidence files.

Acceptance:

- schemas or stable fixture contracts;
- no absolute paths;
- no source snippets;
- deterministic output apart from explicitly excluded timing in interactive console;
- Markdown table injection fixture passes.

## [x] DVL-035 — Implement SVG graph reporter

**Depends on:** DVL-030

Generate a deterministic, standalone SVG.

Acceptance:

- no script/external resources;
- XML escaping;
- readable confirmed/probable/possible distinction without color alone;
- repository center and provider nodes;
- optional unknowns;
- discreet attribution;
- deterministic layout;
- fixture renders as valid XML.

## [x] DVL-036 — Implement SARIF reporter

**Depends on:** DVL-030, DVL-033

Emit SARIF 2.1.0 compatible with GitHub's supported subset.

Acceptance:

- stable rule IDs;
- stable fingerprints;
- repository-relative locations;
- bounded result count;
- confidence-to-level mapping;
- valid fixture;
- no SARIF-only dependency in core scanner.

## [x] DVL-037 — Implement `graph`, `providers`, and `doctor` commands

**Depends on:** DVL-020, DVL-031, DVL-035

Deliver command behavior specified in CLI contract.

Acceptance:

- provider validation reports all practical errors;
- graph can use lockfile without rescan;
- doctor does not scan source content;
- outputs obey stdout/stderr rules;
- exit codes tested.

## [x] DVL-038 — Add configuration loader

**Depends on:** DVL-032, DVL-033

Implement `develra.config.yaml` with documented precedence.

Acceptance:

- schema validation;
- unknown keys warning or error policy;
- include/exclude/root-safe behavior;
- telemetry cannot be enabled;
- policy values map exactly;
- config paths remain inside root where required.

---

# M4 — GitHub Action

## [x] DVL-040 — Implement Action wrapper

**Depends on:** DVL-033, DVL-034, DVL-036, DVL-038

Map Action inputs to core/CLI behavior.

Acceptance:

- only documented input values;
- root/output containment;
- job summary always attempted;
- outputs set;
- policy failure distinguished from internal error;
- no comments/issues/commits.

## [x] DVL-041 — Add root `action.yml`

**Depends on:** DVL-040

Create metadata and examples.

Acceptance:

- metadata validates;
- Action name/description are accurate;
- core usage requires only `contents: read`;
- paths point to bundled entry;
- repository contains one Marketplace-listed root action metadata file.

## [x] DVL-042 — Bundle and verify Action

**Depends on:** DVL-040, DVL-041

Implement deterministic bundling and stale-bundle check.

Acceptance:

- bundle runs without workspace install in fixture;
- no dev/test dependencies at runtime;
- CI fails on stale bundle;
- source maps do not leak local paths;
- license notices handled.

## [x] DVL-043 — Add Action integration fixtures

**Depends on:** DVL-042

Test:

- unchanged pass;
- probable change fail;
- possible change pass at default threshold;
- invalid lockfile;
- output files;
- summary escaping;
- path escape rejection;
- optional SARIF artifact.

Acceptance:

- packaged Action smoke passes in CI;
- no public network;
- expected outputs and exit statuses verified.

## [x] DVL-044 — Add release workflow skeleton

**Depends on:** DVL-042

Create non-publishing validation workflow and release checklist.

Acceptance:

- tags/releases are not automatically published without owner action;
- Action bundle and package contents are verified;
- semantic version source is single and documented;
- moving major tag is documented but not silently changed.

---

# M5 — Public repository polish

## [x] DVL-050 — Finalize README and demo fixture

**Depends on:** M0–M4

Replace draft examples with real output.

Acceptance:

- quick start works exactly;
- privacy statement is prominent;
- confidence wording is precise;
- graph screenshot/embed is generated by real tool;
- no future capability presented as shipped;
- user reaches useful output in under five minutes.

## [x] DVL-051 — Create provider contribution workflow

**Depends on:** DVL-028, DVL-037

Deliver:

- provider template;
- contribution guide;
- fixture guide;
- validation command;
- PR checklist;
- issue template for unsupported provider;
- good-first-issue examples.

Acceptance:

- a test provider can be added without core code;
- official evidence is requested;
- negative fixture is mandatory;
- CI scopes useful failure messages to provider.

## [x] DVL-052 — Add Breakage Museum starter corpus

**Depends on:** DVL-033, DVL-034

Add a small licensed/synthetic corpus covering at least:

- removed field;
- required-field change;
- enum change;
- endpoint/operation change;
- MCP input-schema change.

Acceptance:

- each case documents expected behavior;
- cases can be run as regression fixtures;
- no proprietary source copied improperly;
- corpus remains in main repository.

## [x] DVL-053 — Add repository community files

**Depends on:** DVL-050, DVL-051

Create:

- `CONTRIBUTING.md`;
- `CODE_OF_CONDUCT.md`;
- issue templates;
- pull-request template;
- security policy;
- changelog;
- roadmap link.

Acceptance:

- security policy describes private reporting;
- templates do not ask for secrets or private code;
- bug template asks for minimal reproducible fixture;
- provider template asks for official source links.

## [x] DVL-054 — Prepare launch artifacts

**Depends on:** DVL-050 through DVL-053

Prepare without publishing:

- terminal-recording script/source;
- sample SVG;
- Show HN draft;
- technical launch article outline;
- Marketplace copy;
- first release notes;
- 5–10 good first issues.

Acceptance:

- claims match shipped behavior;
- no paid-monitoring claim;
- star request follows demonstrated value;
- no spam or automated outreach workflow.

## [x] DVL-055 — Run release candidate audit

**Depends on:** all M0–M5 tickets

Run the full release checklist.

Acceptance:

- `pnpm verify` passes;
- packaged CLI and Action smoke pass;
- schemas/examples agree;
- offline network tests pass;
- security fixtures pass;
- no absolute paths or secrets in package/artifacts;
- all known limitations are documented;
- no public publishing is performed without owner authorization.

---

# M6 — Optional public registry boundary

## [ ] DVL-060 — Define registry types and no-op implementation

**Depends on:** DVL-030

Add the abstract registry interface and `NoopRegistry`.

Acceptance:

- default scan/check behavior unchanged;
- no HTTP library required in core;
- registry data models carry provenance and confidence;
- remote capability is explicit.

## [ ] DVL-061 — Add fixture registry

**Depends on:** DVL-060

Create local upstream snapshots and changes.

Acceptance:

- tests map changes to provider/operation inventory;
- provider-only relevance is worded as uncertain;
- operation match is worded as stronger evidence;
- no LLM required.

## [ ] DVL-062 — Add optional `check --registry`

**Depends on:** DVL-061

Implement registry mode behind explicit option.

Acceptance:

- registry failure exits 4;
- no-change and unavailable are distinct;
- remote content is bounded/validated;
- offline mode never instantiates transport;
- reports show source provenance.

## [ ] DVL-063 — Draft public registry API contract

**Depends on:** DVL-060

Create an OpenAPI description for future endpoints without building the service.

Acceptance:

- only required public/client capabilities;
- no authentication/billing endpoints yet;
- versioned response envelope;
- pagination/caching/error semantics;
- schema fixtures.

---

# Deferred hosted backlog

Do not implement under this handoff:

- continuous pollers;
- FastAPI service;
- ARQ jobs;
- Neon schema;
- AI classification;
- Clerk;
- Lemon Squeezy;
- Resend alerts;
- hosted dashboard.

These should receive a separate design and authorization after the OSS release.
