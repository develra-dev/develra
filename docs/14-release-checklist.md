# Release checklist

This checklist is intentionally owner-driven. Validation may run automatically,
but no workflow in this repository publishes npm packages, creates GitHub
releases, moves tags, or changes repository visibility.

## Release identity

- Repository: `https://github.com/develra-dev/develra`
- npm package: `develra`
- Canonical version source: `apps/cli/package.json`
- First exact tag: `v0.1.0`
- First moving Action compatibility tag: `v0`
- Action invocation: `develra-dev/develra@v0`

Only `apps/cli/package.json` carries the publishable release version. Internal
workspace packages use the fixed `0.0.0-private` sentinel required for pnpm
workspace packing and cannot be published. `develra --version`, package smoke
tests, the release audit, artifact names, GitHub tags, and release notes must
derive or agree with the CLI package value.

## While the repository is private

- [x] Initialize the local Git repository and set `main` as the default branch.
- [x] Add `https://github.com/develra-dev/develra.git` as `origin`.
- [x] Review `git status` and the complete first commit for private files,
      credentials, generated reports, and the original handoff archive.
- [x] Push the initial commit only after owner authorization.
- [ ] Confirm the full CI matrix passes on Linux, macOS, and Windows with Node
      22 and 24.
- [ ] Run the manual **Release validation** workflow.
- [ ] Download `develra-release-candidate` and compare its manifest with the
      workflow logs.
- [ ] Configure `main` branch protection to require the CI workflow.
- [ ] Keep default workflow permissions read-only.

Local equivalent:

```bash
pnpm install --frozen-lockfile
pnpm release:validate
```

This produces an audited npm archive and its checksum manifest under
`release-artifacts/`. The directory is ignored and must not be committed.

## Before changing visibility

- [ ] Confirm Apache-2.0 remains the intended license.
- [ ] Confirm `develra` is still available with `npm view develra`.
- [ ] Confirm the repository description, website, and topics are accurate.
- [ ] Confirm issue templates, the security policy, and private vulnerability
      reporting are enabled.
- [ ] Confirm no documentation claims npm, Marketplace, or hosted-service
      availability before those surfaces exist.
- [ ] Review the commit history—not only the current tree—for secrets.
- [ ] Make `develra-dev/develra` public.
- [ ] Rerun CI after the visibility change.

## First npm publication

npm requires publishing authentication. Enable account 2FA before the first
release. Publish the already-audited archive rather than rebuilding between
review and publication:

```bash
npm login
npm publish release-artifacts/develra-0.1.0.tgz --access public
```

- [ ] Verify `https://www.npmjs.com/package/develra` renders the expected README,
      repository, license, version, and zero runtime dependencies.
- [ ] Verify from a clean temporary directory:

  ```bash
  npx develra@0.1.0 --version
  npx develra@0.1.0 scan --no-write
  ```

- [ ] Configure npm trusted publishing for future releases.
- [ ] After trusted publishing works, require 2FA and disallow traditional
      automation tokens; revoke obsolete publishing tokens.

## GitHub release and Action channel

- [ ] Create the immutable exact tag `v0.1.0` from the reviewed release commit.
- [ ] Create or update the moving `v0` tag to the same commit.
- [ ] Push tags only after npm publication and owner review.
- [ ] Create the GitHub release from `docs/releases/v0.1.0.md`.
- [ ] Verify a clean repository can run:

  ```yaml
  - uses: develra-dev/develra@v0
    with:
      command: check
  ```

- [ ] Optionally select **Publish this Action to the GitHub Marketplace** on the
      release after accepting the Marketplace agreement.
- [ ] Do not create `v1` until Develra intentionally commits to a 1.0-compatible
      Action input and behavior contract.

For subsequent compatible `0.x` releases, move `v0` only after the exact tag
has passed release validation. Never move an exact version tag.

## Post-release verification

- [ ] `npx develra@0.1.0 scan` works without a Develra account.
- [ ] An offline scan performs no network request.
- [ ] Repeated scans produce byte-identical `develra.lock` files.
- [ ] `develra-dev/develra@v0` runs without installing workspace dependencies.
- [ ] The npm and GitHub release source URLs resolve to the reviewed commit.
- [ ] Open follow-up issues for known limitations rather than silently expanding
      the first-release scope.
