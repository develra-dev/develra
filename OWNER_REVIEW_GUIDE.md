# Owner review guide

## Purpose

Use this file to hand Develra to Sol in Codex without turning every implementation choice into an approval loop.

Sol should work autonomously inside the repository. The owner reviews milestone outcomes, privacy boundaries, public-release decisions, and any choice that changes the product contract.

## Before starting Sol

1. Use the canonical repository, `develra-dev/develra`.
2. Copy the full handoff package into the repository root.
3. Keep `AGENTS.md` at the repository root so Codex loads the project instructions.
4. Do not rename or remove the `schemas/`, `examples/`, or `docs/` directories before the initial repository assessment.
5. Open the repository in Codex and paste `CODEX_KICKOFF_PROMPT.md`.
6. Let Sol inspect existing code before scaffolding. The handoff assumes greenfield only when the repository does not already establish compatible conventions.

## Decisions Sol may make without approval

Sol may choose and document:

- internal package boundaries;
- parser and serialization libraries that meet the documented safety constraints;
- test helpers and fixture organization;
- command-handler organization;
- deterministic graph-layout details;
- diagnostic wording that preserves the documented semantics;
- implementation order within an unblocked milestone;
- ordinary local dependency installation, formatting, linting, tests, and build fixes.

Sol should record material choices in `docs/12-decisions-open-questions.md`.

## Decisions reserved for the owner

Sol must not perform these actions without explicit authorization:

- publish an npm package or GitHub release;
- push commits or open remote pull requests unless the owner has explicitly requested that workflow;
- create or configure the GitHub organization or repository;
- select the final npm package scope after checking availability;
- change the project license from the documented default;
- enable telemetry or upload repository data;
- create cloud services, hosted registry infrastructure, authentication, billing, or production secrets;
- change the public lockfile or config contract in a way that conflicts with the supplied schemas;
- weaken the offline, no-execution, or source-privacy guarantees;
- split the project into multiple public repositories;
- add automated star requests, OAuth star permissions, or other artificial growth mechanisms.

## Review gates

### Gate 0 — Repository assessment

Expected from Sol:

- existing-code assessment;
- conflicts between code and handoff;
- proposed first tickets;
- no implementation of hosted infrastructure.

Owner check:

- the project remains an external-contract scanner and lockfile;
- no generic API-directory or SaaS-dashboard detour;
- the scanner remains useful without an account.

### Gate M0 — Foundation

Request evidence for:

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:fixtures
pnpm package:action
```

Owner check:

- strict TypeScript and reproducible package scripts;
- schemas and supplied examples still validate;
- package and binary names are provisional and unpublished;
- Action bundle is generated from the same core implementation.

Do not approve public release at this gate.

### Gate M1/M2 — Safe detection

Ask Sol to demonstrate scans against at least:

- one TypeScript fixture;
- one Python fixture;
- one MCP configuration fixture;
- one malformed-file fixture;
- one unknown-provider fixture.

Owner check:

- no network request occurs during default `scan`;
- no repository code or MCP process executes;
- package-only evidence is not labeled confirmed;
- evidence paths are relative;
- source snippets, environment values, tokens, and absolute paths are absent;
- unknown signals remain visible rather than disappearing.

Reject the gate when impressive output is achieved by overclaiming confidence.

### Gate M3 — Lockfile and artifacts

Ask Sol to run the same scan multiple times with shuffled filesystem enumeration and compare hashes.

Owner check:

- `develra.lock` is byte-identical for equivalent input;
- adding one operation causes a focused diff;
- Markdown and SVG escape untrusted input;
- the graph is useful rather than decorative;
- JSON and SARIF are generated from the same normalized model;
- the lockfile contains no timestamps or line numbers.

This is the most important product-truth gate.

### Gate M4 — GitHub Action

Owner check:

- root `action.yml` uses the current supported JavaScript Action runtime;
- the committed bundle is current and tested;
- core permissions are only `contents: read`;
- SARIF upload remains caller-controlled and optional;
- job summaries are concise and escaped;
- the Action does not create issues, comments, commits, or pull requests by default;
- local and Action results match for the same fixture.

### Gate M5 — Public-release readiness

Owner check:

- the README hero demonstrates a real scan and useful artifact;
- installation and first-run instructions work in a clean environment;
- provider contribution instructions produce a small, testable pull request;
- the Breakage Museum examples are licensed or synthetic and technically accurate;
- no placeholder package, Marketplace, or domain claim is presented as already live;
- release artifacts contain the required bundled Action files;
- security, privacy, contribution, and license files are present;
- no package or release is published until the owner authorizes it.

## Questions to ask Sol at every milestone boundary

Use this exact review request:

```text
Report the completed Develra milestone. Include:
1. tickets completed and files changed;
2. commands run and their results;
3. a demo using the representative fixtures;
4. privacy/security invariants tested;
5. known limitations and false-positive risks;
6. decisions added to docs/12-decisions-open-questions.md;
7. the next unblocked tickets.
Do not publish, push, or create remote resources.
```

## Scope-control rules

A proposed feature belongs in the first public release only when it improves at least one of:

- the one-command local demo;
- detection precision or explainability;
- deterministic, reviewable contract inventory;
- GitHub-native installation or use;
- provider contribution;
- authentic sharing of a useful artifact.

Defer it when it primarily requires:

- accounts or billing;
- continuous remote polling;
- a web dashboard;
- arbitrary documentation scraping;
- generalized field-level static analysis;
- executing third-party code;
- enterprise administration;
- a second public repository.

## Recovery prompt after an interrupted Codex session

```text
Resume Develra from the repository state. Read AGENTS.md, START_HERE.md, the active milestone in docs/01-scope-roadmap.md, and docs/11-implementation-tickets.md. Inspect the implementation log in docs/12-decisions-open-questions.md. Run the relevant validation before changing code, identify the next incomplete unblocked ticket, and continue. Do not publish, push, or create external resources.
```

## Definition of a successful handoff

The handoff has worked when Sol can implement without repeatedly asking for product clarification, while still stopping before external publication or any decision that weakens privacy, compatibility, licensing, or public data contracts.
