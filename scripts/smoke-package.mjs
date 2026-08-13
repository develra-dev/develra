import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { runNpm, runPnpm } from "./commands.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const temporary = await mkdtemp(
  path.join(os.tmpdir(), "develra-package-smoke-"),
);

try {
  runPnpm(["--filter", "develra", "pack", "--pack-destination", temporary], {
    cwd: repositoryRoot,
    stdio: "pipe",
  });
  const archiveName = (await readdir(temporary)).find((entry) =>
    entry.endsWith(".tgz"),
  );
  if (!archiveName) throw new Error("CLI package archive was not created.");

  const installRoot = path.join(temporary, "install");
  const fixtureRoot = path.join(temporary, "repository");
  await mkdir(installRoot);
  await cp(
    path.join(repositoryRoot, "fixtures", "repositories", "ts-saas"),
    fixtureRoot,
    { recursive: true },
  );
  await writeFile(
    path.join(installRoot, "package.json"),
    '{"name":"develra-smoke","private":true}\n',
    "utf8",
  );
  const npmEnvironment = {
    ...process.env,
    NPM_CONFIG_CACHE: path.join(temporary, "npm-cache"),
  };
  runNpm(
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--offline",
      path.join(temporary, archiveName),
    ],
    { cwd: installRoot, env: npmEnvironment, stdio: "pipe" },
  );
  const packagedCli = path.join(
    installRoot,
    "node_modules",
    "develra",
    "dist",
    "index.js",
  );
  const packageJson = JSON.parse(
    await readFile(
      path.join(installRoot, "node_modules", "develra", "package.json"),
      "utf8",
    ),
  );
  const version = execFileSync(process.execPath, [packagedCli, "--version"], {
    encoding: "utf8",
  }).trim();
  if (version !== packageJson.version)
    throw new Error(`Unexpected packaged version: ${version}`);
  const output = execFileSync(
    process.execPath,
    [packagedCli, "scan", fixtureRoot],
    {
      encoding: "utf8",
    },
  );
  if (!output.includes("OpenAI") || !output.includes("Stripe")) {
    throw new Error(
      "Packaged CLI did not produce the expected fixture inventory.",
    );
  }
  const lockfilePath = path.join(fixtureRoot, "develra.lock");
  const firstLockfile = await readFile(lockfilePath, "utf8");
  if (
    firstLockfile.includes("never-serialize") ||
    firstLockfile.includes(temporary)
  ) {
    throw new Error(
      "Packaged scan leaked a secret or absolute temporary path.",
    );
  }
  execFileSync(process.execPath, [packagedCli, "check", fixtureRoot], {
    encoding: "utf8",
  });
  execFileSync(process.execPath, [packagedCli, "scan", fixtureRoot], {
    encoding: "utf8",
  });
  if ((await readFile(lockfilePath, "utf8")) !== firstLockfile) {
    throw new Error(
      "Packaged scan did not reproduce identical lockfile bytes.",
    );
  }
  if (
    packageJson.dependencies &&
    Object.keys(packageJson.dependencies).length > 0
  ) {
    throw new Error("Packaged CLI unexpectedly retained runtime dependencies.");
  }
  process.stdout.write("Packaged CLI smoke test passed offline.\n");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
