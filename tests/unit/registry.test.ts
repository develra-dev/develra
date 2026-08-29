import {
  NoopRegistry,
  type ContractChange,
  type ProviderContractState,
} from "@develra/core";
import { describe, expect, it, vi } from "vitest";

describe("contract registry boundary", () => {
  it("keeps the default no-op capability explicitly offline", async () => {
    const fetch = vi.fn(() => {
      throw new Error("NoopRegistry attempted a network request.");
    });
    vi.stubGlobal("fetch", fetch);

    try {
      const registry = new NoopRegistry();

      await expect(registry.getCapabilities()).resolves.toEqual({
        mode: "offline",
        remote: false,
        providerState: false,
        changes: false,
      });
      await expect(registry.getProviderState("stripe")).resolves.toBeNull();
      await expect(
        registry.getChanges({ providerIds: ["stripe"] }),
      ).resolves.toEqual([]);
      expect(registry.mode).toBe("offline");
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("requires provenance and confidence on registry data models", () => {
    const provenance = {
      kind: "fixture",
      sourceId: "fixture:stripe-openapi",
      retrievedAt: "2026-08-29T00:00:00Z",
      contentHash: "sha256:fixture",
    } as const;
    const state = {
      providerId: "stripe",
      revision: "2026-08-29",
      operations: ["checkout.sessions.create"],
      endpoints: [],
      confidence: "confirmed",
      provenance,
    } satisfies ProviderContractState;
    const change = {
      id: "stripe-checkout-change",
      providerId: "stripe",
      observedAt: "2026-08-29T00:00:00Z",
      severity: "breaking",
      operations: ["checkout.sessions.create"],
      endpoints: [],
      summary: "Fixture checkout contract changed.",
      confidence: "probable",
      provenance,
    } satisfies ContractChange;

    expect(state.provenance).toBe(provenance);
    expect(state.confidence).toBe("confirmed");
    expect(change.provenance).toBe(provenance);
    expect(change.confidence).toBe("probable");
  });
});
