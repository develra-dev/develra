import { execFile, execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import nodePath from "node:path";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const execute = promisify(execFile);
const roots: string[] = [];
const cli = nodePath.resolve("apps/cli/dist/index.js");

beforeAll(() => {
  execFileSync("pnpm", ["build"], {
    cwd: nodePath.resolve("."),
    stdio: "pipe",
  });
});

afterAll(async () => {
  await Promise.all(
    roots.map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function copyFixture(name: string): Promise<string> {
  const root = await mkdtemp(nodePath.join(os.tmpdir(), "develra-cli-"));
  roots.push(root);
  await execute("cp", [
    "-R",
    `${nodePath.resolve("fixtures/repositories", name)}/.`,
    root,
  ]);
  return root;
}

describe("packaged CLI", () => {
  it("prints version and planned commands", async () => {
    const metadata = JSON.parse(
      await readFile(nodePath.resolve("apps/cli/package.json"), "utf8"),
    ) as { version: string };
    expect(
      (await execute(process.execPath, [cli, "--version"])).stdout.trim(),
    ).toBe(metadata.version);
    const help = (await execute(process.execPath, [cli, "--help"])).stdout;
    expect(help).toContain("scan");
    expect(help).toContain("check");
    expect(help).toContain("providers");
  });

  it("writes, checks, graphs, and emits machine JSON", async () => {
    const root = await copyFixture("ts-saas");
    await execute(process.execPath, [
      cli,
      "scan",
      root,
      "--report",
      "report.md",
      "--graph",
      "graph.svg",
      "--sarif",
      "develra.sarif",
    ]);
    expect(
      await readFile(nodePath.join(root, "develra.lock"), "utf8"),
    ).toContain("responses.create");
    expect(await readFile(nodePath.join(root, "graph.svg"), "utf8")).toContain(
      "<svg",
    );
    expect(
      (await execute(process.execPath, [cli, "check", root])).stdout,
    ).toContain("inventory is current");
    const machine = await execute(process.execPath, [
      cli,
      "scan",
      root,
      "--no-write",
      "--json",
      "-",
    ]);
    expect(JSON.parse(machine.stdout)).toMatchObject({
      schema_version: 1,
      command: "scan",
      status: "ok",
    });
  });

  it("uses exit 3 for a policy failure and exit 2 for an invalid lockfile", async () => {
    const root = await copyFixture("ts-saas");
    await execute(process.execPath, [cli, "scan", root]);
    await rm(nodePath.join(root, "src", "contracts.ts"));
    await expect(
      execute(process.execPath, [cli, "check", root]),
    ).rejects.toMatchObject({ code: 3 });
    await rm(nodePath.join(root, "develra.lock"));
    await expect(
      execute(process.execPath, [cli, "check", root]),
    ).rejects.toMatchObject({ code: 2 });
  });
});
