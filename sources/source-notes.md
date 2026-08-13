# Source notes

## User-provided source context

This handoff is based on two user-provided analyses:

- `DevelraVsDiffused(2).md`
- `DomainsClaude(2).md`

Source-derived direction carried forward:

- prioritize `develra.dev`;
- use developer-native distribution;
- treat API/contract drift as the strongest wedge;
- reuse the founder's monitoring and classification infrastructure later;
- keep `diffused.xyz` as a secondary option;
- keep `omnigami.ai` as a premium brand reserve;
- favor a small-team/solo-developer segment before enterprise;
- treat public data pages, embeds, and a newsletter as possible acquisition mechanics.

The conversation after those files materially refined the product:

- the public API changelog directory is not the moat;
- the paid direction is “does this upstream change affect our code?”;
- full static analysis is deferred;
- manifest matching alone is not called impact analysis;
- the open-source wedge is an external-contract scanner and lockfile;
- authentic GitHub-star growth is an explicit design goal;
- the founder does not require a paid concierge pilot and accepts speculative build risk.

## Implementation assumptions introduced by this handoff

The uploaded files do not specify a concrete open-source CLI language or repository layout.

This package therefore introduces explicit defaults:

- TypeScript/Node;
- pnpm workspace;
- one public repository;
- Apache-2.0;
- local-first scan;
- declarative provider packs;
- deterministic YAML lockfile;
- GitHub Action in the same repository.

These are design recommendations, not claims from the source files.

## Current official references consulted

### Codex project guidance

OpenAI documents that Codex reads `AGENTS.md` before work, layers project instructions from repository root toward the current directory, and applies closer instructions later. The root `AGENTS.md` in this package is intentionally concise and project-specific.

- [Custom instructions with AGENTS.md](https://developers.openai.com/codex/agent-configuration/agents-md)

### GitHub Action metadata

GitHub requires an Action metadata file named `action.yml` or `action.yaml`; `action.yml` is the preferred format. Marketplace publication expects the public repository's root metadata.

- [Metadata syntax reference](https://docs.github.com/en/enterprise-cloud@latest/actions/reference/workflows-and-actions/metadata-syntax)
- [Publishing actions in GitHub Marketplace](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace)
- [Checkout action](https://github.com/actions/checkout)
- [Upload artifact action](https://github.com/actions/upload-artifact)
- [CodeQL Action](https://github.com/github/codeql-action)

As of this handoff, GitHub supports `node24` for JavaScript Actions, and the examples use current major versions of the official checkout, artifact-upload, and CodeQL SARIF-upload actions. Re-verify these at release time.

### Node.js support

The Node.js release schedule lists Node.js 22 in Maintenance LTS through April 2027 and Node.js 24 in Active LTS through April 2028. The CLI therefore targets Node.js 22+, while the JavaScript Action uses GitHub's `node24` runtime.

- [Node.js Release Working Group](https://github.com/nodejs/Release)

### SARIF

GitHub code scanning supports a subset of SARIF 2.1.0. SARIF is therefore an optional reporter, not Develra's only GitHub surface.

- [About SARIF files for code scanning](https://docs.github.com/en/code-security/concepts/code-scanning/sarif-files)
- [Uploading a SARIF file to GitHub](https://docs.github.com/en/enterprise-cloud@latest/code-security/how-tos/find-and-fix-code-vulnerabilities/integrate-with-existing-tools/upload-sarif-file)

### OpenAPI

The latest published OpenAPI Specification at the time of this handoff is 3.2.0. Develra should not make default scanning depend on any one OpenAPI version; future registry adapters should explicitly document support for 3.0, 3.1, and 3.2 where implemented.

- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)

### MCP tools

The current MCP tool definition includes a unique name, description, `inputSchema`, and optional `outputSchema`, using JSON Schema. This supports treating MCP tool schemas as an external-contract type in a future registry. The first scanner only detects static project configuration and does not execute servers.

- [MCP tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)

## Verification rule for implementation

Before shipping a provider pack, package name, SDK operation matcher, contract-source URL, GitHub Action runtime, or current platform integration:

1. verify it against an official primary source;
2. add a fixture;
3. avoid inventing values from memory;
4. document any uncertainty;
5. do not block the generic scanner on unverified provider depth.
