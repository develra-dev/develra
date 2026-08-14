# MCP tool input-schema change

This synthetic MCP `tools/list` snapshot makes `format` required for the
`render_widget` tool.

Expected behavior: classify the delta as `mcp_input_required_field_added` with
`breaking` severity. The fixture is static data; Develra must never start an MCP
server to evaluate it.
