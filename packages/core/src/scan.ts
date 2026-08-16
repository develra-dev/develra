import nodePath from "node:path";
import { TextDecoder } from "node:util";

import { classifyFile, isProbablyBinary } from "./classify.js";
import { discoverFiles, readDiscoveredFile } from "./discovery.js";
import {
  parseNpmLock,
  parseNpmManifest,
  parsePythonLock,
  parsePythonManifest,
} from "./manifests.js";
import { parseMcpConfig } from "./mcp.js";
import { normalizeScanResult } from "./normalize.js";
import { scanJavascriptSource, scanPythonSource } from "./source.js";
import type {
  Diagnostic,
  Evidence,
  Language,
  McpServerFinding,
  ScanOptions,
  ScanResult,
} from "./types.js";

const decoder = new TextDecoder("utf8", { fatal: false, ignoreBOM: true });

export async function scanRepository(
  options: ScanOptions,
): Promise<ScanResult> {
  const maxFileSize = options.maxFileSize ?? 2 * 1024 * 1024;
  const discovery = await discoverFiles({
    root: options.root,
    ...(options.include ? { include: options.include } : {}),
    ...(options.exclude ? { exclude: options.exclude } : {}),
    maxFileSize,
    ...(options.maxFiles ? { maxFiles: options.maxFiles } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });
  const evidence: Evidence[] = [];
  const mcpServers: McpServerFinding[] = [];
  const diagnostics: Diagnostic[] = [...discovery.diagnostics];
  const languages = new Set<Language>();
  // Python lockfiles are correlated with same-directory manifest evidence
  // after discovery, so locked transitive packages never become direct.
  const pendingPythonLocks: { text: string; relativePath: string }[] = [];
  const pythonDirectNames = new Map<string, Set<string>>();

  for (const file of discovery.files) {
    options.signal?.throwIfAborted();
    const kind = classifyFile(file.relativePath);
    if (kind === "unsupported") continue;
    const data = await readDiscoveredFile(discovery.root, file, maxFileSize);
    if (isProbablyBinary(data)) {
      diagnostics.push({
        code: "DVL_SCAN_BINARY_SOURCE",
        severity: "warning",
        message: "Skipped binary content with a supported filename.",
        file: file.relativePath,
      });
      continue;
    }
    const text = decoder.decode(data);
    if (kind === "javascript" || kind === "typescript") languages.add(kind);
    if (kind === "python") languages.add("python");
    if (kind === "python-lock") {
      pendingPythonLocks.push({ text, relativePath: file.relativePath });
      continue;
    }

    const result =
      kind === "npm-manifest"
        ? parseNpmManifest(text, file.relativePath)
        : kind === "npm-lock"
          ? parseNpmLock(text, file.relativePath)
          : kind === "python-manifest"
            ? parsePythonManifest(text, file.relativePath)
            : kind === "javascript" || kind === "typescript"
              ? scanJavascriptSource(
                  text,
                  file.relativePath,
                  kind,
                  options.catalog,
                )
              : kind === "python"
                ? scanPythonSource(text, file.relativePath, options.catalog)
                : undefined;
    if (result) {
      evidence.push(...result.evidence);
      diagnostics.push(...result.diagnostics);
      if (kind === "python-manifest") {
        const directory = nodePath.posix.dirname(file.relativePath);
        const names = pythonDirectNames.get(directory) ?? new Set<string>();
        for (const item of result.evidence)
          if (item.package?.ecosystem === "pypi" && item.package.direct)
            names.add(item.package.name);
        pythonDirectNames.set(directory, names);
      }
    }
    if (kind === "mcp-config") {
      const mcp = parseMcpConfig(text, file.relativePath);
      mcpServers.push(...mcp.servers);
      diagnostics.push(...mcp.diagnostics);
    }
  }

  for (const pending of pendingPythonLocks) {
    const directory = nodePath.posix.dirname(pending.relativePath);
    const result = parsePythonLock(
      pending.text,
      pending.relativePath,
      pythonDirectNames.get(directory) ?? new Set<string>(),
    );
    evidence.push(...result.evidence);
    diagnostics.push(...result.diagnostics);
  }

  const mappedEvidence = evidence.map((item): Evidence => {
    if (item.providerId || !item.package) return item;
    const provider = options.catalog.packageIndex.get(
      `${item.package.ecosystem}:${item.package.name}`,
    );
    return provider ? { ...item, providerId: provider.id } : item;
  });
  const result = normalizeScanResult({
    evidence: mappedEvidence,
    mcpServers,
    languages: [...languages],
    diagnostics,
    filesScanned: discovery.files.length,
  });
  if (
    options.strict &&
    result.diagnostics.some(
      (item) => item.severity === "warning" || item.severity === "error",
    )
  ) {
    return {
      ...result,
      diagnostics: result.diagnostics.map((item) =>
        item.severity === "warning"
          ? { ...item, severity: "error" as const }
          : item,
      ),
    };
  }
  return result;
}
