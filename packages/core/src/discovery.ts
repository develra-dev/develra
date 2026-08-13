import { lstat, opendir, readFile, realpath, stat } from "node:fs/promises";
import nodePath from "node:path";

import ignore, { type Ignore } from "ignore";
import { minimatch } from "minimatch";

import { DevelraError, errorMessage } from "./errors.js";
import { isInsideRoot, normalizeRelativePath, toPosixPath } from "./path.js";
import type { Diagnostic } from "./types.js";

const DEFAULT_IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  ".venv",
  "__pycache__",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "vendor",
  "venv",
]);

const SECRET_FILE_PATTERNS = [/^\.env(?:\..+)?$/u, /\.pem$/iu, /\.key$/iu];

export interface DiscoveredFile {
  readonly relativePath: string;
  readonly size: number;
}

export interface DiscoveryResult {
  readonly root: string;
  readonly files: readonly DiscoveredFile[];
  readonly diagnostics: readonly Diagnostic[];
}

export interface DiscoverOptions {
  readonly root: string;
  readonly include?: readonly string[];
  readonly exclude?: readonly string[];
  readonly maxFileSize?: number;
  readonly maxFiles?: number;
  readonly signal?: AbortSignal;
}

async function loadIgnoreFile(root: string, name: string): Promise<string[]> {
  try {
    const value = await readFile(nodePath.join(root, name), "utf8");
    return value
      .split(/\r?\n/u)
      .filter(
        (line) => line.trim() !== "" && !line.trimStart().startsWith("#"),
      );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function createIgnore(patterns: readonly string[]): Ignore {
  const matcher = ignore();
  matcher.add([...patterns]);
  return matcher;
}

function shouldInclude(
  relativePath: string,
  patterns: readonly string[] | undefined,
): boolean {
  if (!patterns?.length) return true;
  return patterns.some((pattern) =>
    minimatch(relativePath, pattern, { dot: true, nocase: false }),
  );
}

export async function discoverFiles(
  options: DiscoverOptions,
): Promise<DiscoveryResult> {
  const root = await realpath(options.root).catch((error: unknown) => {
    throw new DevelraError(
      `Cannot resolve scan root: ${errorMessage(error)}`,
      5,
      "DVL_ROOT_INVALID",
      { cause: error },
    );
  });
  const rootStat = await stat(root);
  if (!rootStat.isDirectory()) {
    throw new DevelraError(
      "Scan root is not a directory.",
      5,
      "DVL_ROOT_NOT_DIRECTORY",
    );
  }

  const gitignore = await loadIgnoreFile(root, ".gitignore");
  const develraignore = await loadIgnoreFile(root, ".develraignore");
  const excludeMatcher = createIgnore([
    ...gitignore,
    ...develraignore,
    ...(options.exclude ?? []),
  ]);
  const maxFileSize = options.maxFileSize ?? 2 * 1024 * 1024;
  const maxFiles = options.maxFiles ?? 100_000;
  const files: DiscoveredFile[] = [];
  const diagnostics: Diagnostic[] = [];

  async function walk(relativeDirectory: string): Promise<void> {
    options.signal?.throwIfAborted();
    const directory = nodePath.join(root, relativeDirectory);
    const entries = [];
    for await (const entry of await opendir(directory)) entries.push(entry);
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));

    for (const entry of entries) {
      options.signal?.throwIfAborted();
      const relativePath = toPosixPath(
        nodePath.join(relativeDirectory, entry.name),
      );
      const normalized = normalizeRelativePath(relativePath);

      if (entry.isDirectory()) {
        if (
          DEFAULT_IGNORED_DIRECTORIES.has(entry.name) ||
          excludeMatcher.ignores(`${normalized}/`)
        )
          continue;
        await walk(normalized);
        continue;
      }

      const absolutePath = nodePath.join(root, normalized);
      if (entry.isSymbolicLink()) {
        try {
          const target = await realpath(absolutePath);
          if (!isInsideRoot(root, target)) {
            diagnostics.push({
              code: "DVL_PATH_SYMLINK_ESCAPE",
              severity: "error",
              message:
                "Skipped a symbolic link that resolves outside the scan root.",
              file: normalized,
            });
          }
        } catch {
          diagnostics.push({
            code: "DVL_PATH_SYMLINK_INVALID",
            severity: "warning",
            message: "Skipped an unreadable symbolic link.",
            file: normalized,
          });
        }
        continue;
      }

      if (
        !entry.isFile() ||
        SECRET_FILE_PATTERNS.some((pattern) => pattern.test(entry.name))
      )
        continue;
      if (
        excludeMatcher.ignores(normalized) ||
        !shouldInclude(normalized, options.include)
      )
        continue;

      const fileStat = await lstat(absolutePath);
      if (!fileStat.isFile()) continue;
      if (fileStat.size > maxFileSize) {
        diagnostics.push({
          code: "DVL_SCAN_FILE_TOO_LARGE",
          severity: "warning",
          message: `Skipped file larger than the ${maxFileSize}-byte scan limit.`,
          file: normalized,
        });
        continue;
      }
      if (files.length >= maxFiles) {
        throw new DevelraError(
          `File-count limit of ${maxFiles} exceeded.`,
          5,
          "DVL_SCAN_FILE_LIMIT",
        );
      }
      files.push({ relativePath: normalized, size: fileStat.size });
    }
  }

  await walk("");
  return { root, files, diagnostics };
}

export async function readDiscoveredFile(
  root: string,
  file: DiscoveredFile,
  maxBytes: number,
): Promise<Uint8Array> {
  if (file.size > maxBytes) {
    throw new DevelraError(
      `Refused to read oversized file: ${file.relativePath}`,
      5,
      "DVL_SCAN_FILE_TOO_LARGE",
    );
  }
  const target = nodePath.join(root, normalizeRelativePath(file.relativePath));
  const targetRealPath = await realpath(target);
  if (!isInsideRoot(root, targetRealPath)) {
    throw new DevelraError(
      `File escaped scan root: ${file.relativePath}`,
      5,
      "DVL_PATH_SYMLINK_ESCAPE",
    );
  }
  const data = await readFile(targetRealPath);
  if (data.byteLength > maxBytes) {
    throw new DevelraError(
      `File grew beyond scan limit: ${file.relativePath}`,
      5,
      "DVL_SCAN_FILE_TOO_LARGE",
    );
  }
  return data;
}
