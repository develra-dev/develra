# Provider-pack specification

## Purpose

Provider packs teach Develra how to map generic repository evidence to canonical providers and operations.

A provider pack is declarative YAML validated against `schemas/provider.schema.json`.

A provider pack may describe:

- package names;
- import sources;
- API domains;
- selected SDK method chains;
- selected raw HTTP endpoints;
- API-version keys;
- upstream contract source metadata.

A provider pack cannot execute code.

## Location

Bundled packs:

```text
packages/providers/data/<provider-id>.yaml
```

Fixtures:

```text
fixtures/providers/<provider-id>/
```

## Example

```yaml
version: 1
id: stripe
name: Stripe
description: Payments and billing APIs
homepage: https://stripe.com
categories:
  - payments

packages:
  npm:
    - stripe
  pypi:
    - stripe

imports:
  - language: typescript
    source: stripe
  - language: javascript
    source: stripe
  - language: python
    source: stripe

domains:
  - api.stripe.com

api_versions:
  - language: typescript
    kind: object-property
    key: apiVersion
  - language: python
    kind: assignment
    key: stripe.api_version
  - language: any
    kind: header
    key: Stripe-Version

operations:
  - id: checkout.sessions.create
    display_name: Create Checkout Session
    matchers:
      - language: typescript
        kind: member-call
        package: stripe
        chain:
          - checkout
          - sessions
          - create
      - language: python
        kind: member-call
        package: stripe
        chain:
          - checkout
          - Session
          - create
      - language: any
        kind: http-endpoint
        method: POST
        path: /v1/checkout/sessions

contract_sources:
  - type: openapi
    url: https://example.invalid/stripe-openapi.json
    priority: 100
  - type: changelog
    url: https://example.invalid/changelog
    priority: 50
```

The example URLs are placeholders in this handoff. Production bundled packs must use verified official sources or omit them.

## Required fields

### `version`

Integer. Initial provider-pack version is `1`.

### `id`

Canonical lowercase slug.

Pattern:

```text
^[a-z0-9]+(?:-[a-z0-9]+)*$
```

The ID is a durable public identifier. Changing it is a migration.

### `name`

Human-readable provider name.

### `description`

Short factual description.

## Optional metadata

### `homepage`

HTTPS URL for display and source attribution. It is not fetched by `scan`.

### `categories`

Sorted unique slugs such as:

- `ai`;
- `payments`;
- `commerce`;
- `communications`;
- `developer-tools`;
- `identity`;
- `database`.

Categories do not affect detection confidence.

## Package mappings

```yaml
packages:
  npm:
    - openai
  pypi:
    - openai
```

Package names are exact and case-normalized according to ecosystem rules.

Constraints:

- one package may map to only one bundled provider unless an explicit alias/umbrella model is introduced;
- ecosystem keys require implemented manifest adapters;
- no wildcard package names in version 1;
- transitive package presence remains weak evidence.

## Import mappings

```yaml
imports:
  - language: typescript
    source: openai
  - language: python
    source: openai
```

Import sources are exact module roots. The parser may normalize subpaths:

```text
openai/resources
```

to the declared root:

```text
openai
```

Language values initially:

- `javascript`;
- `typescript`;
- `python`.

No regular expressions.

## Domain mappings

```yaml
domains:
  - api.openai.com
```

Rules:

- lowercase ASCII/Punycode normalized host;
- no scheme, path, query, fragment, wildcard, credential, or port;
- a detection engine may match subdomains only according to a documented fixed rule;
- generic infrastructure domains such as `amazonaws.com` must not map directly to one provider without a narrower pattern.

## API-version detectors

API-version detectors identify literals or explicit configuration keys.

Initial detector kinds:

- `object-property`;
- `assignment`;
- `header`;
- `environment-key`.

An `environment-key` detector may record that a version key exists, but it must never read or serialize the environment value during a repository scan unless the literal value is present in source/config and passes secret-safety rules.

Provider packs may not define arbitrary executable extraction expressions.

## Operation definitions

Each operation has:

- canonical `id`;
- optional `display_name`;
- one or more supported matchers.

Operation IDs should reflect provider concepts, not language syntax.

Good:

```text
responses.create
checkout.sessions.create
messages.create
```

