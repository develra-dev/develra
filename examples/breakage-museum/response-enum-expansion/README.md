# Response enum expansion

This synthetic OpenAPI case adds `archived` to the response `status` enum used
by `listWidgets`.

Expected behavior: classify the delta as `enum_value_added` with `warning`
severity. The API may remain valid for tolerant clients, while exhaustive
deserializers or switch statements may need an update.
