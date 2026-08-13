import { parseDocument } from "yaml";

import { DevelraError } from "./errors.js";

export function parseYamlUnique(text: string, label: string): unknown {
  const document = parseDocument(text, {
    prettyErrors: false,
    strict: true,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    throw new DevelraError(
      `${label}: ${document.errors.map((error) => error.message).join("; ")}`,
      2,
      "DVL_PARSE_YAML",
    );
  }
  return document.toJS({ maxAliasCount: 100 });
}

export function parseJsonUnique(text: string, label: string): unknown {
  const value = parseYamlUnique(text, label);
  // YAML is intentionally used only for duplicate-key-aware parsing. Require JSON syntax as well.
  try {
    JSON.parse(text);
  } catch (error) {
    throw new DevelraError(`${label}: invalid JSON`, 2, "DVL_PARSE_JSON", {
      cause: error,
    });
  }
  return value;
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}
