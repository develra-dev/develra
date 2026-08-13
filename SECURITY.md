# Security policy

## Reporting a vulnerability

Please do not open a public issue for a vulnerability that could expose source
code, credentials, filesystem data, or CI integrity. Report it privately
through GitHub's **Security → Report a vulnerability** flow for this repository.
Include affected versions, a minimal reproduction, and impact when possible.

Maintainers will acknowledge a complete report within five business days and
coordinate validation, remediation, and disclosure. Do not include real tokens
or private repositories in the report.

## Supported versions

Until the first stable release, security fixes are made on the latest release
line. Users should update to the newest published version.

Develra parses untrusted repository content. Its security model and non-goals
are documented in [docs/02-architecture.md](docs/02-architecture.md) and
[docs/08-testing-quality.md](docs/08-testing-quality.md).
