import { execFile } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import nodePath from "node:path";
import { promisify } from "node:util";

import { scanRepository, serializeLockfile, toLockfile } from "@develra/core";
import { loadBundledProviders } from "@develra/providers";
import { afterEach, describe, expect, it } from "vitest";

const execute = promisify(execFile);
const roots: string[] = [];
const action = nodePath.resolve("packages/action/dist/index.js");

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function actionFixture(): Promise<{
  control: string;
  workspace: string;
  output: string;
  summary: string;
}> {
  const control = await mkdtemp(nodePath.join(os.tmpdir(), "develra-action-"));
  roots.push(control);
  const workspace = nodePath.join(control, "workspace");
  await mkdir(workspace);
  await execute("cp", [
    "-R",
    `${nodePath.resolve("fixtures/repositories/ts-saas")}/.`,
    workspace,
  ]);
  const output = nodePath.join(control, "output");
  const summary = nodePath.join(control, "summary");
  await writeFile(output, "", "utf8");
  await writeFile(summary, "", "utf8");
  return { control, workspace, output, summary };
}

function environment(
  fixture: Awaited<ReturnType<typeof actionFixture>>,
  extra: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GITHUB_WORKSPACE: fixture.workspace,
    GITHUB_OUTPUT: fixture.output,
    GITHUB_STEP_SUMMARY: fixture.summary,
    INPUT_ROOT: ".",
    INPUT_LOCKFILE: "develra.lock",
    INPUT_MARKDOWN: "develra-report.md",
    INPUT_SARIF: "develra.sarif",
    ...extra,
  };
}

describe("bundled GitHub Action", () => {
  it("packages only schemas required by the CLI and Action runtimes", async () => {
    const expected = [
      "develra-config.schema.json",
      "develra-lock.schema.json",
      "provider.schema.json",
      "registry-response.schema.json",
    ];
    for (const root of ["apps/cli", "packages/action"]) {
      expect(
        (await readdir(nodePath.resolve(root, "dist/schemas"))).sort(),
      ).toEqual(expected);
    }
  });

  it("runs without a workspace install and writes outputs", async () => {
    const fixture = await actionFixture();
    await execute(process.execPath, [action], {
      cwd: fixture.control,
      env: environment(fixture, { INPUT_COMMAND: "scan" }),
    });
    expect(
      await readFile(nodePath.join(fixture.workspace, "develra.lock"), "utf8"),
    ).toContain("responses.create");
    expect(await readFile(fixture.output, "utf8")).toContain("ok");
    expect(await readFile(fixture.summary, "utf8")).toContain(
      "Develra external-contract scan",
    );
  });

  it("fails distinctly when a probable contract is added", async () => {
    const fixture = await actionFixture();
    const baseline = await scanRepository({
      root: fixture.workspace,
      catalog: await loadBundledProviders(),
    });
    await writeFile(
      nodePath.join(fixture.workspace, "develra.lock"),
      serializeLockfile(toLockfile(baseline)),
      "utf8",
    );
    await writeFile(
      nodePath.join(fixture.workspace, "src", "mail.ts"),
      'import { Resend } from "resend"; export const mail = new Resend();',
      "utf8",
    );
    const packageJsonPath = nodePath.join(fixture.workspace, "package.json");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      dependencies: Record<string, string>;
    };
    packageJson.dependencies.resend = "6.0.0";
    await writeFile(
      packageJsonPath,
      `${JSON.stringify(packageJson, null, 2)}\n`,
      "utf8",
    );
    await expect(
      execute(process.execPath, [action], {
        cwd: fixture.control,
        env: environment(fixture, {
          INPUT_COMMAND: "check",
          "INPUT_FAIL-ON": "probable",
        }),
      }),
    ).rejects.toMatchObject({ code: 1 });
    expect(await readFile(fixture.output, "utf8")).toContain("changed");
  });

  it("reports but passes a possible-only change at the default threshold", async () => {
    const fixture = await actionFixture();
    const baseline = await scanRepository({
      root: fixture.workspace,
      catalog: await loadBundledProviders(),
    });
    await writeFile(
      nodePath.join(fixture.workspace, "develra.lock"),
      serializeLockfile(toLockfile(baseline)),
      "utf8",
    );
    await writeFile(
      nodePath.join(fixture.workspace, "src", "new-webhook.ts"),
      'export const partnerWebhook = "https://hooks.new-partner.com/receive";\n',
      "utf8",
    );
    await execute(process.execPath, [action], {
      cwd: fixture.control,
      env: environment(fixture, { INPUT_COMMAND: "check" }),
    });
    expect(await readFile(fixture.output, "utf8")).toContain("ok");
    expect(await readFile(fixture.summary, "utf8")).toContain(
      "Contract inventory changed",
    );
  });

  it("classifies an invalid lockfile as an Action error", async () => {
    const fixture = await actionFixture();
    await writeFile(
      nodePath.join(fixture.workspace, "develra.lock"),
      "version: [\n",
      "utf8",
    );
    await expect(
      execute(process.execPath, [action], {
        cwd: fixture.control,
        env: environment(fixture, { INPUT_COMMAND: "check" }),
      }),
    ).rejects.toMatchObject({ code: 1 });
    expect(await readFile(fixture.output, "utf8")).toContain("error");
  });

  it("rejects a root traversal", async () => {
    const fixture = await actionFixture();
    await expect(
      execute(process.execPath, [action], {
        cwd: fixture.control,
        env: environment(fixture, {
          INPUT_COMMAND: "check",
          INPUT_ROOT: "../",
        }),
      }),
    ).rejects.toMatchObject({ code: 1 });
    expect(await readFile(fixture.output, "utf8")).toContain("error");
  });

  it("rejects a scan-root symlink outside GITHUB_WORKSPACE", async () => {
    const fixture = await actionFixture();
    const outside = nodePath.join(fixture.control, "outside");
    await mkdir(outside);
    await symlink(outside, nodePath.join(fixture.workspace, "linked-root"));
    await expect(
      execute(process.execPath, [action], {
        cwd: fixture.control,
        env: environment(fixture, {
          INPUT_COMMAND: "scan",
          INPUT_ROOT: "linked-root",
        }),
      }),
    ).rejects.toMatchObject({ code: 1 });
    expect(await readFile(fixture.output, "utf8")).toContain("error");
  });
});
