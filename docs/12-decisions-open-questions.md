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

Build on `develra.dev`. The first build is Develra's open-source external-contract scanner and lockfile.

## ADR-002 — The directory is an acquisition layer, not the moat

**Status:** accepted

Do not center the product on public API changelog pages. Personalized mapping from upstream contracts to repository inventory is the eventual paid direction.

## ADR-003 — Optimize the first release for OSS usefulness and authentic GitHub growth

**Status:** accepted

The project may invest in polished artifacts, Action support, provider contributions, and a Breakage Museum before revenue validation while keeping hosted complexity behind demonstrated open-source use.

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

## 2026-08-13 — DVL-054 — Static launch website

- Decision or implementation summary: Added an original, responsive one-page
  website that demonstrates scan, lock, and Action workflows with only local
  HTML, CSS, JavaScript, SVG, and self-hosted OFL-licensed Geist font assets.
  Added budgeted link and asset validation, a zero-dependency local preview
  server, a social card, and a checked-in Vercel configuration that validates
  and deploys only the static site without installing dependencies. A later
  visual pass removed eyebrow labels, tightened and lightened headline type,
  and used two optimized owner-supplied GPTypo gradient crops in selected
  geometric forms. The final hero uses an accessible, reduced-motion-safe
  character rotation with a restrained left-to-right stagger, alternating
  vertical directions, a two-color orange-and-mint flash, and a separate
  screen-blended highlight layer to demonstrate the contract types package
  lockfiles miss without layout shift or an animation dependency. Replaced the
  terminal placeholder with a neutral project path, upgraded the hero guarantee
  marks to custom rounded-square check icons, and progressively enhanced the
  native FAQ disclosures with reduced-motion-safe expand and collapse
  transitions. Production responses apply restrictive content security,
  permissions, referrer, MIME-sniffing, and framing policies.
- Alternatives considered: A framework, hosted font, analytics service, and
  waitlist form were rejected because the launch page does not need a build
  system, runtime network dependency, tracking, or backend. The supplied
  CodeRabbit design notes informed the visual system without copying its
  proprietary assets or font. GitHub Pages was replaced with Vercel because it
  matches the owner's existing deployment workflow and can preview the private
  repository before launch.
- Validation run: `pnpm site:validate`, browser review at desktop and mobile
  widths, and `pnpm verify`.
- Known limitation: The website is deployed at `https://www.develra.dev/`, with
  the apex redirected to the canonical `www` host, but should remain
  unannounced until the repository, npm package, and `v0` Action tag are
  publicly usable.
- Follow-up ticket: Complete the remaining DVL-054 launch artifacts, then run
  DVL-055.

## 2026-08-13 — Public v0.1.0 release

- Decision or implementation summary: Published the audited standalone CLI as
  `develra@0.1.0`, made `develra-dev/develra` public, created the immutable
  `v0.1.0` tag and moving `v0` Action channel at release commit `d56e427`, and
  created the GitHub release from the reviewed release notes. Enabled required
  CI checks, linear history, secret scanning, push protection, Dependabot
  security updates, and private vulnerability reporting. Added a manual
  published-release smoke workflow that installs the public npm package and
  invokes `develra-dev/develra@v0` from GitHub.
- Alternatives considered: The first npm publish used interactive 2FA because
  trusted publishing cannot be configured until the package exists. The Linux
  workflow artifact was published instead of rebuilding after approval. Its
  extracted contents matched the local audited archive except for semantically
  irrelevant ordering of three `devDependencies` keys in packed
  `package.json`; the executable bundle and all other files were byte-identical.
- Validation run: Local `pnpm release:validate`; public CI run `31770935750` on
  Linux, macOS, and Windows with Node 22 and 24; release validation run
  `31771493891`; and published-release smoke run `31772140310`. A clean npm
  install returned version `0.1.0` and found the expected five contracts in the
  TypeScript fixture without writing a lockfile. The remote `v0` Action bundle
  checksum matched the audited local bundle.
- Known limitation: npm trusted publishing, the stricter package-level
  token policy, and optional GitHub Marketplace submission remain deferred.
  DVL-052 and the remaining DVL-054 launch collateral are still open, so
  DVL-055 is not marked complete despite the successful release audit.
- Follow-up ticket: Complete DVL-052 and DVL-054, configure trusted publishing,
  then close the remaining DVL-055 audit items.

## 2026-08-13 — v0.1.1 Action security patch

- Decision or implementation summary: Published `develra@0.1.1` and moved the
  `v0` Action channel to reviewed commit `3be6fb4` after Dependabot identified
  vulnerable `undici` 5.29.0 code in the bundled GitHub Action. Upgraded the
  official Actions toolkit to `@actions/core` 2.0.3, which uses
  `@actions/http-client` 3.0.2 and patched `undici` 6.28.0. Scanner behavior and
  lockfile output are unchanged, and the npm CLI still has zero runtime
  dependencies.