Avoid:

```text
nodeClientCall42
POST-v1-responses
```

### `member-call` matcher

```yaml
- language: typescript
  kind: member-call
  package: openai
  chain:
    - responses
    - create
```

The engine first establishes an imported client binding associated with the package, then matches a member chain on that binding.

The matcher must not match unrelated objects named `openai` or `stripe` without import or construction evidence.

### `function-call` matcher

For SDKs exposing named functions.

```yaml
- language: python
  kind: function-call
  package: acme
  function: send_message
```

### `http-endpoint` matcher

```yaml
- language: any
  kind: http-endpoint
  method: POST
  path: /v1/responses
```

Path matching is exact or uses fixed `{parameter}` segments defined by the engine. Provider packs do not provide arbitrary regex.

## Contract source metadata

Contract sources are for future registry ingestion and are ignored by default offline scan.

Types:

- `openapi`;
- `json-schema`;
- `graphql`;
- `mcp`;
- `changelog`;
- `docs`.

Fields:

- `type`;
- `url`;
- `priority`;
- optional `notes`.

Rules:

- official vendor sources are preferred;
- `scan` does not fetch them;
- URLs are validated but not dereferenced by provider validation unless an explicit online mode is added;
- credentials must never appear in source URLs.

## Declarative safety

Version 1 provider packs prohibit:

- JavaScript or Python snippets;
- shell commands;
- dynamic imports;
- arbitrary regex;
- XPath or CSS selectors;
- template expressions;
- environment interpolation;
- network request headers;
- secrets.

Future docs-page extractors should live in a separate trusted ingestion service, not community provider YAML.

## Loading and validation

At startup:

1. parse YAML with duplicate-key rejection;
2. validate JSON Schema;
3. normalize fields;
4. validate semantic uniqueness;
5. build package, domain, import, and operation indexes;
6. report deterministic conflicts.

Bundled-pack failure is fatal because it makes detection untrustworthy.

`providers validate <file>` reports all possible validation errors in one pass where safe.

## Conflict rules

### Package conflict

Two provider IDs claim the same ecosystem/package.

Result: validation error.

### Domain conflict

Two provider IDs claim the same exact domain.

Result: validation error.

### Operation ID conflict

Duplicate IDs within one provider.

Result: validation error.

The same operation suffix may appear under different providers because provider ID scopes it globally.

### Matcher overlap

Two operations in one provider share an identical matcher.

Result: validation error unless one is explicitly designated an alias in a future schema version.

## Initial provider set

Recommended first ten:

1. Stripe
2. OpenAI
3. Anthropic
4. GitHub
5. Slack
6. Shopify
7. Twilio
8. Resend
9. Clerk
10. Supabase

Selection criteria:

- common in small integration-heavy products;
- official SDKs in JavaScript/TypeScript or Python;
- recognizable operations;
- useful external contract story;
- relevant to the intended audience.

Provider packs must be based on verified package names and SDK shapes before merge. Do not invent operation matchers from memory.

## Provider fixture requirements

Each bundled provider should include applicable fixtures:

```text
fixtures/providers/stripe/
├── package-only/
├── imported/
├── operation/
├── raw-http/
├── negative/
└── expected.json
```

Required assertions:

- package-only is not confirmed;
- imported package becomes probable;
- selected operation becomes confirmed;
- unrelated same-named object does not match;
- raw endpoint matches only with provider host or other required context;
- sensitive config is redacted;
- lockfile output is stable.

## Contribution workflow

A contributor should:

1. copy `providers/_template.yaml`;
2. add package/domain/import metadata;
3. add one or more fixtures;
4. run `develra providers validate`;
5. run provider fixture tests;
6. open a pull request.

The pull-request template should ask for official documentation supporting package names, domains, and operation shapes.

## Vendor ownership

A future metadata field may identify a provider pack as vendor-maintained, but all packs still pass the same schema and fixture tests. Do not accept opaque generated packs that cannot be reviewed.

## Schema evolution

Provider-pack schema changes follow the same principles as lockfile evolution:

- additive safe fields may remain in version 1;
- semantic or matcher-language changes require a new version;
- the validator should explain unsupported versions;
- migration tooling is preferable once community packs exist.
