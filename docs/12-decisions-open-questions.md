# Decisions, defaults, and open questions

## Purpose

This document distinguishes:

- product decisions already made;
- implementation defaults chosen to unblock work;
- questions that may be revisited without blocking the first release;
- implementation log entries created by Sol.

When a material decision changes, add an ADR-style entry rather than silently rewriting history.

---

# Accepted product decisions

## ADR-001 — Build Develra first

**Status:** accepted

Build on `develra.dev`. Hold `diffused.xyz` as a fallback option and `omnigami.ai` as a premium reserve. The first build is Develra's open-source external-contract scanner and lockfile.

## ADR-002 — The directory is an acquisition layer, not the moat

**Status:** accepted

Do not center the product on public API changelog pages. Personalized mapping from upstream contracts to repository inventory is the eventual paid direction.

## ADR-003 — Optimize the first release for OSS usefulness and authentic GitHub growth

**Status:** accepted

The founder accepts the risk of building beyond immediate validated usage and does not require a paid concierge pilot. The project may therefore invest in polished artifacts, Action support, provider contributions, and a Breakage Museum before revenue validation.

## ADR-004 — Local-first scanner

**Status:** accepted

Default `scan` is offline, accountless, and source-private.

## ADR-005 — External-contract lockfile

**Status:** accepted

The main open-source artifact is `develra.lock`, representing external providers, packages, versions, operations, endpoints, MCP configuration, unknowns, and confidence.

## ADR-006 — Installation is not impact

**Status:** accepted

A package being installed is weak evidence. User-facing output must distinguish possible, probable, and confirmed repository dependency evidence. It must not claim that an upstream change will break an application without appropriate mapping.

## ADR-007 — MCP is one contract type

**Status:** accepted

Support MCP configuration and later schema drift, but do not make the entire project MCP-only.

## ADR-008 — One repository

**Status:** accepted

Keep CLI, Action, provider packs, reporters, examples, schemas, and breakage corpus in one public repository initially.

## ADR-009 — No fake star tactics

**Status:** accepted

Only authentic GitHub growth through useful software, artifacts, Marketplace, content, and contribution.

---

# Implementation defaults

## ADR-010 — TypeScript/Node for the OSS scanner

**Status:** default; revisit only with strong evidence

Use TypeScript and Node for:

- natural `npx` onboarding;
- JavaScript Action packaging;
- TypeScript source analysis;
- a single language across CLI and Action.

Python repository analysis uses a syntax parser; it does not import target modules.

## ADR-011 — pnpm workspace

**Status:** default

One repository with internal packages.

## ADR-012 — Apache-2.0

**Status:** default

Apache-2.0 is recommended for a developer tool with explicit patent terms. The owner may choose MIT before public release. Do not publish until license choice is intentional.

## ADR-013 — YAML lockfile, JSON Schema contract

**Status:** default

Human-facing lockfile is YAML. Schemas use JSON Schema Draft 2020-12.

## ADR-014 — No timestamps or line numbers in the lockfile

**Status:** accepted

This reduces noisy diffs. Transient reports may include line locations when safely available.

## ADR-015 — Declarative provider packs without arbitrary regex or code

**Status:** accepted

Initial matching primitives are exact structured values and fixed engine semantics. This reduces security and maintenance risk.

## ADR-016 — Do not execute MCP servers

**Status:** accepted

Initial MCP support parses static project configuration only.

## ADR-017 — SARIF is optional

**Status:** accepted

Develra emits SARIF, but Markdown/job summary remains the universal GitHub surface because code-scanning availability varies.

## ADR-018 — Future hosted stack may reuse Maraudr infrastructure

**Status:** directional

Likely future stack:

- FastAPI;
- ARQ;
- Neon/PostgreSQL;
- batch LLM classification;
- Resend;
- Clerk;
- Lemon Squeezy.

Do not introduce these dependencies into the local scanner.

---

# Open questions with non-blocking defaults

## OQ-001 — Final npm package name

**Resolution candidate:** use the unscoped npm package and binary name
`develra`. A read-only registry lookup on 2026-08-12 returned `404 Not Found`,
so the name appeared available but was not reserved. Check again immediately
before first publication.

Before release, verify namespace/package availability and ownership.

## OQ-002 — Minimum and current Node versions

**Default:** the CLI supports Node.js 22+; CI tests Node.js 22 and 24. The GitHub Action uses `runs.using: node24`.

