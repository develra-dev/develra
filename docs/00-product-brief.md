# Product brief

## Product

**Develra** is an open-source external-contract scanner and lockfile for software repositories.

Its first job is to answer:

> What external contracts does this repository appear to depend on?

Its later hosted job is to answer:

> Which upstream changes are likely to matter to this team, and why?

## Problem

Modern applications depend on more than installable libraries. They depend on:

- remote REST and GraphQL APIs;
- vendor SDK behavior;
- selected API versions;
- webhook payloads and event names;
- raw HTTP endpoints;
- provider-specific configuration;
- MCP servers and tool schemas.

Package managers record local dependencies, but they do not provide a durable, reviewable inventory of these external contracts. API changelogs and raw schema diffs are provider-centric. Teams must still determine whether a change touches their code.

## Product thesis

A repository should have a committed artifact describing its external contract surface, analogous to a package lockfile.

That artifact should be:

- generated locally;
- useful before a hosted service exists;
- stable in source control;
- diffable in pull requests;
- backed by explainable evidence;
- extensible through provider definitions;
- consumable by CI and future upstream-monitoring services.

## Core artifact

The core artifact is:

```text
develra.lock
```

It records normalized external dependencies such as:

- provider identity;
- package ecosystem, name, and resolved version;
- detected API versions;
- canonical operations;
- raw endpoint method and path;
- repository-relative evidence files;
- MCP server configuration;
- unknown external hosts or packages;
- confidence.

The lockfile does not contain source text, line numbers, secrets, or timestamps.

## Target users

### Primary

- solo technical founders;
- small integration-heavy SaaS teams;
- AI application teams using several model and platform APIs;
- fintech, commerce, communications, and workflow products;
- maintainers who want contract changes visible in pull requests.

### Secondary

- security and platform engineers inventorying external services;
- open-source maintainers documenting integrations;
- API vendors contributing official provider packs;
- DevRel teams improving SDK detectability.

## Jobs to be done

1. **Inventory:** Show me which external services and contracts this repository depends on.
2. **Review:** Show me when a code change adds, removes, or changes an external dependency.
3. **Explain:** Show me why a provider or operation was detected.
4. **Automate:** Enforce that the contract inventory is current in CI.
5. **Share:** Generate a graph or report worth adding to a README, issue, or architecture document.
6. **Extend:** Let me add a provider definition without writing scanner code.
7. **Monitor later:** Alert me when upstream contract data changes in a way likely to touch my inventory.

## Differentiation

Develra is differentiated by the combination of:

- repository discovery;
- canonical external-contract inventory;
- confidence-aware evidence;
- a deterministic lockfile;
- provider-pack extensibility;
- GitHub-native workflow;
- later mapping of upstream changes to the lockfile.

It should reuse mature parsers and diff engines where useful. The product is not differentiated by inventing another JSON or OpenAPI diff algorithm.

## Open-source strategy

The open-source release must solve a complete problem without a cloud account:

> Create and maintain an external-contract inventory for a repository.

The hosted product may solve:

> Continuously monitor upstream sources and alert teams when their inventories are exposed.

This boundary supports authentic GitHub growth because the public tool is not a crippled demo.

## GitHub-star strategy

The repository should earn stars through utility, visibility, and contribution loops:

- a one-command demo;
- attractive console output;
- a generated SVG contract graph;
- a commit-worthy lockfile;
- a GitHub Action;
- a public breakage corpus;
- provider packs that support small pull requests;
- public-repository scan pages later;
- recurring release reports later.

A star is not an activation event. More meaningful activation metrics are:

- successful scans;
- committed `develra.lock` files;
- Action installations;
- provider contributions;
- repeated `check` usage;
- hosted watches later.

## Product principles

### Local value first

The first scan must work offline and without signup.

### Evidence over confidence theater

Every detected provider and operation must expose the evidence category that produced it. Never imply stronger certainty than the signals support.

### Stable artifacts

The lockfile should be pleasant to review. Avoid timestamps, volatile line numbers, absolute paths, and incidental parser details.

### Narrow language depth before broad language count

High-quality JavaScript/TypeScript and Python detection is more useful than shallow support for ten languages.

### Declarative extension

Provider support belongs primarily in data files. Provider contributions must not be able to execute arbitrary code.

### One repository

Keep the CLI, Action, provider packs, schemas, fixtures, examples, and breakage corpus together until there is a clear operational reason to split them.

### Hosted service as an upgrade, not a dependency

The core scanner remains useful when Develra's hosted service is unavailable.

## Business path

The open-source project creates awareness and repository adoption. A hosted service can later charge for:

- continuous upstream polling;
- historical snapshots;
- docs and changelog normalization;
- AI classification and explanations;
- private providers;
- Slack, email, and webhook alerts;
- organization-wide repository mapping;
- suppression and acknowledgement workflows;
- longer retention and audit history.

The likely initial paid segment is small teams rather than price-sensitive hobby use.

## Risks

### Scanner novelty without workflow adoption

Developers may run the scanner once but not commit the lockfile. Counter this with stable output, useful diffs, and a strong Action.

### False positives

Package-only and hostname-only findings can create noise. Counter this with confidence labels, evidence aggregation, provider-specific operation mappings, and user overrides later.

### Provider-pack maintenance

Vendor SDKs and naming patterns change. Counter this with declarative packs, fixture tests, community contribution, and optional vendor-owned definitions.

### Premature hosted complexity

Authentication, billing, polling, and alerts can distract from the open-source wedge. Keep them out of the first release.

### Stars without a business

GitHub attention may not convert. Ensure each OSS feature creates a natural bridge to recurring upstream monitoring rather than attracting an unrelated audience.

## Success criteria

### First public release

- one-command install or execution;
- offline scan on TypeScript and Python fixtures;
- deterministic lockfile;
- useful console and Markdown output;
- generated SVG graph;
- local CI check;
- public GitHub Action;
- at least ten polished provider packs;
- contribution guide and provider validator;
- no network request in default scan;
- no code execution from the scanned project.

### Healthy open-source signal

These are directional, not hard gates:

- at least 20% of successful scanners write a lockfile;
- at least 10% of lockfile users run `check` again;
- provider pull requests begin without maintainer solicitation;
- stars are accompanied by installs and repository artifacts;
- issues contain real detection examples, not only feature requests.

## Product investment decision

The implementation plan prioritizes a polished, star-capable open-source product while keeping hosted complexity behind demonstrated open-source use.
