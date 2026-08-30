# Changelog

All notable changes to Develra will be documented here. The project follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Update the public website to describe the opt-in registry command and its
  privacy boundary while keeping offline-by-default behavior explicit.

## [0.2.0] - 2026-08-29

### Added

- Add an explicit `check --registry <url>` mode with bounded remote response
  validation, pagination, provenance reporting, and a dedicated exit code for
  unavailable or invalid registry responses.
- Deploy a minimal public change feed at `https://www.develra.dev/api`, backed
  by manually reviewed official sources and only the capabilities and changes
  routes required by the CLI.

### Privacy

- Keep `scan` and ordinary `check` offline. The optional registry request sends
  only detected provider IDs and never sends source, lockfile contents,
  repository names, evidence paths, credentials, or authorization headers.

## [0.1.2] - 2026-08-29

### Added

- Resolve direct Python dependency versions from bounded `poetry.lock`,
  `uv.lock`, and `Pipfile.lock` inputs without promoting transitive packages or
  changing the scanner's offline behavior.

### Security

- Refreshed the synthetic Python lockfile fixture to patched `requests` 2.33.0
  and `urllib3` 2.7.0 releases. These fixture packages are never installed or
  executed by Develra.

## [0.1.1] - 2026-08-13

### Security

- Updated the bundled GitHub Action from `@actions/core` 1.11.1 to 2.0.3,
  replacing vulnerable `undici` 5.29.0 with patched 6.28.0. The scanner remains
  offline by default and does not instantiate the bundled HTTP client.

## [0.1.0] - 2026-08-12

### Added

- Local-only JavaScript, TypeScript, Python, HTTP endpoint, webhook, and MCP
  discovery.
- Deterministic `develra.lock` generation and structural `check` policies.
- Ten declarative provider packs with schema and semantic validation.
- Console, JSON, Markdown, SVG, and SARIF reporters.
- Standalone `develra` npm CLI and bundled GitHub Action.
