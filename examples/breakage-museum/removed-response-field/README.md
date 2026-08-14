# Removed response field

This synthetic OpenAPI case removes `legacy_code` from the `Widget` returned by
`getWidget`.

Expected behavior: classify the structural delta as `field_removed` with
`breaking` severity. A client that reads the field may be affected; the corpus
does not claim that every repository using `getWidget` will break.
