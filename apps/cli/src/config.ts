import { readFile } from "node:fs/promises";
import nodePath from "node:path";

import {
  DevelraError,
  parseYamlUnique,
  resolveReadableInsideRoot,
  validateConfig,
} from "@develra/core";

export interface DevelraConfig {
  readonly version: 1;
  readonly scan?: {
    readonly include?: readonly string[];
    readonly exclude?: readonly string[];
    readonly max_file_size?: number;
    readonly confidence?: "possible" | "probable" | "confirmed";
  };
  readonly lockfile?: { readonly path?: string };
  readonly policy?: {
    readonly fail_on?: "none" | "possible" | "probable" | "confirmed";
    readonly fail_on_changes?: readonly (
      "any" | "provider" | "operation" | "endpoint" | "mcp"
    )[];
  };
  readonly reporters?: {
    readonly markdown?: string;
    readonly graph?: string;
    readonly json?: string;
    readonly sarif?: string;
  };
  readonly privacy?: { readonly telemetry?: false };
}

export async function loadConfig(
  root: string,
  explicit?: string,
): Promise<DevelraConfig | undefined> {
  const requested = explicit ?? "develra.config.yaml";
  let text: string;
  try {
    text = await readFile(
      await resolveReadableInsideRoot(root, requested),
      "utf8",
    );
  } catch (error) {
    if (!explicit && (error as NodeJS.ErrnoException).code === "ENOENT")
      return undefined;
    if (error instanceof DevelraError) throw error;
    throw new DevelraError(
      `Cannot read config ${nodePath.basename(requested)}.`,
      2,
      "DVL_CONFIG_READ",
      { cause: error },
    );
  }
  const value = parseYamlUnique(text, nodePath.basename(requested));
  await validateConfig(value);
  return value as DevelraConfig;
}
