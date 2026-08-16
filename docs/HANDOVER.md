# HANDOVER — updated 2026-08-16

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

- DVL-015 implemented on branch
  `pirouetta/11-implement-dvl-015-as-a-complet`: resolved direct versions from
  `poetry.lock`, `uv.lock`, and `Pipfile.lock`, correlated with same-directory
  Python manifest evidence. Unmerged and unreleased.
- npm trusted publishing is configured, but its end-to-end OIDC path remains
  unproven until the next intentional release.
- M6 registry work has not started.

## Next 3

1. **Forrest:** Review and merge the DVL-015 branch, then choose the next
   product scope: optional registry work beginning with DVL-060 or another
   explicit priority. M6 is not standing authorization to add networked
   behavior.
2. **Prepare:** For the next intentional package release, verify the immutable
   tag and `apps/cli/package.json` version, run `pnpm release:validate` and
   `pnpm audit --prod`, then exercise trusted publishing. Do not publish or move
   tags without Forrest's explicit authorization.
3. **TBD:** Next priority to be determined after product scope choice.

## Recent decisions

- DVL-015 shipped only the three bounded Python lock formats; `pylock.toml`,
  `pdm.lock`, and Yarn stay deferred, and locked transitive packages never
  become direct dependencies.
- DVL-021 and DVL-028 completion checkboxes updated to match v0.1.1 reality.
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
- Python lockfile support covers only `poetry.lock`, `uv.lock`, and
  `Pipfile.lock` via same-directory manifest correlation. Never emit every
  locked package: transitive packages must not become direct dependencies.
- Domain logic belongs in reusable packages, reporters consume normalized scan
  results, and provider packs remain declarative untrusted data.
- Action source or runtime dependency changes require rebuilding and verifying
  the committed `packages/action/dist` bundle. Review golden updates rather
  than refreshing them blindly.
