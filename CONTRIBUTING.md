# Contributing to Develra

Thank you for helping make external contracts visible and reviewable. Bug
reports, detection fixtures, provider packs, documentation, and focused code
changes are welcome.

## Before opening a change

Develra's invariant is that the default scan is deterministic, local-only, and
safe for untrusted repositories. A detector must not execute project code,
install project dependencies, follow symlinks outside the root, contact a
provider, or persist source snippets and secrets.

For a code change:

```bash
pnpm install --frozen-lockfile
pnpm verify
```

Add the smallest fixture that proves the behavior. Detection changes need a
positive case, aliases where relevant, and at least one near-miss negative
case. Update golden lockfiles only through the explicit command:

```bash
pnpm goldens:update -- --update
```

## Adding a provider

1. Copy `packages/providers/data/_template.yaml`.
2. Add exact package, import, domain, and operation matchers supported by
   primary provider documentation.
3. Keep operation IDs stable and free of user data.
4. Run `pnpm build`, then
   `node apps/cli/dist/index.js providers validate <path>`.
5. Add fixture tests, including a plausible false-positive case.

The [provider-pack specification](docs/05-provider-pack-spec.md) defines the
schema and semantic conflict rules.

## Pull requests

Keep changes scoped and explain user-visible behavior, confidence decisions,
privacy impact, and verification performed. Do not commit credentials,
generated local reports, or a changed Action bundle without its source change.
By participating, you agree to follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
