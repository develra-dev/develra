import { readFile, stat } from "node:fs/promises";
import nodePath from "node:path";

import {
  FixtureRegistry,
  mapContractChangesToInventory,
  parseJsonUnique,
  parseLockfile,
  type ContractChange,
  type ProviderContractState,
} from "@develra/core";
import { describe, expect, it, vi } from "vitest";

const registryRoot = nodePath.resolve("fixtures/registry");

async function fixtureJson<T>(name: string): Promise<T> {
  const path = nodePath.join(registryRoot, name);
  expect((await stat(path)).size).toBeLessThan(64 * 1024);
  return parseJsonUnique(await readFile(path, "utf8"), name) as T;
}

describe("fixture registry", () => {
  it("serves deterministic synthetic snapshots and changes without network access", async () => {
    const fetch = vi.fn(() => {
      throw new Error("FixtureRegistry attempted a network request.");
    });
    vi.stubGlobal("fetch", fetch);

    try {
      const [before, after, changes] = await Promise.all([
        fixtureJson<ProviderContractState>("stripe-before.json"),
        fixtureJson<ProviderContractState>("stripe-after.json"),
        fixtureJson<ContractChange[]>("changes.json"),
      ]);
      const registry = new FixtureRegistry({
        providerStates: [after],
        changes,
      });

      expect(before.revision).not.toBe(after.revision);
      expect(before.operations).toContain("checkout.sessions.create");
      expect(after.operations).not.toContain("checkout.sessions.create");
      await expect(registry.getProviderState("stripe")).resolves.toEqual({
        ...after,
        operations: ["payment_intents.create", "webhooks.constructEvent"],
      });
      await expect(
        registry.getChanges({ providerIds: ["stripe", "shopify"] }),
      ).resolves.toMatchObject([
        { id: "synthetic-stripe-checkout-removal" },
        { id: "synthetic-stripe-webhook-change" },
        { id: "synthetic-shopify-admin-change" },
      ]);
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("maps operation evidence strongly and provider-only evidence uncertainly", async () => {
    const [changes, lockfile] = await Promise.all([
      fixtureJson<ContractChange[]>("changes.json"),
      readFile(nodePath.resolve("fixtures/expected/ts-saas.lock"), "utf8").then(
        parseLockfile,
      ),
    ]);

    const relevance = mapContractChangesToInventory(
      changes,
      lockfile.providers,
    );

    expect(relevance).toHaveLength(2);
    expect(relevance[0]).toMatchObject({
      change: {
        id: "synthetic-stripe-checkout-removal",
        confidence: "confirmed",
      },
      match: "operation",
      strength: "strong",
      matchedOperations: ["checkout.sessions.create"],
      files: ["src/contracts.ts"],
    });
    expect(relevance[0]?.message).toBe(
      "stripe changed `checkout.sessions.create`. Develra detected the affected operation in file `src/contracts.ts`. Review the change before your next deployment.",
    );
    expect(relevance[1]).toMatchObject({
      change: {
        id: "synthetic-stripe-webhook-change",
        confidence: "probable",
      },
      match: "provider",
      strength: "weak",
      matchedOperations: [],
      files: [],
    });
    expect(relevance[1]?.message).toBe(
      "stripe published a potentially breaking change. This repository depends on stripe, but Develra did not detect the affected operation. Relevance is uncertain.",
    );
    expect(relevance.map(({ change }) => change.providerId)).not.toContain(
      "shopify",
    );
    expect(mapContractChangesToInventory(changes, lockfile.providers)).toEqual(
      relevance,
    );
  });
});
