import { access, readFile } from "node:fs/promises";
import nodePath from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();

describe("launch artifacts", () => {
  it("keeps the terminal demo pinned, non-writing, and credential-free", async () => {
    const metadata = JSON.parse(
      await readFile(
        nodePath.join(repositoryRoot, "apps", "cli", "package.json"),
        "utf8",
      ),
    ) as { version: string };
    const tape = await readFile(
      nodePath.join(repositoryRoot, "examples", "terminal-demo.tape"),
      "utf8",
    );

    expect(tape).toContain(`develra@${metadata.version} scan --no-write`);
    expect(tape).toContain("fixtures/repositories/ts-saas");
    expect(tape).not.toMatch(/(?:TOKEN|SECRET|PASSWORD|API_KEY)/u);
    expect(tape).not.toContain("rm ");
  });

  it("links every required launch artifact without future-product claims", async () => {
    const [launch, action, issues] = await Promise.all([
      readFile(
        nodePath.join(repositoryRoot, "docs", "16-launch-artifacts.md"),
        "utf8",
      ),
      readFile(nodePath.join(repositoryRoot, "action.yml"), "utf8"),
      readFile(
        nodePath.join(repositoryRoot, "docs", "13-good-first-issues.md"),
        "utf8",
      ),
    ]);

    for (const heading of [
      "## Terminal recording",
      "## Show HN draft",
      "## Technical launch article outline",
      "## GitHub Marketplace copy",
      "## Existing launch collateral",
    ]) {
      expect(launch).toContain(heading);
    }
    expect(launch).toContain("Develra External Contract Check");
    expect(action).toContain("name: Develra External Contract Check");
    expect(launch).toContain("does not continuously monitor");
    expect(launch).not.toMatch(/(?:sign up|free trial|pricing plan)/iu);
    expect(issues.match(/^- /gmu)).toHaveLength(10);

    await Promise.all(
      [
        "examples/develra-graph.svg",
        "docs/releases/v0.1.0.md",
        "docs/releases/v0.1.1.md",
        "docs/releases/v0.1.2.md",
        "docs/releases/v0.2.0.md",
      ].map((relative) => access(nodePath.join(repositoryRoot, relative))),
    );
  });
});
