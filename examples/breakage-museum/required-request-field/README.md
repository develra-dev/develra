# Optional request field becomes required

This synthetic OpenAPI case adds `owner_id` to the required fields for the
`createWidget` request body.

Expected behavior: classify the delta as `required_field_added` with `breaking`
severity. Existing requests that omit the field may be rejected.
