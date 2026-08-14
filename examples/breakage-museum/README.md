# Develra Breakage Museum

The Breakage Museum is a small, executable corpus of external-contract changes.
Every example is synthetic, licensed under this repository's Apache-2.0
license, and intentionally independent of any vendor's proprietary source.

Each case contains:

- `before/contract.json` and `after/contract.json`: bounded OpenAPI or MCP tool
  snapshots;
- `expected/change.json`: the expected classification and an exact JSON Pointer
  assertion;
- `README.md`: why the change matters and what Develra may claim about it.

The corpus does not imply that the current local scanner monitors upstream
contracts. It is regression data for future explicit registry/change-analysis
work and a reviewable vocabulary for discussing breakage.

| Case                                                               | Expected classification          | Severity |
| ------------------------------------------------------------------ | -------------------------------- | -------- |
| [Removed response field](removed-response-field/)                  | `field_removed`                  | breaking |
| [Optional request field becomes required](required-request-field/) | `required_field_added`           | breaking |
| [Response enum expands](response-enum-expansion/)                  | `enum_value_added`               | warning  |
| [Endpoint operation removed](operation-removed/)                   | `operation_removed`              | breaking |
| [MCP tool input becomes stricter](mcp-input-schema-change/)        | `mcp_input_required_field_added` | breaking |

Run the corpus with:

```bash
pnpm test:fixtures
```
