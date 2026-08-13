import nodePath from "node:path";

export type FileKind =
  | "npm-manifest"
  | "npm-lock"
  | "python-manifest"
  | "python-lock"
  | "javascript"
  | "typescript"
  | "python"
  | "mcp-config"
  | "unsupported";

const JS_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs"]);
const TS_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);

export function isProbablyBinary(data: Uint8Array): boolean {
  const sample = data.subarray(0, Math.min(data.byteLength, 8192));
  for (const byte of sample) if (byte === 0) return true;
  return false;
}

export function classifyFile(relativePath: string): FileKind {
  const lower = relativePath.toLowerCase();
  const basename = nodePath.posix.basename(lower);
  const extension = nodePath.posix.extname(lower);

  if (basename === "package.json") return "npm-manifest";
  if (
    [
      "package-lock.json",
      "pnpm-lock.yaml",
      "pnpm-lock.yml",
      "yarn.lock",
    ].includes(basename)
  )
    return "npm-lock";
  if (
    basename === "pyproject.toml" ||
    basename === "pipfile" ||
    /^requirements.*\.txt$/u.test(basename)
  ) {
    return "python-manifest";
  }
  if (["poetry.lock", "uv.lock", "pipfile.lock"].includes(basename))
    return "python-lock";
  if (
    basename === ".mcp.json" ||
    basename === "mcp.json" ||
    basename.endsWith(".mcp.json") ||
    lower === ".vscode/mcp.json" ||
    lower === ".cursor/mcp.json"
  ) {
    return "mcp-config";
  }
  if (/\.(?:min|generated)\.[cm]?[jt]sx?$/u.test(basename))
    return "unsupported";
  if (TS_EXTENSIONS.has(extension)) return "typescript";
  if (JS_EXTENSIONS.has(extension)) return "javascript";
  if (extension === ".py") return "python";
  return "unsupported";
}
