# Changelog

All notable changes to Develra will be documented here. The project follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
