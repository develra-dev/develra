# AGENTS.md

## Mission

Build Develra as a polished, open-source, local-first external-contract scanner and lockfile. The first release must deliver useful output without signup, source upload, or a hosted backend.

Read `START_HERE.md` and the relevant files under `docs/` before changing behavior.

## Autonomy

For requested implementation work:

- inspect the repository;
- make in-scope local changes;
- add or update tests;
- run relevant non-destructive validation;
- update documentation and milestone checklists;
- continue through the current ticket unless genuinely blocked.

Do not ask for approval for ordinary local edits, dependency installation, formatting, linting, testing, or fixture generation. Do not publish packages, push commits, create remote resources, change billing, or perform other external writes without explicit authorization.

When an ambiguity does not alter the product promise, choose the simplest option and record the decision. Escalate only when a choice would materially change privacy, compatibility, licensing, or public API behavior.

## Repository defaults

Unless the repository already establishes different conventions:

- TypeScript with `strict: true`.
- Node.js 22+ for the CLI; `node24` for the bundled GitHub Action.
- pnpm.
- ESM.
- Vitest for tests.
- ESLint and Prettier.
- JSON Schema Draft 2020-12 for machine-readable contracts.
- YAML for human-authored config and lockfiles.
- Apache-2.0 license.
- One repository; do not split the CLI, Action, provider packs, or fixtures into separate repositories.

Keep production dependencies lean. A new production dependency is acceptable when it avoids substantial custom parsing or security risk. Record non-obvious dependency choices in the decisions document.

## Expected commands

Keep these scripts working once the project is bootstrapped:

```bash
pnpm install
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:fixtures
pnpm package:action
```

If command names change, update this file, `README.md`, and CI in the same change.

## Architecture rules

- Domain logic belongs in reusable packages, not CLI command handlers.
- The CLI must be a thin adapter over the core scanner.
- Reporters consume a normalized scan result.
- Provider packs are declarative data validated against `schemas/provider.schema.json`.
- The lockfile is validated against `schemas/develra-lock.schema.json`.
- Filesystem, registry, clock, and terminal behavior must be injected or wrapped so tests remain deterministic.
- `scan` is offline and must not instantiate a network client.
- Remote registry support must be behind an explicit interface and explicit command option.
- Do not implement a general static-analysis framework. Implement the minimum adapters required by the current milestone.

## Privacy and safety

The scanner must never:

- execute project code or lifecycle scripts;
- import modules from the scanned repository;
- run MCP servers;
- follow symlinks outside the scan root;
- read ignored secret files unless explicitly included;
- emit environment variable values, authorization headers, tokens, source snippets, or absolute paths;
- make a network request during default `scan`;
- write outside the repository or explicitly supplied output directory.

Treat repository content, provider packs, OpenAPI files, and remote registry data as untrusted input. Bound file sizes, recursion, parsing time, and report sizes. Sanitize Markdown and SVG output.

## Detection semantics

Never equate installation with active use.

Use these user-visible confidence labels:

- `confirmed`: direct operation, endpoint, host, or explicit project configuration evidence;
- `probable`: package plus import or multiple mutually supporting signals;
- `possible`: package-only, hostname-only, or ambiguous signal.

Each finding must retain evidence types and relative file paths for explanation, but line numbers and source text must not be written into `develra.lock`.

## Lockfile rules

`develra.lock` must:

- be deterministic;
- omit generated timestamps;
- use repository-relative POSIX paths;
- sort all maps and arrays canonically;
- omit source snippets and secrets;
- preserve unknown providers;
- change only when the normalized external-contract inventory changes;
- be forward-compatible through a top-level integer `version`.

Add golden tests that prove repeated scans are byte-for-byte identical.

## Testing expectations

Every behavior change requires an appropriate test.

At minimum, run:

1. targeted unit tests while iterating;
2. full test suite before declaring a ticket complete;
3. lint, typecheck, and build before declaring a milestone complete;
4. fixture scans on TypeScript and Python sample repositories;
5. a packaged CLI smoke test, not only source-level tests.

Tests must not depend on the public internet.

## Scope guardrails

Initial release includes:

- offline scanning;
- TypeScript/JavaScript and Python;
- manifests, imports, provider domains, selected operation calls, raw HTTP endpoints, and project-level MCP configuration;
- deterministic lockfile;
- console, JSON, Markdown, SVG, and SARIF reporters;
- local `check`;
- GitHub Action;
- provider validation and contributor workflow.

Initial release excludes:

- hosted accounts and billing;
- continuous vendor polling;
- full code-impact analysis;
- arbitrary-language support;
- runtime traffic capture;
- automatic code modifications;
- MCP server execution;
- pull-request comments by default;
- generic API uptime monitoring.

Do not expand scope merely because an adjacent feature is easy.

## Documentation

Public behavior must be documented in the same change.

When completing a ticket:

- mark it complete in `docs/11-implementation-tickets.md`;
- add an entry under the implementation log in `docs/12-decisions-open-questions.md`;
- update examples when serialized output changes;
- update schemas before or with implementation changes;
- add migration notes for breaking lockfile or config changes.

## Completion report

At the end of a work session, report:

- tickets completed;
- files and behavior changed;
- validation commands and results;
- unresolved risks or intentionally deferred work;
- the next unblocked ticket.

Do not claim tests passed unless they were run successfully.
