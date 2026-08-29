import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runPnpm } from "./commands.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const cliRoot = path.join(repositoryRoot, "apps", "cli");
const output = path.join(cliRoot, "dist");

if (!output.startsWith(`${cliRoot}${path.sep}`))
  throw new Error("Refusing to clean an unexpected CLI output path.");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

runPnpm(
  [
    "exec",
    "ncc",
    "build",
    "src/bin.ts",
    "-o",
    "dist",
    "--minify",
    "--transpile-only",
    "--no-source-map-register",
    "--license",
    "licenses.txt",
  ],
  {
    cwd: cliRoot,
    stdio: "inherit",
  },
);

await cp(
  path.join(repositoryRoot, "packages", "providers", "data"),
  path.join(output, "data"),
  {
    recursive: true,
  },
);
const schemaOutput = path.join(output, "schemas");
await mkdir(schemaOutput, { recursive: true });
for (const name of [
  "develra-config.schema.json",
  "develra-lock.schema.json",
  "provider.schema.json",
]) {
  await cp(
    path.join(repositoryRoot, "schemas", name),
    path.join(schemaOutput, name),
  );
}
