import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  scanRepository,
  serializeLockfile,
  toLockfile,
} from "../packages/core/dist/index.js";
import { loadBundledProviders } from "../packages/providers/dist/index.js";

if (!process.argv.includes("--update")) {
  throw new Error(
    "Golden updates are disabled by default. Re-run with an explicit --update flag.",
  );
}

const catalog = await loadBundledProviders();
const outputDirectory = path.resolve("fixtures/expected");
await mkdir(outputDirectory, { recursive: true });

for (const name of ["ts-saas", "python-service", "mcp-project"]) {
  const result = await scanRepository({
    root: path.resolve("fixtures/repositories", name),
    catalog,
  });
  await writeFile(
    path.join(outputDirectory, `${name}.lock`),
    serializeLockfile(toLockfile(result)),
    "utf8",
  );
}

process.stdout.write("Updated 3 deterministic lockfile goldens.\n");
