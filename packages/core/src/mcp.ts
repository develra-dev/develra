import nodePath from "node:path";

import { errorMessage } from "./errors.js";
import { asRecord, parseJsonUnique, stringValue } from "./parsing.js";
import type { Diagnostic, McpServerFinding } from "./types.js";

export interface McpParseResult {
  readonly servers: readonly McpServerFinding[];
  readonly diagnostics: readonly Diagnostic[];
}

function safeId(raw: string): string {
  const value = raw
    .replaceAll(/[^A-Za-z0-9_.-]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "")
    .slice(0, 256);
  return value || "unknown";
}

function safeCommand(raw: string): string | undefined {
  const basename = nodePath.basename(raw.trim());
  return basename && !/[\\/]/u.test(basename)
    ? basename.slice(0, 256)
    : undefined;
}

function extractPackage(
  command: string | undefined,
  args: unknown,
): string | undefined {
  if (
    !command ||
    !["npx", "pnpx", "bunx", "uvx"].includes(command) ||
    !Array.isArray(args)
  )
    return undefined;
  for (const value of args) {
    if (
      typeof value !== "string" ||
      value.startsWith("-") ||
      /(?:token|secret|key|password)/iu.test(value)
    )
      continue;
    if (/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/iu.test(value))
      return value.slice(0, 256);
  }
  return undefined;
}

function safeHost(rawUrl: string): string | undefined {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

export function parseMcpConfig(
  text: string,
  relativePath: string,
): McpParseResult {
  try {
    const root = asRecord(parseJsonUnique(text, relativePath));
    const mapping = asRecord(root?.mcpServers) ?? asRecord(root?.servers);
    if (!mapping) {
      return {
        servers: [],
        diagnostics: [
          {
            code: "DVL_PARSE_MCP_SHAPE",
            severity: "warning",
            message: "MCP config did not contain a supported servers mapping.",
            file: relativePath,
          },
        ],
      };
    }

    const servers: McpServerFinding[] = [];
    for (const [rawId, rawConfig] of Object.entries(mapping)) {
      const config = asRecord(rawConfig);
      if (!config) continue;
      const rawCommand = stringValue(config.command);
      const command = rawCommand ? safeCommand(rawCommand) : undefined;
      const rawUrl = stringValue(config.url) ?? stringValue(config.serverUrl);
      const url_host = rawUrl ? safeHost(rawUrl) : undefined;
      const rawTransport = stringValue(config.transport)?.toLowerCase();
      const transport =
        rawTransport === "sse"
          ? "sse"
          : rawTransport === "http" ||
              rawTransport === "streamable-http" ||
              url_host
            ? "http"
            : command
              ? "stdio"
              : "unknown";
      const packageName = extractPackage(command, config.args);
      servers.push({
        id: safeId(rawId),
        transport,
        confidence: "confirmed",
        ...(command ? { command } : {}),
        ...(packageName ? { package: packageName } : {}),
        ...(url_host ? { url_host } : {}),
        config_files: [relativePath],
      });
    }
    return { servers, diagnostics: [] };
  } catch (error) {
    return {
      servers: [],
      diagnostics: [
        {
          code: "DVL_PARSE_MCP_CONFIG",
          severity: "warning",
          message: `Invalid MCP configuration; skipped static MCP evidence (${errorMessage(error)}).`,
          file: relativePath,
        },
      ],
    };
  }
}
