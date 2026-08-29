# Hosted service boundary

## Status

Deferred until the open-source scanner, lockfile, and Action are useful.

This document prevents early implementation from closing off the hosted path. It is not authorization to build the hosted service during milestones M0–M5.

## Hosted product promise

> Continuously monitor upstream contracts and tell a team which changes are likely to touch its repositories.

The directory and public change feed are acquisition/data surfaces. The paid value is personalized relevance, history, workflow, and organization-level visibility.

## Open-source responsibilities

Remain local and open:

- repository scanning;
- provider packs;
- lockfile creation;
- local inventory diff;
- local graph/report generation;
- GitHub Action;
- local config and policy;
- basic schema diff adapters where included;
- public registry protocol/client.

## Hosted responsibilities

Potential paid capabilities:

- scheduled polling of official specs, changelogs, SDK releases, docs, and MCP schemas;
- normalized upstream contract history;
- change severity classification;
- organization and repository inventory;
- mapping a change to relevant lockfile providers/operations;
- private provider definitions;
- Slack, email, and webhook delivery;
- acknowledgement, suppression, and ownership;
- retention and audit history;
- high-frequency checks;
- team seats and access controls;
- managed docs-page extraction;
- cross-repository exposure reports.

## Future implementation stack

The hosted implementation stack is deliberately undecided and is not a
constraint on the open-source TypeScript CLI.

## Shared identity model

Durable IDs must be shared across local and hosted systems:

```text
provider_id
operation_id
endpoint_key
contract_source_id
repository_inventory_version
change_id
```

Provider and operation IDs originate in provider packs.

Do not use display names as foreign keys.

## Suggested registry protocol

The CLI should depend on an abstract interface. A future public HTTP registry could expose:

```text
GET /v1/capabilities
GET /v1/providers
GET /v1/providers/{provider_id}
GET /v1/providers/{provider_id}/state
GET /v1/changes?provider_id=...&since=...
POST /v1/inventories/check
```

The first three may be public/cacheable. Uploading an inventory requires explicit user action and a privacy contract.

## Inventory upload

A hosted connection should upload only the normalized inventory by default:

- provider IDs;
- package names/versions;
- operations;
- endpoint templates;
- API versions;
- MCP server IDs/schema hashes;
- repository-relative files only when needed and approved.

Do not upload source text merely because the scanner has access to it.

Offer a mode that hashes or omits file paths for customers with stricter requirements.

## Upstream ingestion model

Potential source types:

- OpenAPI;
- JSON Schema;
- GraphQL introspection/schema;
- MCP `tools/list` snapshots or official schemas;
- SDK package releases;
- official changelog feeds;
- documentation pages;
- vendor deprecation announcements.

Each snapshot should store:

- source identity;
- retrieval time;
- content hash;
- parser version;
- normalized contract representation;
- provenance;
- retrieval status;
- validation diagnostics.

Raw source retention should respect licensing, size, and terms.

## Change normalization

Represent upstream changes as provider-centric normalized events:

```ts
interface ContractChange {
  id: string;
  providerId: string;
  sourceId: string;
  observedAt: string;
  effectiveAt?: string;
  severity: "breaking" | "warning" | "informational" | "unknown";
  operations: string[];
  endpoints: EndpointRef[];
  summary: string;
  evidence: ChangeEvidence[];
}
```

AI may summarize or classify, but structural diff evidence remains available.

Do not let an LLM invent affected operations absent source evidence. Classification confidence must be explicit.

## Exposure mapping levels

### Level 0: provider match

The repository inventory contains the changed provider.

Useful for broad filtering, not a high-confidence impact claim.

### Level 1: package/version or API-version match

The change applies to a package family, SDK version, or configured API version.

### Level 2: operation/endpoint match

The change maps to an operation or endpoint in `develra.lock`.

This is the first strong paid relevance layer.

### Level 3: field or dataflow match

The repository appears to read/write the changed field or behavior.

Deferred until demand and precision justify deeper analysis.

User-facing wording must reflect the achieved level.

## Alert wording

Bad:

> This Stripe change will break your app.

Better:

> Stripe changed `checkout.sessions.create`. Develra detected this operation in `src/billing/checkout.ts`. Review the change before your next deployment.

For provider-only evidence:

> Stripe published a potentially breaking change. This repository depends on Stripe, but Develra did not detect the affected operation. Relevance is uncertain.

## Public directory

A future public page may provide:

- provider metadata;
- official source links;
- recent normalized changes;
- source hashes;
- severity;
- watch button;
- CLI/provider-pack link.

It is an acquisition layer, not the primary moat.

Start with a small number of exceptional pages tied to provider packs rather than hundreds of thin pages.

## Authentication and billing

Deferred.

Likely plans later:

- free public registry and limited watches;
- indie/solo;
- team;
- enterprise only after demand.

Do not encode plan limits into the open-source lockfile format.

## Data privacy

Before hosted repository connection:

- publish data-flow documentation;
- list exact uploaded fields;
- define retention/deletion;
- avoid broad repository OAuth permissions when a local CLI upload can work;
- support revocation;
- log access;
- distinguish public and private provider data.

## Hosted launch gate

Do not build the full hosted service merely because M0–M5 complete.

Evidence that justifies it may include:

- committed lockfiles across real repositories;
- repeat `check` usage;
- requests for scheduled upstream monitoring;
- requests for team aggregation;
- provider/operation coverage sufficient for useful mapping;
- a meaningful upstream change corpus.

Hosted complexity should follow demonstrated open-source use.