- Alternatives considered: `@actions/core` 3.0.1 was evaluated first, but its
  ESM-only package exports are not compatible with the current `ncc` bundling
  path. Ignoring alerts against generated Action code was rejected because the
  bundle is the runtime users execute.
- Validation run: Local `pnpm release:validate`; public CI run `31772530356` on
  Linux, macOS, and Windows with Node 22 and 24; release validation run
  `31772539184`; and published-release smoke run `31775046736`. The audited
  workflow artifact was published unchanged, a clean public install returned
  version `0.1.1` and found the expected five contracts, the remote `v0` Action
  passed, `pnpm audit --prod` found no known vulnerabilities, and GitHub marked
  all 12 Dependabot alerts fixed.
- Known limitation: npm trusted publishing and optional GitHub Marketplace
  submission remain deferred. The immutable `v0.1.0` tag remains available,
  while the moving `v0` compatibility tag now selects `v0.1.1`.
- Follow-up ticket: Configure npm trusted publishing, then complete DVL-052 and
  the remaining DVL-054/DVL-055 launch collateral.

## 2026-08-13 — Website analytics and search discovery

- Decision or implementation summary: Connected the static production site to
  Vercel Web Analytics through its same-origin platform route without adding a
  framework or package dependency. Added an explicit cookie-free aggregate
  page-view disclosure, clarified that telemetry-free claims apply to the CLI,
  and kept custom events out of scope. Improved search metadata with a more
  descriptive title and summary, explicit indexing directives, complete social
  image metadata, and JSON-LD `WebSite` and `Organization` entities linked to
  the public GitHub, npm, and Marketplace identities. Linked the newly
  published Marketplace Action from the site.
- Alternatives considered: A third-party analytics loader, Google Analytics,
  and custom conversion events were rejected to keep collection first-party,
  minimal, and aligned with the local-first trust promise. `SoftwareApplication`
  rich-result markup was deferred because Google requires rating or review data
  that Develra cannot truthfully provide at launch.
- Validation run: `pnpm site:validate`, `pnpm verify`, production header and
  Analytics endpoint checks, structured-data parsing, and a headless production
  render.
- Known limitation: Search indexing and analytics data are asynchronous after
  deployment. Google may take several days or weeks to recrawl the site, and
  the Vercel Analytics route is created only after the first deployment made
  after Analytics is enabled.
- Follow-up ticket: Monitor Search Console coverage and queries without adding
  speculative landing pages; evaluate custom events only after a separate
  privacy and measurement decision.

## 2026-08-14 — Tokenless npm publishing workflow

- Decision or implementation summary: Added an owner-triggered npm publishing
  workflow prepared for npm trusted publishing. The publish job checks out an
  explicitly supplied immutable tag, validates that the tag matches the
  canonical CLI package version and release notes, reruns the full release
  validation, and publishes the audited archive through GitHub OIDC. The job is
  bound to the `npm` GitHub environment and does not contain or consume a
  long-lived npm token. The environment is restricted to protected branches and
  requires approval from the package owner.
- Alternatives considered: Automatic publishing on every pushed tag was
  rejected because a tag alone should not be sufficient authorization to
  publish. Reusing a traditional automation token was rejected because npm
  trusted publishing provides short-lived scoped credentials and automatic
  provenance. Staged publishing remains deferred until the simpler direct
  release workflow has been exercised successfully.
- Validation run: Targeted release-workflow tests and the full local
  `pnpm verify` suite.
- Known limitation: The npm-side trusted-publisher identity must still be bound
  to `develra-dev/develra`, `publish-npm.yml`, and the `npm` environment through
  the package settings. It can only be proven end to end during the next
  intentional package release.
- Follow-up ticket: Configure the npm package binding, verify the workflow
  during the next release, then disallow traditional npm publishing tokens.

## 2026-08-14 — DVL-052 Breakage Museum starter corpus

- Decision or implementation summary: Added five small, synthetic external-
  contract changes under `examples/breakage-museum/`: removed response field,
  optional-to-required request field, response enum expansion, removed endpoint
  operation, and stricter MCP tool input schema. Every case includes bounded
  before/after snapshots, human-readable impact notes, and a machine-readable
  expected change with an exact JSON Pointer assertion. Fixture tests discover
  the corpus and execute those assertions deterministically. Quoted the main
  test command's exclusion globs so adding fixture files cannot change shell
  argument expansion or accidentally replace the unit/integration selection.
- Alternatives considered: Vendor specifications and real incident excerpts
  were rejected to avoid uncertain licensing and accidental vendor claims. A
  production OpenAPI/MCP diff engine was rejected because DVL-052 requires a
  corpus, while general upstream change analysis remains outside the first
  local scanner milestone.
- Validation run: `pnpm test:fixtures`, full `pnpm verify`, and release audit.
- Known limitation: The corpus defines expected structural change vocabulary;
  it is not wired into `scan` or `check` and does not imply continuous upstream
  monitoring.
- Follow-up ticket: Complete the remaining DVL-054 launch collateral, then use
  this corpus as input to the optional registry work beginning at DVL-060.
