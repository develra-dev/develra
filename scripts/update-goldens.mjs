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

const names = ["ts-saas", "python-service", "python-locked", "mcp-project"];
for (const name of names) {
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

process.stdout.write(
  `Updated ${names.length} deterministic lockfile goldens.\n`,
);
