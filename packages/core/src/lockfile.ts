import { rename, writeFile } from "node:fs/promises";
import nodePath from "node:path";

import { stringify } from "yaml";

import { DevelraError } from "./errors.js";
import { parseYamlUnique } from "./parsing.js";
import { resolveWritableInsideRoot } from "./path.js";
import { validateLockfile } from "./schema.js";
import type { LockfileDocument, ProviderFinding, ScanResult } from "./types.js";

function lockProvider(provider: ProviderFinding): ProviderFinding {
  return {
    id: provider.id,
    confidence: provider.confidence,
    packages: provider.packages.map((packageRef) => ({
      ecosystem: packageRef.ecosystem,
      name: packageRef.name,
      ...(packageRef.version ? { version: packageRef.version } : {}),
      direct: packageRef.direct,
    })),
    api_versions: [...provider.api_versions],
    operations: provider.operations.map((operation) => ({
      ...operation,
      files: [...operation.files],
    })),
    endpoints: provider.endpoints.map((endpoint) => ({
      ...endpoint,
      files: [...endpoint.files],
    })),
    files: [...provider.files],
  };
}

export function toLockfile(result: ScanResult): LockfileDocument {
  return {
    version: 1,
    project: { root: ".", languages: [...result.project.languages] },
    providers: result.providers.map(lockProvider),
    mcp_servers: result.mcp_servers.map((server) => ({
      ...server,
      config_files: [...server.config_files],
    })),
    unknowns: result.unknowns.map((unknown) => ({
      ...unknown,
      files: [...unknown.files],
    })),
  };
}

export function serializeLockfile(lockfile: LockfileDocument): string {
  return stringify(lockfile, {
    lineWidth: 0,
    minContentWidth: 0,
    indent: 2,
    sortMapEntries: false,
  }).replaceAll("\r\n", "\n");
}

export async function parseLockfile(text: string): Promise<LockfileDocument> {
  const value = parseYamlUnique(text, "develra.lock");
  await validateLockfile(value);
  if ((value as { version?: unknown }).version !== 1) {
    throw new DevelraError(
      "Unsupported develra.lock version.",
      2,
      "DVL_LOCK_UNSUPPORTED_VERSION",
    );
  }
  return value as LockfileDocument;
}

export async function writeLockfileAtomic(
  root: string,
  requestedPath: string,
  contents: string,
): Promise<string> {
  const target = await resolveWritableInsideRoot(root, requestedPath);
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, contents, { encoding: "utf8", mode: 0o644 });
  try {
    await rename(temporary, target);
  } catch (error) {
    throw new DevelraError(
      `Could not write ${nodePath.basename(target)} atomically.`,
      1,
      "DVL_LOCK_WRITE",
      { cause: error },
    );
  }
  return target;
}
