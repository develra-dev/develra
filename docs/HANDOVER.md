# HANDOVER — updated 2026-08-29

## Status

- Develra is a public Apache-2.0, local-first external-contract scanner and
  deterministic lockfile for JavaScript, TypeScript, Python, raw HTTP usage,
  webhook-like URLs, and project-level MCP configuration.
- The current public CLI is `develra@0.2.0`. Exact tag `v0.2.0` and the moving
  `v0` GitHub Action channel point to reviewed commit `797572b`; npm, the GitHub
  release, the Action channel, and the published-release smoke workflow are
  verified.
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

- No scanner implementation ticket is currently in flight. DVL-015 is complete
  and shipped in `develra@0.1.2`.
- npm trusted publishing has been proven end to end through the `v0.2.0`
  release.
- npm account writes require 2FA, the `develra` package disallows traditional
  publishing tokens, and the account token inventory is empty.
- DVL-062 adds the explicit `check --registry <url>` mode and a bounded,
  validated `HttpRegistry`. DVL-064 deploys the two required public routes at
  `https://www.develra.dev/api` with a small, manually curated official-source
  feed. The CLI still has no implicit endpoint and remains offline by default.

## Next 3

1. **Observe:** Gather real usage feedback on optional registry relevance and
   false positives before changing the feed or failure policy.
2. **Curate:** Add public changes only through reviewed repository updates with
   official provenance; keep the feed small and defensible.
3. **Defer:** Do not add ingestion automation, accounts, uploads, credentials,
   or a database until usage demonstrates a concrete need.

## Recent decisions

- DVL-015 landed on `main` with only the three bounded Python lock formats;
  `pylock.toml`, `pdm.lock`, and Yarn stay deferred, and locked transitive
  packages never become direct dependencies.
- `develra@0.1.2` shipped DVL-015, proved npm OIDC trusted publishing, and
  refreshed vulnerable synthetic fixture versions without adding runtime
  dependencies.
- DVL-060 adds only typed registry contracts and an offline `NoopRegistry`;
  remote capability is explicit and no scanner command instantiates transport.
- DVL-061 keeps registry fixtures local, maps exact operation intersections as
  strong relevance, and labels provider-only matches as uncertain.
- DVL-064 narrows the deployed contract to capabilities and changes, using the
  existing Vercel project and a reviewed JSON feed instead of a second project,
  database, accounts, poller, or AI classifier.
- `develra@0.2.0` shipped the explicit registry client and minimal public feed;
  the immutable tag, npm OIDC publish, GitHub release, moving `v0` channel, and
  clean published npm/Action smoke tests all passed.
- DVL-062 implements only the explicit read-only client path: no configured
  endpoint, authentication, upload, caching, or upstream-change failure policy.
- npm publishing is hardened around OIDC: account writes require 2FA, package
  publishing disallows traditional tokens, and no access tokens remain.
- Public Git history uses a GitHub noreply identity, and local research notes
  are excluded from version control.
- DVL-021 and DVL-028 completion checkboxes updated to match v0.1.1 reality.
- `apps/cli/package.json` is the only publishable version source; internal
  workspace packages use `0.0.0-private`.
- v0.1.1 changed only the bundled Action's vulnerable HTTP dependency; scanner
  behavior and lockfile output remain compatible with v0.1.0.
- The first-release implementation is complete; optional M6 work remains
  separate from the shipped default scanner path.
- The Breakage Museum is a synthetic future-facing corpus, not evidence that
  Develra performs vendor monitoring today.
- Publishing, releases, moving tags, deployments, and launch posts remain
  owner-controlled external actions.

## Landmines

- Default `scan` and ordinary `check` must stay offline. Only an explicit
  `check --registry` URL may instantiate a network transport. No command may
  execute target code or package scripts, import target modules, or run MCP
  servers.
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
