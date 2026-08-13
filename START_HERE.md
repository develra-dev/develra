# Develra Codex Handoff

## Directive

Build **Develra**, an open-source, local-first external-contract scanner and lockfile for software repositories.

The canonical product promise is:

> Map every external API, SDK, webhook, and MCP server a repository depends on, then detect when that contract surface changes.

The first public release is a GitHub-star-oriented open-source tool. It must be useful without an account, without a hosted service, and without uploading source code.

The recurring hosted product comes later:

> Tell a team when an upstream contract changes, identify the repositories likely to be exposed, and provide evidence for why the alert matters.

## Product shape

The initial user experience is:

```bash
npx develra scan
```

The command:

1. inventories supported source and manifest files;
2. detects external providers, packages, hosts, operations, endpoints, and MCP configuration;
3. writes a deterministic `develra.lock`;
4. prints a concise console report;
5. optionally generates Markdown, JSON, SVG, and SARIF reports.

The repository-native workflow is:

```bash
npx develra check
```

That command rescans the repository, compares the current contract inventory with the committed lockfile, and exits nonzero when policy requires an update.

## What makes this different

Develra is **not** primarily:

- a generic OpenAPI diff engine;
- a public API changelog directory;
- a dependency update bot;
- an uptime monitor;
- an MCP-only scanner;
- a SaaS dashboard that requires repository access before showing value.

The open-source identity is the **external-contract inventory and lockfile**. Existing diff engines may be integrated later rather than reimplemented.

## Build assumptions

These are implementation defaults chosen to unblock Codex. They are not immutable product truths.

- Greenfield public repository.
- TypeScript, strict mode.
- Node.js 22 or newer; test Node.js 22 and 24, and bundle the GitHub Action for the `node24` runtime.
- pnpm workspace.
- One GitHub repository and one visible star count.
- Apache-2.0 license unless the owner changes it.
- Local-first, offline `scan`.
- JavaScript/TypeScript and Python support first.
- Declarative provider packs; provider files cannot execute code.
- GitHub Action in the same repository, with `action.yml` at the root.
- Hosted service is out of scope for the first release, but interfaces should not block it.

## Non-negotiable behavior

- `develra scan` performs no network requests by default.
- The scanner never executes repository code, package scripts, binaries, or MCP servers.
- The scanner never uploads source code.
- Absolute local paths, secrets, environment values, and source snippets must not enter the lockfile.
- Lockfile output must be deterministic and stable across equivalent scans.
- A package being installed is not reported as confirmed active use.
- Findings must include confidence labels: `confirmed`, `probable`, or `possible`.
- Unknown providers are preserved as useful output rather than silently discarded.
- The Action must work without write permissions for its core scan/check behavior.
- No fake, purchased, exchanged, automated, or permission-based GitHub stars.

## Read order for Sol

1. `AGENTS.md`
2. this file
3. `docs/00-product-brief.md`
4. `docs/01-scope-roadmap.md`
5. `docs/02-architecture.md`
6. `docs/03-cli-contract.md`
7. `docs/04-lockfile-schema.md`
8. `docs/05-provider-pack-spec.md`
9. `docs/06-detection-engine.md`
10. `docs/08-testing-quality.md`
11. `docs/11-implementation-tickets.md`
12. remaining documents as needed

Machine-readable contracts are in `schemas/`. User-facing examples are in `examples/`.

## Release target

The first public release is ready when a new user can:

1. install or run Develra with one command;
2. scan a representative TypeScript or Python repository offline;
3. receive accurate provider and operation findings with confidence labels;
4. commit a stable `develra.lock`;
5. run `develra check` in CI;
6. generate a useful graph or Markdown artifact;
7. add the GitHub Action from the same repository;
8. contribute or validate a provider pack.

## Product-truth milestone

The meaningful milestone is not a page count or a star count.

It is:

> A real repository gains a useful, reviewable inventory of its external contracts, and a code change that adds or removes a contract produces an understandable lockfile and CI diff.

Stars are a distribution metric. A committed lockfile or installed Action is activation.

## Work style

Implement vertical slices in milestone order. Do not build the hosted service, billing, authentication, a web dashboard, or continuous vendor polling during the initial release.

When a detail is unspecified, choose the simplest design consistent with:

- local-first trust;
- deterministic output;
- extensible provider packs;
- clear confidence;
- a one-command demo;
- a polished GitHub repository.

Record material choices in `docs/12-decisions-open-questions.md`.
