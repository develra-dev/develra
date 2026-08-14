# Endpoint operation removed

This synthetic OpenAPI case removes the `GET /v1/widgets/{id}` operation named
`getWidget`.

Expected behavior: classify the delta as `operation_removed` with `breaking`
severity. Mapping that change to a repository still requires operation or
endpoint evidence in that repository's inventory.
