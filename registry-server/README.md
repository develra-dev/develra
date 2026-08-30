# Public registry data

The public registry is a small, read-only change feed served from
`https://www.develra.dev/api`. It has no database, accounts, authentication,
inventory upload, automated ingestion, or AI classification.

`data/changes.json` is the canonical manually curated dataset. Every entry must:

- identify a bundled provider and use only operation IDs declared by that
  provider pack;
- link to an official HTTPS source;
- describe only what the source supports;
- keep source confidence separate from repository relevance;
- remain canonically sorted by `observed_at`, `provider_id`, and `id`;
- pass the runtime response schema and endpoint tests.

Adding a record requires source review and the same repository validation gate
as a code change. Synthetic fixture data must never be copied into this public
feed.

The endpoint receives provider IDs in query parameters. It never receives
source code, lockfile contents, repository names, credentials, or evidence file
paths. Hosting access logs may contain the requested provider IDs and are
governed by the hosting platform's configured retention.
