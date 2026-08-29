import type { Confidence, EndpointRef, ProviderFinding } from "./types.js";
import { DevelraError } from "./errors.js";

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

export type ContractChangeMatch = "provider" | "operation";
export type ContractChangeRelevanceStrength = "weak" | "strong";

export interface ContractChangeRelevance {
  readonly change: ContractChange;
  readonly match: ContractChangeMatch;
  readonly strength: ContractChangeRelevanceStrength;
  readonly matchedOperations: readonly string[];
  readonly files: readonly string[];
  readonly message: string;
}

export type RegistryCheckResult =
  | {
      readonly status: "no_changes";
      readonly findings: readonly [];
    }
  | {
      readonly status: "changes";
      readonly findings: readonly ContractChangeRelevance[];
    };

const NOOP_CAPABILITIES: RegistryCapabilities = Object.freeze({
  mode: "offline",
  remote: false,
  providerState: false,
  changes: false,
});
const NO_CHANGES: readonly ContractChange[] = Object.freeze([]);

const FIXTURE_CAPABILITIES: RegistryCapabilities = Object.freeze({
  mode: "fixture",
  remote: false,
  providerState: true,
  changes: true,
});

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function cloneEndpoint(endpoint: EndpointRef): EndpointRef {
  return {
    method: endpoint.method,
    path: endpoint.path,
    ...(endpoint.host === undefined ? {} : { host: endpoint.host }),
  };
}

function cloneProvenance(provenance: RegistryProvenance): RegistryProvenance {
  return {
    kind: provenance.kind,
    sourceId: provenance.sourceId,
    retrievedAt: provenance.retrievedAt,
    ...(provenance.sourceUrl === undefined
      ? {}
      : { sourceUrl: provenance.sourceUrl }),
    ...(provenance.contentHash === undefined
      ? {}
      : { contentHash: provenance.contentHash }),
  };
}

function cloneProviderState(
  state: ProviderContractState,
): ProviderContractState {
  return {
    providerId: state.providerId,
    revision: state.revision,
    operations: [...state.operations].sort(compareText),
    endpoints: state.endpoints.map(cloneEndpoint).sort(compareEndpoints),
    confidence: state.confidence,
    provenance: cloneProvenance(state.provenance),
  };
}

function compareEndpoints(left: EndpointRef, right: EndpointRef): number {
  return (
    compareText(left.host ?? "", right.host ?? "") ||
    compareText(left.path, right.path) ||
    compareText(left.method, right.method)
  );
}

function cloneChange(change: ContractChange): ContractChange {
  return {
    id: change.id,
    providerId: change.providerId,
    observedAt: change.observedAt,
    ...(change.effectiveAt === undefined
      ? {}
      : { effectiveAt: change.effectiveAt }),
    severity: change.severity,
    operations: [...change.operations].sort(compareText),
    endpoints: change.endpoints.map(cloneEndpoint).sort(compareEndpoints),
    summary: change.summary,
    confidence: change.confidence,
    provenance: cloneProvenance(change.provenance),
  };
}

function compareChanges(left: ContractChange, right: ContractChange): number {
  return (
    compareText(left.observedAt, right.observedAt) ||
    compareText(left.providerId, right.providerId) ||
    compareText(left.id, right.id)
  );
}

function formatInlineList(values: readonly string[]): string {
  return values.map((value) => `\`${value}\``).join(", ");
}

function providerOnlyMessage(change: ContractChange): string {
  const description =
    change.severity === "breaking"
      ? "a potentially breaking change"
      : change.severity === "warning"
        ? "a change that may require attention"
        : change.severity === "unknown"
          ? "a contract change with unknown severity"
          : "a contract change";
  return `${change.providerId} published ${description}. This repository depends on ${change.providerId}, but Develra did not detect the affected operation. Relevance is uncertain.`;
}

function operationMessage(
  change: ContractChange,
  operations: readonly string[],
  files: readonly string[],
): string {
  const operationNoun = operations.length === 1 ? "operation" : "operations";
  const fileNoun = files.length === 1 ? "file" : "files";
  return `${change.providerId} changed ${formatInlineList(operations)}. Develra detected the affected ${operationNoun} in ${fileNoun} ${formatInlineList(files)}. Review the change before your next deployment.`;
}

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

export class FixtureRegistry implements ContractRegistry {
  readonly mode = "fixture" as const;
  readonly #providerStates: ReadonlyMap<string, ProviderContractState>;
  readonly #changes: readonly ContractChange[];

  constructor(input: {
    readonly providerStates: readonly ProviderContractState[];
    readonly changes: readonly ContractChange[];
  }) {
    this.#providerStates = new Map(
      input.providerStates.map((state) => [
        state.providerId,
        cloneProviderState(state),
      ]),
    );
    this.#changes = input.changes.map(cloneChange).sort(compareChanges);
  }

  getCapabilities(): Promise<RegistryCapabilities> {
    return Promise.resolve(FIXTURE_CAPABILITIES);
  }

  getProviderState(providerId: string): Promise<ProviderContractState | null> {
    const state = this.#providerStates.get(providerId);
    return Promise.resolve(
      state === undefined ? null : cloneProviderState(state),
    );
  }

  getChanges(query: ChangeQuery): Promise<readonly ContractChange[]> {
    const providerIds = new Set(query.providerIds);
    return Promise.resolve(
      this.#changes
        .filter(
          (change) =>
            providerIds.has(change.providerId) &&
            (query.since === undefined || change.observedAt > query.since),
        )
        .map(cloneChange),
    );
  }
}

export async function checkRegistryForInventory(
  registry: ContractRegistry,
  providers: readonly ProviderFinding[],
): Promise<RegistryCheckResult> {
  const capabilities = await registry.getCapabilities();
  if (!capabilities.remote || !capabilities.changes) {
    throw new DevelraError(
      "The selected registry does not provide remote changes.",
      4,
      "DVL_REGISTRY_CAPABILITY",
    );
  }
  if (providers.length === 0) return { status: "no_changes", findings: [] };

  const changes = await registry.getChanges({
    providerIds: providers.map((provider) => provider.id),
  });
  const findings = mapContractChangesToInventory(changes, providers);
  return findings.length === 0
    ? { status: "no_changes", findings: [] }
    : { status: "changes", findings };
}

export function mapContractChangesToInventory(
  changes: readonly ContractChange[],
  providers: readonly ProviderFinding[],
): readonly ContractChangeRelevance[] {
  const inventory = new Map(
    providers.map((provider) => [provider.id, provider]),
  );

  return [...changes]
    .sort(compareChanges)
    .flatMap((change): ContractChangeRelevance[] => {
      const provider = inventory.get(change.providerId);
      if (provider === undefined) return [];

      const changedOperations = new Set(change.operations);
      const matched = provider.operations
        .filter((operation) => changedOperations.has(operation.id))
        .sort((left, right) => compareText(left.id, right.id));
      const matchedOperations = matched.map((operation) => operation.id);
      const files = [
        ...new Set(matched.flatMap((operation) => operation.files)),
      ].sort(compareText);

      if (matchedOperations.length === 0) {
        return [
          {
            change: cloneChange(change),
            match: "provider",
            strength: "weak",
            matchedOperations: [],
            files: [],
            message: providerOnlyMessage(change),
          },
        ];
      }

      return [
        {
          change: cloneChange(change),
          match: "operation",
          strength: "strong",
          matchedOperations,
          files,
          message: operationMessage(change, matchedOperations, files),
        },
      ];
    });
}
