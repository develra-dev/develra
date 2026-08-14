# Release checklist

This checklist is intentionally owner-driven. Validation may run automatically.
The manual **Publish npm** workflow can publish an existing immutable tag after
environment approval, but no workflow creates GitHub releases, moves tags, or
changes repository visibility.

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
- [x] Confirm the full CI matrix passes on Linux, macOS, and Windows with Node
      22 and 24.
- [x] Run the manual **Release validation** workflow.
- [x] Download `develra-release-candidate` and compare its manifest with the
      workflow logs.
- [x] Configure `main` branch protection to require the CI workflow.
- [x] Keep default workflow permissions read-only.

Local equivalent:

```bash
pnpm install --frozen-lockfile
pnpm release:validate
```

This produces an audited npm archive and its checksum manifest under
`release-artifacts/`. The directory is ignored and must not be committed.

## Before changing visibility

- [x] Confirm Apache-2.0 remains the intended license.
- [x] Confirm `develra` is still available with `npm view develra`.
- [x] Confirm the repository description, website, and topics are accurate.
- [x] Confirm issue templates, the security policy, and private vulnerability
      reporting are enabled.
- [x] Confirm no documentation claims npm, Marketplace, or hosted-service
      availability before those surfaces exist.
- [x] Review the commit history—not only the current tree—for secrets.
- [x] Make `develra-dev/develra` public.
- [x] Rerun CI after the visibility change.

## First npm publication

npm requires publishing authentication. Enable account 2FA before the first
release. Publish the already-audited archive rather than rebuilding between
review and publication:

```bash
npm login
npm publish release-artifacts/develra-0.1.0.tgz --access public
```

- [x] Verify `https://www.npmjs.com/package/develra` renders the expected README,
      repository, license, version, and zero runtime dependencies.
- [x] Verify from a clean temporary directory:

  ```bash
  npx develra@0.1.0 --version
  npx develra@0.1.0 scan --no-write
  ```

- [x] Add a manual, tag-validated GitHub Actions workflow that publishes the
      audited archive through npm trusted publishing without a long-lived token.
- [ ] In the `develra` package settings on npm, configure the trusted publisher:

  ```text
  Provider: GitHub Actions
  Organization or user: develra-dev
  Repository: develra
  Workflow filename: publish-npm.yml
  Environment name: npm
  Allowed actions: npm publish
  ```

- [ ] Verify trusted publishing with the next intentional release by running
      **Publish npm** from `main` with its exact existing tag.
- [ ] After trusted publishing works, require 2FA and disallow traditional
      automation tokens; revoke obsolete publishing tokens.

The publish job checks out the supplied immutable tag, requires that it exactly
match the version in `apps/cli/package.json`, reruns the complete release audit,
and publishes only the resulting allowlisted archive. npm CLI `11.5.1` is pinned
because that is the minimum version supporting trusted publishing. The `npm`
GitHub environment is also included in the npm trusted-publisher identity; add
required reviewers to that environment before the first trusted release.

## GitHub release and Action channel

- [x] Create the immutable exact tag `v0.1.0` from the reviewed release commit.
- [x] Create or update the moving `v0` tag to the same commit.
- [x] Push tags only after npm publication and owner review.
- [x] Create the GitHub release from `docs/releases/v0.1.0.md`.
- [x] Verify a clean repository can run:

  ```yaml
  - uses: develra-dev/develra@v0
    with:
      command: check
  ```

- [x] Select **Publish this Action to the GitHub Marketplace** on the
      release after accepting the Marketplace agreement.
- [ ] Do not create `v1` until Develra intentionally commits to a 1.0-compatible
      Action input and behavior contract.

For subsequent compatible `0.x` releases, move `v0` only after the exact tag
has passed release validation. Never move an exact version tag.

## v0.1.1 Action security patch

- [x] Upgrade the bundled Actions toolkit to patched `undici` 6.28.0.
- [x] Confirm `pnpm audit --prod` reports no known vulnerabilities.
- [x] Run full local and public release validation.
- [x] Publish `develra@0.1.1` from the audited workflow artifact.
- [x] Create immutable `v0.1.1` and move `v0` to the same reviewed commit.
- [x] Create the GitHub release from `docs/releases/v0.1.1.md`.
- [x] Rerun the published npm and Action smoke workflow.

## Post-release verification

- [x] `npx develra@0.1.0 scan` works without a Develra account.
- [x] An offline scan performs no network request.
- [x] Repeated scans produce byte-identical `develra.lock` files.
- [x] `develra-dev/develra@v0` runs without installing workspace dependencies.
- [x] The npm and GitHub release source URLs resolve to the reviewed commit.
- [ ] Open follow-up issues for known limitations rather than silently expanding
      the first-release scope.
