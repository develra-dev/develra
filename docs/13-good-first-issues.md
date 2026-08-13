# Good first issue ideas

These tasks are intentionally bounded entry points. Open an issue before doing
substantial work so maintainers can confirm that provider SDK shapes are still
current.

## Provider fixtures

- Add JavaScript alias and unrelated-client negative fixtures for Resend.
- Add Python positive and comment/string negative fixtures for Slack.
- Add package/import/domain fixtures for Shopify without inventing an operation
  matcher.
- Add Twilio `messages.create` fixtures for both JavaScript and Python.
- Add a Supabase `auth.signUp` near-miss fixture that uses an unrelated local
  object.

## Parser and documentation tasks

- Add a package-lock v3 fixture proving that transitive providers remain
  excluded.
- Add a malformed project-level MCP fixture with one concise diagnostic.
- Add a Windows-path normalization golden without machine-specific paths.
- Document another real, synthetic external-contract change for the future
  Breakage Museum.
- Improve provider-validation diagnostics for one schema failure while keeping
  stable diagnostic codes.

Every detection contribution should include primary documentation links, a
credential-free positive fixture, a plausible negative fixture, and
`pnpm verify` results. See [CONTRIBUTING.md](../CONTRIBUTING.md).