The GitHub Action's `runs.using` must match currently supported GitHub Action runtimes, verified before release.

The `node24` metadata value was re-verified against GitHub's official metadata
reference on 2026-08-12.

## OQ-003 — Exact parser libraries

**Default:** choose established bounded libraries with cross-platform support.

Selection requirements:

- no execution of target code;
- active maintenance;
- ESM compatibility;
- acceptable Action bundle;
- fixture coverage;
- no avoidable native-install fragility.

Record selected libraries and rationale below.

## OQ-004 — Lockfile evidence files

**Default:** include repository-relative file paths but no line numbers.

If this creates excessive churn, consider moving detailed files to a separate report in a future lockfile version. Do not remove them silently after public adoption.

## OQ-005 — Initial provider operation depth

**Default:** only merge verified high-confidence operations. A provider pack may launch with package/import/domain support and no operation matchers.

Accuracy is more important than equal feature count.

## OQ-006 — First-scan star request

**Default:** do not implement until the core product is useful. If implemented, show at most once in an interactive successful scan, never gate features, and provide a suppression mechanism.

## OQ-007 — Anonymous telemetry

**Default:** none.

Use public GitHub/npm metrics and explicit hosted opt-in until a separate privacy review.

## OQ-008 — Monorepo scanning

**Default:** scan the requested root as one project and preserve file paths. Workspace-level segmentation is deferred unless fixtures demonstrate a simple, valuable design.

## OQ-009 — Graph layout

**Default:** deterministic lightweight layout implemented locally. Do not add a browser/headless rendering dependency solely for v0.1.

## OQ-010 — Registry API implementation

**Default:** interface and fixture only after M0–M5. No service deployment.

---

# Implementation log

Add entries in this format:

```markdown
## YYYY-MM-DD — DVL-XXX — Short title

- Decision or implementation summary:
- Alternatives considered:
- Validation run:
- Known limitation:
- Follow-up ticket:
```

## 2026-08-11 — DVL-001–005 — Offline TypeScript workspace

- Decision or implementation summary: Created a strict pnpm workspace for the
  core scanner, provider catalog, reporters, CLI, and bundled Action. Added
  schemas, examples, cross-platform CI, formatting, linting, and an Apache-2.0
  license without a hosted application.
- Alternatives considered: A single package would be smaller initially, but
  explicit package boundaries keep GitHub-specific and reporter dependencies
  out of the scanner core.
- Validation run: `pnpm install`, `pnpm lint`, `pnpm typecheck`, and
  `pnpm build`.
- Known limitation: The npm package name and Action runtime still require owner
  verification immediately before publishing.
- Follow-up ticket: DVL-044.

## 2026-08-11 — DVL-010–017 — Root-safe repository inventory

- Decision or implementation summary: Added a bounded, sorted walker with
  ignore support, symlink containment, secret-file exclusions, manifest
  parsing, static MCP parsing, cancellation hooks, and recoverable diagnostics.
- Alternatives considered: Launching package managers or language runtimes was
  rejected because it would violate offline scanning and execute repository
  behavior.
- Validation run: Security unit tests and TypeScript, Python, and MCP repository
  fixtures.
- Known limitation: Yarn and resolved Python lockfile support are intentionally
  deferred until bounded parsers and fixtures are selected.
- Follow-up ticket: DVL-015.

## 2026-08-11 — DVL-020–029 — Declarative provider detection

- Decision or implementation summary: Added schema-validated YAML provider
  packs, semantic conflict checks, TypeScript compiler API parsing, Lezer-based
  Python parsing, binding-aware SDK operations, raw HTTP endpoint matching,
  webhook-like URL discovery, API versions, and conservative confidence
  aggregation.
- Alternatives considered: Arbitrary provider regex and code hooks were
  rejected in favor of fixed declarative matcher kinds.
- Validation run: Ten bundled packs validate; positive alias, negative binding,
  endpoint, API-version, webhook, and secret-redaction fixtures pass.
- Known limitation: Analysis is intentionally shallow and intra-file; dynamic
  values and custom domains remain possible/unknown instead of being guessed.
- Follow-up ticket: Expand DVL-028 fixtures as provider coverage grows.

## 2026-08-11 — DVL-030–038 — Lockfile and review surfaces

