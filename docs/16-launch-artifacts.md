# Launch artifacts

These artifacts describe the shipped local-first product. They are source copy,
not evidence that any post was published or that future hosted monitoring is
available.

## Terminal recording

[`examples/terminal-demo.tape`](../examples/terminal-demo.tape) is a reproducible
[VHS](https://github.com/charmbracelet/vhs) source for a short scan of the
checked-in TypeScript fixture. It pins the public CLI version, uses `--no-write`,
and does not require credentials or expose local paths in the recording.

Render it when VHS and a network connection for the one-time npm install are
available:

```bash
vhs examples/terminal-demo.tape
```

The generated GIF is optional launch media and is not part of the release
archive. The deterministic standalone product graph remains available at
[`examples/develra-graph.svg`](../examples/develra-graph.svg).

## Show HN draft

### Title

Show HN: Develra – A local-first lockfile for external APIs and MCP servers

### Post

I built Develra because package lockfiles answer what a repository installed,
but not which external contracts its code actually calls.

Run:

```bash
npx develra scan
```

Develra statically inventories external APIs, SDK operations, raw endpoints,
outbound webhook-like URLs, and project-level MCP server configuration. It
writes a deterministic `develra.lock` that can be reviewed in a pull request and
checked locally or with the bundled GitHub Action.

The first release is intentionally local-first: no account, source upload,
daemon, hosted backend, or network request during a default scan. It supports
JavaScript/TypeScript and Python, assigns confirmed/probable/possible confidence
instead of equating installation with use, and preserves unknown hosts rather
than guessing.

The repository includes the scanner, Action, schemas, provider packs, fixtures,
and a synthetic Breakage Museum. The current tool does not monitor vendors or
claim full program analysis; those boundaries are documented.

I would especially value feedback on false positives, missing provider signals,
and whether committing this kind of inventory is useful in real repositories.
If it is useful after you try the scan, a GitHub star helps other maintainers
find it.

Source: https://github.com/develra-dev/develra

## Technical launch article outline

### Working title

Package lockfiles cannot tell you what your code calls

### Thesis

A dependency graph and an external-contract inventory answer different review
questions. A useful contract inventory must combine several static signals,
express uncertainty, remain deterministic, and work without executing or
uploading a repository.

### Outline

1. **The blind spot:** installed packages omit raw HTTP, webhooks, MCP config,
   and the operations actually called.
2. **The artifact:** why `develra.lock` is repository-native, timestamp-free,
   canonically sorted, and reviewable.
3. **Evidence, not certainty:** package-only `possible`, package-plus-import
   `probable`, and direct operation/endpoint/configuration `confirmed`.
4. **Safe static detection:** bounded parsing, ignored secrets, symlink
   containment, no module imports, no lifecycle scripts, no MCP execution, and
   no default network client.
5. **One engine, several adapters:** reusable scanner domain logic, thin CLI and
   Action adapters, normalized reporters, declarative provider packs.
6. **What changes in CI:** demonstrate `scan`, the committed lockfile, a new SDK
   operation, and `check` reporting the inventory delta.
7. **Known limits:** shallow analysis, conservative unknown hosts, supported
   languages and manifests, and no upstream vendor monitoring yet.
8. **An open corpus:** how the synthetic Breakage Museum can support future
   upstream-change evaluation without copying proprietary contracts.
9. **Invitation:** try it on a real repository, report a minimal false-positive
   fixture, contribute a provider pack, and star only after seeing value.

## GitHub Marketplace copy

### Name

Develra External Contract Check

### Short description

Scan and verify a repository's external API, SDK, endpoint, webhook, and MCP
contract inventory.

### Listing description

Develra checks a committed `develra.lock` against the external contracts found
in a repository. The bundled Node 24 Action runs without installing project
dependencies, uploading source, starting MCP servers, or contacting a hosted
Develra backend. It writes a job summary and can emit Markdown and SARIF files
for later workflow steps.

Start with read-only permissions:

```yaml
- uses: develra-dev/develra@v0
  with:
    command: check
    fail-on: probable
```

### Primary category

Code quality

## Existing launch collateral

- Sample SVG: [`examples/develra-graph.svg`](../examples/develra-graph.svg)
- First release notes: [`docs/releases/v0.1.0.md`](releases/v0.1.0.md)
- Security patch notes: [`docs/releases/v0.1.1.md`](releases/v0.1.1.md)
- Ten bounded contributor tasks:
  [`docs/13-good-first-issues.md`](13-good-first-issues.md)
- Marketplace listing:
  <https://github.com/marketplace/actions/develra-external-contract-check>

No artifact includes automated outreach, manufactured activity, or a claim that
the optional hosted monitoring product exists today.
