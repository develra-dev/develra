import type { Confidence, EndpointRef } from "./types.js";

export const REGISTRY_MODES = ["offline", "fixture", "remote"] as const;
export type RegistryMode = (typeof REGISTRY_MODES)[number];

export type RegistryCapabilities =
  | {
      readonly mode: "offline";
      readonly remote: false;
      readonly providerState: false;
      readonly changes: false;
    }
  | {
      readonly mode: "fixture";
      readonly remote: false;
      readonly providerState: boolean;
      readonly changes: boolean;
    }
  | {
      readonly mode: "remote";
      readonly remote: true;
      readonly providerState: boolean;
      readonly changes: boolean;
    };

export interface RegistryProvenance {
  readonly kind: "fixture" | "remote";
  readonly sourceId: string;
  readonly retrievedAt: string;
  readonly sourceUrl?: string;
  readonly contentHash?: string;
}

export interface ProviderContractState {
  readonly providerId: string;
  readonly revision: string;
  readonly operations: readonly string[];
  readonly endpoints: readonly EndpointRef[];
  readonly confidence: Confidence;
  readonly provenance: RegistryProvenance;
}

export type ContractChangeSeverity =
  "breaking" | "warning" | "informational" | "unknown";

export interface ContractChange {
  readonly id: string;
  readonly providerId: string;
  readonly observedAt: string;
  readonly effectiveAt?: string;
  readonly severity: ContractChangeSeverity;
  readonly operations: readonly string[];
  readonly endpoints: readonly EndpointRef[];
  readonly summary: string;
  readonly confidence: Confidence;
  readonly provenance: RegistryProvenance;
}

export interface ChangeQuery {
  readonly providerIds: readonly string[];
  readonly since?: string;
}

export interface ContractRegistry {
  readonly mode: RegistryMode;
  getCapabilities(): Promise<RegistryCapabilities>;
  getProviderState(providerId: string): Promise<ProviderContractState | null>;
  getChanges(query: ChangeQuery): Promise<readonly ContractChange[]>;
}

const NOOP_CAPABILITIES: RegistryCapabilities = Object.freeze({
  mode: "offline",
  remote: false,
  providerState: false,
  changes: false,
});
const NO_CHANGES: readonly ContractChange[] = Object.freeze([]);

export class NoopRegistry implements ContractRegistry {
  readonly mode = "offline" as const;

  getCapabilities(): Promise<RegistryCapabilities> {
    return Promise.resolve(NOOP_CAPABILITIES);
  }

  getProviderState(providerId: string): Promise<null> {
    void providerId;
    return Promise.resolve(null);
  }

  getChanges(query: ChangeQuery): Promise<readonly ContractChange[]> {
    void query;
    return Promise.resolve(NO_CHANGES);
  }
}