- Decision or implementation summary: Implemented normalized results,
  canonical YAML serialization, atomic writes, structural diff policy, config
  precedence, and console, JSON, Markdown, standalone SVG, and bounded SARIF
  reporters.
- Alternatives considered: Raw YAML text diffs were rejected because they
  produce noisy policy results and make confidence filtering unreliable.
- Validation run: Byte-identical golden scans, CLI subprocess tests, schema
  examples, Markdown injection tests, and XML escaping tests.
- Known limitation: Lockfile schema version 1 stores evidence files but not line
  numbers or source snippets by design.
- Follow-up ticket: Revisit evidence granularity only in a versioned schema.

## 2026-08-11 — DVL-040–043 — Standalone GitHub Action

- Decision or implementation summary: Added root Action metadata, read-only
  scan/check behavior, contained artifacts, job summaries, outputs, policy
  failure handling, and a checked-in Node bundle with provider data included.
- Alternatives considered: Installing the CLI during the workflow was rejected
  because it adds a runtime network and registry dependency.
- Validation run: The bundle runs from an unrelated working directory against
  temporary repositories and passes scan, policy-failure, and traversal tests.
- Known limitation: Release publishing and moving-major-tag automation remain
  owner-controlled and are not implemented.
- Follow-up ticket: DVL-044.

## 2026-08-11 — DVL-050–055 — Repository and package polish

- Decision or implementation summary: Replaced draft claims with real fixture
  output, documented privacy and limitations, added community templates, and
  built the npm CLI as a self-contained bundle with embedded provider packs.
- Alternatives considered: Publishing workspace packages separately was
  rejected for v0.1 because a single packed CLI provides a more reliable `npx`
  path.
- Validation run: The packed tarball is installed in a temporary npm project
  with offline mode, scans and checks a fixture, reproduces identical lockfile
  bytes, and is checked for secrets, absolute temporary paths, and runtime
  dependencies.
- Known limitation: No npm package, GitHub release, Marketplace listing, or
  hosted service has been published by this implementation.
- Follow-up ticket: DVL-044 and owner release review.

## 2026-08-12 — DVL-044 — Owner-controlled release validation

- Decision or implementation summary: Set `develra-dev/develra` as the
  canonical repository; made `apps/cli/package.json` the sole publishable
  release-version source (private packages use a fixed `0.0.0-private` workspace
  sentinel); added repository-aware npm metadata, an exact tarball and Action
  audit, a manual non-publishing validation workflow, v0.1.0 notes, and a
  private-to-public owner checklist.
- Alternatives considered: Automated npm publishing and moving-tag workflows
  were deferred so the first public release cannot occur without explicit owner
  review. A `v0` Action channel matches the current `0.1.0` compatibility
  status; `v1` is reserved for an intentional 1.0 commitment.
- Validation run: `pnpm release:validate`; the audit installs and exercises the
  packed CLI offline, checks the committed Action bundle, validates allowlisted
  package contents, and scans artifacts for secrets and local absolute paths.
- Known limitation: The npm name is not reserved until publication. Branch
  protection is unavailable while the repository remains private on the
  current GitHub plan.
- Follow-up ticket: DVL-054, then DVL-055 and branch protection after the
  repository becomes public or the GitHub plan changes.

## 2026-08-12 — Private repository bootstrap and cross-platform CI hardening

- Decision or implementation summary: Initialized `main`, audited and pushed
  the source tree to the private canonical repository, committed Develra's own
  deterministic lockfile, enforced LF checkouts, made fixture copying and
  package-manager subprocesses cross-platform, and allowed realistic packaged
  build time under shared-runner load.
- Alternatives considered: Committing internal workspace build outputs was
  rejected because CI reproduces them; only the standalone Action bundle is
  committed. Shelling out to Unix `cp` and launching Windows `.cmd` files
  directly were replaced with Node filesystem APIs and a constrained command
  wrapper.
- Validation run: GitHub Actions runs `31669754426` (CI), `31669754422`
  (external-contract enforcement), and `31670089953` (manual release
  validation) passed. The release artifact and committed Action checksums match
  the downloaded manifest.
- Known limitation: GitHub returned HTTP 403 for private-repository branch
  protection on the current plan. No visibility change, npm publication, tag,
  GitHub release, or Marketplace publication was performed.
- Follow-up ticket: DVL-054; enable branch protection immediately after the
  repository becomes public or the plan supports it.
