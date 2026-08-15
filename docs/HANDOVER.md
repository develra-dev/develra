# HANDOVER — updated 2026-08-15

## Status

- Develra is a public Apache-2.0, local-first external-contract scanner and
  deterministic lockfile for JavaScript, TypeScript, Python, raw HTTP usage,
  webhook-like URLs, and project-level MCP configuration.
- The current public CLI is `develra@0.1.1`. Exact tags `v0.1.0` and `v0.1.1`
  exist, and the moving `v0` GitHub Action channel points to the reviewed
  `v0.1.1` security patch.
- The npm package, GitHub repository, Marketplace Action, and static website are
  live. M0–M5 and the first-release audit are complete.
- The CLI supports `scan`, `check`, `graph`, `providers list`,
  `providers validate`, and `doctor`, with console, YAML lockfile, JSON,
  Markdown, SVG, and SARIF output.
- Ten declarative provider packs ship: Anthropic, Clerk, GitHub, OpenAI, Resend,
  Shopify, Slack, Stripe, Supabase, and Twilio.
- Read `AGENTS.md` and `START_HERE.md` before changing behavior. Use
  `pnpm verify` as the complete local gate and `pnpm release:validate` for
  release work.

## In flight

- No implementation ticket is active.
- npm trusted publishing is configured, but its end-to-end OIDC path remains
  unproven until the next intentional release.
- M6 registry work and resolved Python lockfile parsing have not started.

## Next 3

1. **Agent:** Reconcile the stale DVL-021 and DVL-028 checkboxes in
   `docs/11-implementation-tickets.md` with the shipped provider packs,
   fixtures, and completed release audit. Keep DVL-015 open unless reliable
   Python lockfile support is actually implemented.
2. **Forrest:** Choose the next product scope: bounded Python lockfile support
   (DVL-015), optional registry work beginning with DVL-060, or another explicit
   priority. M6 is not standing authorization to add networked behavior.
3. **Prepare:** For the next intentional package release, verify the immutable
   tag and `apps/cli/package.json` version, run `pnpm release:validate` and
   `pnpm audit --prod`, then exercise trusted publishing. Do not publish or move
   tags without Forrest's explicit authorization.

## Recent decisions

- `apps/cli/package.json` is the only publishable version source; internal
  workspace packages use `0.0.0-private`.
- v0.1.1 changed only the bundled Action's vulnerable HTTP dependency; scanner
  behavior and lockfile output remain compatible with v0.1.0.
- The first-release implementation is complete. DVL-060 is only the next
  possible milestone, not active work.
- The Breakage Museum is a synthetic future-facing corpus, not evidence that
  Develra performs vendor monitoring today.
- Publishing, releases, moving tags, deployments, and launch posts remain
  owner-controlled external actions.

## Landmines

- Default `scan` and local `check` must stay offline. They must not instantiate
  a network transport, execute target code or package scripts, import target
  modules, or run MCP servers.
- Never emit secrets, environment values, source snippets, authorization data,
  or absolute paths. Enforce root containment and repository-relative POSIX
  evidence paths.
- `develra.lock` must remain timestamp-free, canonically sorted, and
  byte-identical for equivalent scans. Installation alone is only weak
  evidence; never report it as confirmed use.
- DVL-021 and DVL-028 are unchecked but implemented. DVL-015 is genuinely
  deferred. Do not reimplement completed provider work or pretend Python
  lockfiles are supported.
- Domain logic belongs in reusable packages, reporters consume normalized scan
  results, and provider packs remain declarative untrusted data.
- Action source or runtime dependency changes require rebuilding and verifying
  the committed `packages/action/dist` bundle. Review golden updates rather
  than refreshing them blindly.
