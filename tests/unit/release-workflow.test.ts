import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import nodePath from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const validator = nodePath.join(
  repositoryRoot,
  "scripts",
  "validate-release-tag.mjs",
);

describe("trusted npm publishing", () => {
  it("validates the exact package version and release notes", async () => {
    const metadata = JSON.parse(
      await readFile(
        nodePath.join(repositoryRoot, "apps", "cli", "package.json"),
        "utf8",
      ),
    ) as { version: string };
    const result = spawnSync(process.execPath, [validator], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        DEVELRA_RELEASE_TAG: `v${metadata.version}`,
      },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`develra@${metadata.version}`);

    const smokeWorkflow = await readFile(
      nodePath.join(
        repositoryRoot,
        ".github",
        "workflows",
        "published-release-smoke.yml",
      ),
      "utf8",
    );
    expect(smokeWorkflow).toContain(
      `npx --yes develra@${metadata.version} --version`,
    );
    expect(smokeWorkflow).toContain(
      `npx --yes develra@${metadata.version} scan --no-write`,
    );
  });

  it("rejects a tag that differs from the package version", () => {
    const result = spawnSync(process.execPath, [validator], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        DEVELRA_RELEASE_TAG: "v999.0.0",
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("does not match package version");
  });

  it("keeps publishing manual, tokenless, and scoped to npm OIDC", async () => {
    const workflow = await readFile(
      nodePath.join(repositoryRoot, ".github", "workflows", "publish-npm.yml"),
      "utf8",
    );

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s+push:/mu);
    expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
    expect(workflow).toContain("environment: npm");
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("npm@11.5.1");
    expect(workflow).toContain("pnpm release:validate");
    expect(workflow).toContain(
      'npm publish "./release-artifacts/develra-${DEVELRA_RELEASE_TAG#v}.tgz"',
    );
    expect(workflow).not.toMatch(/NPM_(?:TOKEN|AUTH_TOKEN)/u);
    expect(workflow).not.toContain("NODE_AUTH_TOKEN");
  });
});
