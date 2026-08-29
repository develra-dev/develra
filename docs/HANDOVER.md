# HANDOVER — updated 2026-08-29

## Status

- Develra is a public Apache-2.0, local-first external-contract scanner and
  deterministic lockfile for JavaScript, TypeScript, Python, raw HTTP usage,
  webhook-like URLs, and project-level MCP configuration.
- The current public CLI is `develra@0.1.2`. Exact tags `v0.1.0`, `v0.1.1`, and
  `v0.1.2` exist, and the moving `v0` GitHub Action channel points to the
  reviewed `v0.1.2` release.
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
- npm trusted publishing has been proven end to end with the `v0.1.2` release.
- npm account writes require 2FA, the `develra` package disallows traditional
  publishing tokens, and the account token inventory is empty.
- DVL-061 adds an offline `FixtureRegistry` and relevance mapping. DVL-063 adds
  a read-only future registry OpenAPI contract and synthetic response fixtures.
  No registry transport, server, or CLI mode exists yet.

## Next 3

1. **Decide:** Explicitly authorize DVL-062 before adding any optional remote
   transport or `check --registry` behavior; DVL-061 and DVL-063 stay local.
2. **Review:** Treat `schemas/registry.openapi.yaml` as a draft until a real
   registry implementation is intentionally approved; keep uploads, auth, and
   billing out of the public v1 surface.
3. **Prepare:** For the next intentional package release, verify the immutable
   tag and `apps/cli/package.json` version, then run `pnpm release:validate` and
   `pnpm audit --prod`. Do not publish or move tags without explicit maintainer
   authorization.

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
- DVL-063 specifies only five cacheable public GET operations with versioned
  envelopes and bounded synthetic fixtures; it does not deploy a service.
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
