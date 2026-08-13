import { lstat, mkdir, realpath } from "node:fs/promises";
import nodePath from "node:path";

import { DevelraError } from "./errors.js";

export function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

export function normalizeRelativePath(value: string): string {
  const normalized = nodePath.posix.normalize(toPosixPath(value));
  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//u.test(normalized)
  ) {
    throw new DevelraError(
      `Unsafe repository-relative path: ${value}`,
      5,
      "DVL_PATH_TRAVERSAL",
    );
  }
  return normalized;
}

export function isInsideRoot(root: string, target: string): boolean {
  const relative = nodePath.relative(root, target);
  return (
    relative === "" ||
    (!relative.startsWith(`..${nodePath.sep}`) &&
      relative !== ".." &&
      !nodePath.isAbsolute(relative))
  );
}

export function resolveInsideRoot(
  root: string,
  relativeOrAbsolute: string,
): string {
  const resolved = nodePath.resolve(root, relativeOrAbsolute);
  if (!isInsideRoot(root, resolved)) {
    throw new DevelraError(
      `Path resolves outside the repository root: ${relativeOrAbsolute}`,
      5,
      "DVL_PATH_TRAVERSAL",
    );
  }
  return resolved;
}

async function realRoot(root: string): Promise<string> {
  return realpath(nodePath.resolve(root));
}

async function nearestExistingAncestor(target: string): Promise<string> {
  let current = target;
  while (true) {
    try {
      await lstat(current);
      return current;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = nodePath.dirname(current);
      if (parent === current) throw error;
      current = parent;
    }
  }
}

export async function resolveReadableInsideRoot(
  root: string,
  relativeOrAbsolute: string,
): Promise<string> {
  const resolvedRoot = await realRoot(root);
  const requested = resolveInsideRoot(resolvedRoot, relativeOrAbsolute);
  const target = await realpath(requested);
  if (!isInsideRoot(resolvedRoot, target)) {
    throw new DevelraError(
      "A readable path resolves outside the repository root.",
      5,
      "DVL_PATH_SYMLINK_ESCAPE",
    );
  }
  return target;
}

export async function resolveWritableInsideRoot(
  root: string,
  relativeOrAbsolute: string,
): Promise<string> {
  const resolvedRoot = await realRoot(root);
  const requested = resolveInsideRoot(resolvedRoot, relativeOrAbsolute);
  const requestedParent = nodePath.dirname(requested);
  const existingAncestor = await nearestExistingAncestor(requestedParent);
  const ancestor = await realpath(existingAncestor);
  if (!isInsideRoot(resolvedRoot, ancestor)) {
    throw new DevelraError(
      "An output path resolves outside the repository root.",
      5,
      "DVL_PATH_SYMLINK_ESCAPE",
    );
  }
  await mkdir(requestedParent, { recursive: true });
  const parent = await realpath(requestedParent);
  if (!isInsideRoot(resolvedRoot, parent)) {
    throw new DevelraError(
      "An output path resolves outside the repository root.",
      5,
      "DVL_PATH_SYMLINK_ESCAPE",
    );
  }
  return nodePath.join(parent, nodePath.basename(requested));
}

export function sortUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
}
