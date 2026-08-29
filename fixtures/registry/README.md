# Synthetic registry fixtures

These files model local upstream contract snapshots and normalized changes for
registry tests. They are entirely synthetic, make no claim about a real vendor
change, and must never be fetched or treated as current provider data.

- `stripe-before.json` and `stripe-after.json` are bounded provider snapshots.
- `changes.json` contains operation-level, provider-only, and unrelated change
  cases used to verify inventory relevance wording.

The fixture registry receives these documents from the test process. It does
not read them itself and has no network transport.
