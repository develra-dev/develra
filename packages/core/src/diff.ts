import type {
  ChangeKind,
  Confidence,
  InventoryChange,
  LockfileDiff,
  LockfileDocument,
  PolicyResult,
} from "./types.js";

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stable(value: unknown): string {
  return JSON.stringify(value);
}

function addChange(changes: InventoryChange[], change: InventoryChange): void {
  changes.push(change);
}

export function diffLockfiles(
  expected: LockfileDocument,
  current: LockfileDocument,
): LockfileDiff {
  const changes: InventoryChange[] = [];
  const expectedProviders = new Map(
    expected.providers.map((provider) => [provider.id, provider]),
  );
  const currentProviders = new Map(
    current.providers.map((provider) => [provider.id, provider]),
  );
  for (const id of [
    ...new Set([...expectedProviders.keys(), ...currentProviders.keys()]),
  ].sort(compare)) {
    const before = expectedProviders.get(id);
    const after = currentProviders.get(id);
    if (!before && after) {
      addChange(changes, {
        type: "added",
        kind: "provider",
        key: id,
        confidence: after.confidence,
        files: after.files,
      });
      continue;
    }
    if (before && !after) {
      addChange(changes, {
        type: "removed",
        kind: "provider",
        key: id,
        confidence: before.confidence,
        files: before.files,
      });
      continue;
    }
    if (!before || !after) continue;
    if (before.confidence !== after.confidence) {
      addChange(changes, {
        type: "changed",
        kind: "provider",
        key: id,
        confidence: after.confidence,
        files: after.files,
        before: before.confidence,
        after: after.confidence,
      });
    }

    const beforePackages = new Map(
      before.packages.map((item) => [`${item.ecosystem}:${item.name}`, item]),
    );
    const afterPackages = new Map(
      after.packages.map((item) => [`${item.ecosystem}:${item.name}`, item]),
    );
    for (const key of [
      ...new Set([...beforePackages.keys(), ...afterPackages.keys()]),
    ].sort(compare)) {
      const oldValue = beforePackages.get(key);
      const newValue = afterPackages.get(key);
      if (stable(oldValue) !== stable(newValue)) {
        addChange(changes, {
          type:
            oldValue && newValue ? "changed" : oldValue ? "removed" : "added",
          kind: "package",
          key,
          providerId: id,
          confidence: after.confidence,
          files: after.files,
          ...(oldValue?.version ? { before: oldValue.version } : {}),
          ...(newValue?.version ? { after: newValue.version } : {}),
        });
      }
    }

    for (const [kind, oldItems, newItems] of [
      ["operation", before.operations, after.operations],
      ["endpoint", before.endpoints, after.endpoints],
    ] as const) {
      const keyOf = (item: (typeof oldItems)[number]): string =>
        "id" in item
          ? item.id
          : `${item.method}:${item.host ?? ""}:${item.path}`;
      const oldMap = new Map(oldItems.map((item) => [keyOf(item), item]));
      const newMap = new Map(newItems.map((item) => [keyOf(item), item]));
      for (const key of [...new Set([...oldMap.keys(), ...newMap.keys()])].sort(
        compare,
      )) {
        const oldValue = oldMap.get(key);
        const newValue = newMap.get(key);
        if (stable(oldValue) !== stable(newValue)) {
          addChange(changes, {
            type:
              oldValue && newValue ? "changed" : oldValue ? "removed" : "added",
            kind,
            key,
            providerId: id,
            confidence:
              newValue?.confidence ?? oldValue?.confidence ?? after.confidence,
            files: newValue?.files ?? oldValue?.files ?? after.files,
          });
        }
      }
    }
    if (stable(before.api_versions) !== stable(after.api_versions)) {
      addChange(changes, {
        type: "changed",
        kind: "provider",
        key: `${id}:api-versions`,
        providerId: id,
        confidence: after.confidence,
        files: after.files,
        before: before.api_versions.join(","),
        after: after.api_versions.join(","),
      });
    }
  }

  const diffSimple = <T extends { confidence: Confidence }>(
    kind: "mcp" | "unknown",
    beforeItems: readonly T[],
    afterItems: readonly T[],
    keyOf: (item: T) => string,
    filesOf: (item: T) => readonly string[],
  ): void => {
    const beforeMap = new Map(beforeItems.map((item) => [keyOf(item), item]));
    const afterMap = new Map(afterItems.map((item) => [keyOf(item), item]));
    for (const key of [
      ...new Set([...beforeMap.keys(), ...afterMap.keys()]),
    ].sort(compare)) {
      const beforeValue = beforeMap.get(key);
      const afterValue = afterMap.get(key);
      if (stable(beforeValue) !== stable(afterValue)) {
        const selected = afterValue ?? beforeValue;
        if (!selected) continue;
        addChange(changes, {
          type:
            beforeValue && afterValue
              ? "changed"
              : beforeValue
                ? "removed"
                : "added",
          kind,
          key,
          confidence: selected.confidence,
          files: filesOf(selected),
        });
      }
    }
  };
  diffSimple(
    "mcp",
    expected.mcp_servers,
    current.mcp_servers,
    (item) => `${item.id}:${item.transport}`,
    (item) => item.config_files,
  );
  diffSimple(
    "unknown",
    expected.unknowns,
    current.unknowns,
    (item) => `${item.kind}:${item.value}`,
    (item) => item.files,
  );

  changes.sort((left, right) =>
    compare(
      `${left.kind}:${left.providerId ?? ""}:${left.key}:${left.type}`,
      `${right.kind}:${right.providerId ?? ""}:${right.key}:${right.type}`,
    ),
  );
  return { changes, changed: changes.length > 0 };
}

const SCORE: Readonly<Record<Confidence, number>> = {
  possible: 0,
  probable: 1,
  confirmed: 2,
};

export function evaluatePolicy(
  diff: LockfileDiff,
  failOn: Confidence | "none" = "probable",
  kinds: readonly (ChangeKind | "any")[] = ["any"],
): PolicyResult {
  if (failOn === "none") return { passed: true, violations: [] };
  const violations = diff.changes.filter(
    (change) =>
      SCORE[change.confidence] >= SCORE[failOn] &&
      (kinds.includes("any") || kinds.includes(change.kind)),
  );
  return { passed: violations.length === 0, violations };
}
