# GitHub Action specification

## Goal

Make Develra useful as a repository-native check without creating a second implementation.

The Action wraps the same scanner, schemas, provider packs, and policy engine used by the local CLI.

## Packaging

Repository root must contain:

```text
action.yml
```

The Action implementation lives in the workspace package and is bundled into committed release artifacts under:

```text
packages/action/dist/
```

Use a JavaScript Action rather than a Docker Action for fast startup and broad GitHub-hosted runner compatibility.

The package/release process must verify that bundled output is current.

## Action metadata

Recommended root metadata:

```yaml
name: Develra External Contract Check
description: Scan and verify a repository's external API, SDK, endpoint, webhook, and MCP contract inventory
author: Develra

branding:
  icon: activity
  color: purple

inputs:
  command:
    description: scan or check
    required: false
    default: check
  root:
    description: Repository-relative scan root
    required: false
    default: .
  lockfile:
    description: Repository-relative lockfile path
    required: false
    default: develra.lock
  fail-on:
    description: none, possible, probable, or confirmed
    required: false
    default: probable
  config:
    description: Repository-relative config path
    required: false
  markdown:
    description: Output path for Markdown report
    required: false
    default: develra-report.md
  sarif:
    description: Output path for SARIF report
    required: false
    default: develra.sarif

outputs:
  status:
    description: ok, changed, or error
  findings:
    description: Number of material findings
  report-path:
    description: Markdown report path
  sarif-path:
    description: SARIF report path

runs:
  using: node24
  main: packages/action/dist/index.js
```

Use `node24` for the Action runtime. At implementation and release time, re-check GitHub's official metadata reference before publishing, because hosted-runner requirements can change independently of the CLI's Node.js support policy.

## Inputs

### `command`

Allowed:

- `scan`;
- `check`.

Reject other values.

Default `check` because CI should normally verify a committed lockfile.

### `root`

Must resolve inside `GITHUB_WORKSPACE`.

Reject absolute paths outside the workspace and traversal escapes.

### `lockfile`

Repository-relative. Default:

```text
develra.lock
```

### `fail-on`

Maps directly to local policy:

- `none`;
- `possible`;
- `probable`;
- `confirmed`.

### `config`

Optional explicit path. Auto-discovery applies otherwise.

### `markdown` and `sarif`

Output paths must stay inside the workspace.

## Outputs

### `status`

- `ok`: command and policy passed;
- `changed`: scan/check completed but policy failed;
- `error`: command could not produce a trustworthy result.

### `findings`

Integer count of material inventory differences or selected upstream findings.

### Paths

Return repository-relative output paths.

## Permissions

Core usage:

```yaml
permissions:
  contents: read
```

The Action itself should not create comments, issues, commits, or pull requests.

For SARIF upload, the caller can add:

```yaml
permissions:
  contents: read
  security-events: write
```

and use GitHub's supported SARIF upload action separately.

This separation keeps Develra's Action permissions minimal.

## Basic workflow

```yaml
name: External contracts

on:
  pull_request:
  push:
    branches:
      - main

permissions:
  contents: read

jobs:
  develra:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: develra-dev/develra@v0
        with:
          command: check
          fail-on: probable
```

## Workflow with artifact upload

```yaml
name: External contracts

on:
  pull_request:

permissions:
  contents: read

jobs:
  develra:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: develra-dev/develra@v0
        id: develra
        with:
          command: check
          markdown: artifacts/develra-report.md
          sarif: artifacts/develra.sarif

      - uses: actions/upload-artifact@v7
        if: always()
        with:
          name: develra-report
          path: artifacts/
```

## Optional SARIF upload

```yaml
permissions:
  contents: read
  security-events: write

steps:
  - uses: actions/checkout@v6

  - uses: develra-dev/develra@v0
    with:
      command: check
      sarif: artifacts/develra.sarif

  - uses: github/codeql-action/upload-sarif@v4
    if: always()
    with:
      sarif_file: artifacts/develra.sarif
```

Document that GitHub code-scanning availability depends on repository type, plan, and settings. SARIF is optional and must not be the only report surface.

## Job summary

Write a concise Markdown summary to `GITHUB_STEP_SUMMARY`.

Example:

```markdown
## Develra external-contract check

**Status:** Contract inventory changed

| Change          | Provider                  | Confidence | Evidence             |
| --------------- | ------------------------- | ---------: | -------------------- |
| Added operation | OpenAI `responses.create` |  Confirmed | `src/ai/generate.ts` |
| Updated package | Stripe `17.7.0 → 18.2.1`  |  Confirmed | `package.json`       |

Run `npx develra scan` locally and review `develra.lock`.
```

Escape all untrusted Markdown.

## Annotations

Use workflow command annotations sparingly for:

- invalid lockfile;
- unsafe path;
- parse errors tied to a relative file;
- confirmed operation inventory changes when a stable line location exists transiently.

Do not emit one annotation for every weak possible finding. The job summary is the primary human surface.

## SARIF mapping

Generate SARIF 2.1.0 compatible with GitHub's supported subset.

Suggested rule IDs:

```text
develra/provider-added
develra/provider-removed
develra/operation-added
develra/operation-removed
develra/endpoint-added
develra/mcp-added
develra/lockfile-invalid
```

Rules should have stable names and descriptions.

Result severity:

- `error`: confirmed change when policy fails;
- `warning`: probable change;
- `note`: possible change.

Use deterministic fingerprints so repeated findings do not become duplicate alerts.

SARIF locations may use transient line information, but the lockfile remains line-free.

## Failure behavior

The Action must distinguish:

- policy failure: Action fails with understandable summary;
- internal error: Action fails and says no trustworthy result was produced;
- malformed source warning: Action may pass unless strict/policy says otherwise;
- registry failure in explicit remote mode: Action fails distinctly, never reports no changes.

Always attempt to write the summary and requested reports when safe.

## Build and release

Required scripts:

```bash
pnpm package:action
pnpm test:action
```

`package:action`:

1. builds dependencies;
2. bundles Action entry point;
3. excludes test/dev-only code;
4. verifies no dynamic runtime dependency on workspace source;
5. writes deterministic `dist`;
6. records or checks bundle integrity.

CI should fail when source changed but committed `dist` is stale.

Release process:

1. run all quality gates;
2. bundle Action;
3. tag semantic release;
4. maintain moving major tag such as `v1` only after stable release policy is established;
5. publish Marketplace listing from the public repository.

Do not automate public publishing in the initial handoff.

## Marketplace presentation

The Action listing should emphasize:

- local-first scanning;
- external APIs, SDKs, endpoints, webhooks, and MCP;
- deterministic lockfile;
- no source upload;
- no account required;
- same behavior locally and in CI.

Avoid claiming field-level impact analysis or continuous upstream monitoring before those capabilities exist.

## Action tests

At minimum:

- valid unchanged lockfile passes;
- added probable provider fails at default threshold;
- package-only possible provider passes at probable threshold;
- invalid lockfile returns configuration error;
- output paths cannot escape workspace;
- summary escapes Markdown;
- requested output files exist;
- Action inputs map exactly to core options;
- bundle smoke runs in a minimal checked-out fixture;
- no network path is used in local `check`.
