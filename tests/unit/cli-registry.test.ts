import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import nodePath from "node:path";

import { NoopRegistry } from "@develra/core";
import { performCheck } from "develra";
import { afterEach, describe, expect, it, vi } from "vitest";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("CLI registry activation", () => {
  it("does not instantiate a registry without the explicit option", async () => {
    const root = await mkdtemp(nodePath.join(os.tmpdir(), "develra-registry-"));
    temporaryRoots.push(root);
    await cp(nodePath.resolve("fixtures/repositories/ts-saas"), root, {
      recursive: true,
    });
    await writeFile(
      nodePath.join(root, "develra.lock"),
      await readFile(nodePath.resolve("fixtures/expected/ts-saas.lock")),
    );
    const registryFactory = vi.fn(() => new NoopRegistry());

    await performCheck({ root, quiet: true, registryFactory });

    expect(registryFactory).not.toHaveBeenCalled();
  });
});
