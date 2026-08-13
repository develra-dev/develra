import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runPnpm } from "./commands.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const artifactsRoot = path.join(repositoryRoot, "release-artifacts");
const expectedRepository = "git+https://github.com/develra-dev/develra.git";
const temporary = await mkdtemp(
  path.join(os.tmpdir(), "develra-release-audit-"),
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function json(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function sha256(file) {
  const bytes = await readFile(file);
  return createHash("sha256").update(bytes).digest("hex");
}

async function filesBelow(directory, prefix = "") {
  const files = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort(
    (left, right) => left.name.localeCompare(right.name, "en"),
  )) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory())
      files.push(
        ...(await filesBelow(path.join(directory, entry.name), relative)),
      );
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

async function assertSafeTextTree(directory) {
  const forbidden = [
    /\/Users\//u,
    /[A-Za-z]:\\Users\\/u,
    /G3 Projects/u,
    /never-serialize/u,
    /very-secret-token/u,
  ];
  for (const relative of await filesBelow(directory)) {
    const file = path.join(directory, relative);
    if ((await stat(file)).size > 12 * 1024 * 1024) continue;
    const text = await readFile(file, "utf8");
    const match = forbidden.find((pattern) => pattern.test(text));
    assert(!match, `${relative} contains forbidden release text (${match}).`);
  }
}

try {
  assert(
    artifactsRoot.startsWith(`${repositoryRoot}${path.sep}`),
    "Release artifact path escaped the repository.",
  );
  await rm(artifactsRoot, { recursive: true, force: true });
  await mkdir(artifactsRoot, { recursive: true });

  const cliMetadata = await json(
    path.join(repositoryRoot, "apps", "cli", "package.json"),
  );
  assert(cliMetadata.name === "develra", "Unexpected npm package name.");
  assert(
    typeof cliMetadata.version === "string" &&
      /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(cliMetadata.version),
    "Invalid release version in apps/cli/package.json.",
  );
  assert(
    cliMetadata.repository?.url === expectedRepository,
    "npm repository metadata does not identify develra-dev/develra.",
  );
  assert(
    !cliMetadata.dependencies ||
      Object.keys(cliMetadata.dependencies).length === 0,
    "The standalone npm package must not have runtime dependencies.",
  );

  for (const packageFile of ["package.json", "packages/action/package.json"]) {
    const metadata = await json(path.join(repositoryRoot, packageFile));
    assert(
      metadata.version === undefined,
      `${packageFile} duplicates the release version; apps/cli/package.json is canonical.`,
    );
  }
  for (const packageFile of [
    "packages/core/package.json",
    "packages/providers/package.json",
    "packages/reporters/package.json",
  ]) {
    const metadata = await json(path.join(repositoryRoot, packageFile));
    assert(
      metadata.private === true && metadata.version === "0.0.0-private",
      `${packageFile} must use the non-release private workspace version.`,
    );
  }

  const requiredActionFiles = [
    "index.js",
    "licenses.txt",
    "data/stripe.yaml",
    "data/openai.yaml",
    "schemas/develra-lock.schema.json",
    "schemas/develra-config.schema.json",
    "schemas/provider.schema.json",
  ];
  for (const relative of requiredActionFiles) {
    await stat(
      path.join(repositoryRoot, "packages", "action", "dist", relative),
    );
  }

  runPnpm(
    ["--filter", "develra", "pack", "--pack-destination", artifactsRoot],
    { cwd: repositoryRoot, stdio: "pipe" },
  );
  const archives = (await readdir(artifactsRoot)).filter((entry) =>
    entry.endsWith(".tgz"),
  );
  assert(archives.length === 1, "Expected exactly one npm package archive.");
  const archiveName = archives[0];
  const archive = path.join(artifactsRoot, archiveName);
  const expectedArchive = `develra-${cliMetadata.version}.tgz`;
  assert(
    archiveName === expectedArchive,
    `Expected ${expectedArchive}; received ${archiveName}.`,
  );

  await stat(
    path.join(repositoryRoot, "docs", "releases", `v${cliMetadata.version}.md`),
  );

  const extracted = path.join(temporary, "extracted");
  await mkdir(extracted);
  execFileSync("tar", ["-xzf", archive, "-C", extracted], {
    stdio: "pipe",
  });
  const packageRoot = path.join(extracted, "package");
  const packedFiles = await filesBelow(packageRoot);
  for (const required of [
    "LICENSE",
    "README.md",
    "package.json",
    "dist/index.js",
    "dist/licenses.txt",
    "dist/data/stripe.yaml",
    "dist/schemas/develra-lock.schema.json",
  ]) {
    assert(
      packedFiles.includes(required),
      `Packed npm file is missing: ${required}`,
    );
  }
  assert(
    packedFiles.every(
      (file) =>
        file === "LICENSE" ||
        file === "README.md" ||
        file === "package.json" ||
        file.startsWith("dist/"),
    ),
    "The npm archive contains a file outside the release allowlist.",
  );
  const packedMetadata = await json(path.join(packageRoot, "package.json"));
  assert(
    packedMetadata.version === cliMetadata.version,
    "Packed npm version differs from the canonical version.",
  );
  assert(
    packedMetadata.repository?.url === expectedRepository,
    "Packed npm repository metadata is incorrect.",
  );

  await assertSafeTextTree(packageRoot);
  await assertSafeTextTree(
    path.join(repositoryRoot, "packages", "action", "dist"),
  );

  const actionEntry = path.join(
    repositoryRoot,
    "packages",
    "action",
    "dist",
    "index.js",
  );
  const providerFiles = (
    await filesBelow(path.join(packageRoot, "dist", "data"))
  ).filter((file) => file.endsWith(".yaml") && !file.startsWith("_"));
  const schemaFiles = (
    await filesBelow(path.join(packageRoot, "dist", "schemas"))
  ).filter((file) => file.endsWith(".json"));
  const manifest = {
    schema_version: 1,
    repository: "https://github.com/develra-dev/develra",
    version: cliMetadata.version,
    npm: {
      file: archiveName,
      bytes: (await stat(archive)).size,
      sha256: await sha256(archive),
      files: packedFiles.length,
      runtime_dependencies: 0,
    },
    action: {
      file: "packages/action/dist/index.js",
      bytes: (await stat(actionEntry)).size,
      sha256: await sha256(actionEntry),
    },
    embedded_assets: {
      providers: providerFiles.length,
      schemas: schemaFiles.length,
    },
  };
  await writeFile(
    path.join(artifactsRoot, "release-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  process.stdout.write(
    `Release audit passed for develra@${cliMetadata.version}.\n` +
      `Artifacts: release-artifacts/${archiveName}, release-manifest.json\n`,
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
