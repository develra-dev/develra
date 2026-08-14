import { readFile, readdir, stat } from "node:fs/promises";
import nodePath from "node:path";

import { describe, expect, it } from "vitest";

type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

interface ExpectedState {
  state: "present" | "absent";
  value?: JsonValue;
}

interface ExpectedCase {
  version: number;
  id: string;
  source_type: "openapi" | "mcp";
  synthetic: boolean;
  license: string;
  change: {
    kind: string;
    severity: "breaking" | "warning" | "informational" | "unknown";
    scope: string;
    operations: string[];
    summary: string;
    pointer: string;
    before: ExpectedState;
    after: ExpectedState;
  };
}

const museumRoot = nodePath.resolve("examples/breakage-museum");
const expectedCases = [
  "mcp-input-schema-change",
  "operation-removed",
  "removed-response-field",
  "required-request-field",
  "response-enum-expansion",
];

async function json(file: string): Promise<JsonValue> {
  return JSON.parse(await readFile(file, "utf8")) as JsonValue;
}

function pointerState(document: JsonValue, pointer: string): ExpectedState {
  expect(pointer).toMatch(/^\/(?:[^/]+(?:\/[^/]+)*)?$/u);
  let current: JsonValue = document;
  for (const encoded of pointer.slice(1).split("/")) {
    const segment = encoded.replaceAll("~1", "/").replaceAll("~0", "~");
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isSafeInteger(index) || index < 0 || index >= current.length)
        return { state: "absent" };
      const next = current[index];
      if (next === undefined) return { state: "absent" };
      current = next;
      continue;
    }
    if (
      current === null ||
      typeof current !== "object" ||
      !(segment in current)
    )
      return { state: "absent" };
    const next = current[segment];
    if (next === undefined) return { state: "absent" };
    current = next;
  }
  return { state: "present", value: current };
}

describe("Breakage Museum", () => {
  it("contains the complete synthetic starter corpus", async () => {
    const cases = (await readdir(museumRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(cases).toEqual(expectedCases);
  });

  for (const caseName of expectedCases) {
    it(`runs ${caseName} as a deterministic regression fixture`, async () => {
      const caseRoot = nodePath.join(museumRoot, caseName);
      const beforeFile = nodePath.join(caseRoot, "before", "contract.json");
      const afterFile = nodePath.join(caseRoot, "after", "contract.json");
      const expectedFile = nodePath.join(caseRoot, "expected", "change.json");
      const readmeFile = nodePath.join(caseRoot, "README.md");
      const [before, after, expectedValue, readme] = await Promise.all([
        json(beforeFile),
        json(afterFile),
        json(expectedFile),
        readFile(readmeFile, "utf8"),
      ]);
      const expected = expectedValue as unknown as ExpectedCase;

      expect(expected).toMatchObject({
        version: 1,
        id: caseName,
        synthetic: true,
        license: "Apache-2.0",
      });
      expect(["openapi", "mcp"]).toContain(expected.source_type);
      expect(expected.change.kind).toMatch(/^[a-z][a-z0-9_]+$/u);
      expect(expected.change.scope).toMatch(/^[a-z][a-z0-9_]+$/u);
      expect(expected.change.operations.length).toBeGreaterThan(0);
      expect(expected.change.summary.length).toBeGreaterThan(20);
      expect(pointerState(before, expected.change.pointer)).toEqual(
        expected.change.before,
      );
      expect(pointerState(after, expected.change.pointer)).toEqual(
        expected.change.after,
      );
      expect(expected.change.before).not.toEqual(expected.change.after);
      expect(readme).toContain("synthetic");
      expect(readme).toContain(`\`${expected.change.kind}\``);
      expect(readme).toContain(`\`${expected.change.severity}\``);

      for (const file of [beforeFile, afterFile, expectedFile, readmeFile]) {
        expect((await stat(file)).size).toBeLessThan(64 * 1024);
      }
    });
  }
});
