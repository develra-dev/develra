import { readFile, stat } from "node:fs/promises";
import nodePath from "node:path";

import { parseJsonUnique, parseYamlUnique } from "@develra/core";
import Ajv2020Import, {
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import addFormatsImport from "ajv-formats";
import { beforeAll, describe, expect, it } from "vitest";

type JsonRecord = Record<string, unknown>;

interface AjvLike {
  compile(schema: object): ValidateFunction;
}

type AjvConstructor = new (options: Record<string, unknown>) => AjvLike;
type FormatInstaller = (ajv: AjvLike) => unknown;

const Ajv2020 = Ajv2020Import as unknown as AjvConstructor;
const addFormats = addFormatsImport as unknown as FormatInstaller;

const contractPath = nodePath.resolve("schemas/registry.openapi.yaml");
const fixtureRoot = nodePath.resolve("fixtures/registry-api");

const fixtureSchemas = {
  "capabilities-response.json": "CapabilitiesEnvelopeV1",
  "providers-response.json": "ProviderListEnvelopeV1",
  "provider-response.json": "ProviderEnvelopeV1",
  "provider-state-response.json": "ProviderStateEnvelopeV1",
  "changes-response.json": "ChangeListEnvelopeV1",
  "error-response.json": "ErrorEnvelopeV1",
} as const;

let contract: JsonRecord;

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as JsonRecord;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array.`);
  return value;
}

function localReferences(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(localReferences);
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) =>
    key === "$ref" && typeof child === "string"
      ? [child]
      : localReferences(child),
  );
}

function resolvePointer(document: unknown, pointer: string): unknown {
  let current = document;
  for (const encoded of pointer.slice(2).split("/")) {
    const segment = encoded.replaceAll("~1", "/").replaceAll("~0", "~");
    current = record(current, pointer)[segment];
  }
  return current;
}

function rewriteSchemaReferences(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(rewriteSchemaReferences);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      key === "$ref" &&
      typeof child === "string" &&
      child.startsWith("#/components/schemas/")
        ? child.replace("#/components/schemas/", "#/$defs/")
        : rewriteSchemaReferences(child),
    ]),
  );
}

function formatErrors(
  errors: readonly ErrorObject[] | null | undefined,
): string {
  return (errors ?? [])
    .map(
      (error) =>
        `${error.instancePath || "/"} ${error.message ?? "is invalid"}`,
    )
    .join("; ");
}

async function fixture(name: string): Promise<unknown> {
  const path = nodePath.join(fixtureRoot, name);
  expect((await stat(path)).size).toBeLessThan(64 * 1024);
  return parseJsonUnique(await readFile(path, "utf8"), name);
}

beforeAll(async () => {
  expect((await stat(contractPath)).size).toBeLessThan(128 * 1024);
  contract = record(
    parseYamlUnique(await readFile(contractPath, "utf8"), contractPath),
    "registry OpenAPI contract",
  );
});

describe("public registry OpenAPI contract", () => {
  it("exposes only the bounded unauthenticated read API", () => {
    expect(contract.openapi).toBe("3.1.0");
    expect(contract.security).toEqual([]);
    expect(contract).not.toHaveProperty("servers");

    const paths = record(contract.paths, "paths");
    expect(Object.keys(paths).sort()).toEqual([
      "/v1/capabilities",
      "/v1/changes",
      "/v1/providers",
      "/v1/providers/{provider_id}",
      "/v1/providers/{provider_id}/state",
    ]);
    const operationIds = new Set<string>();
    for (const [path, item] of Object.entries(paths)) {
      expect(Object.keys(record(item, path))).toEqual(["get"]);
      const operation = record(record(item, path).get, `${path} GET`);
      expect(operation).not.toHaveProperty("requestBody");
      expect(operation.operationId).toEqual(expect.any(String));
      operationIds.add(operation.operationId as string);
      const responses = record(operation.responses, `${path} responses`);
      expect(responses).toHaveProperty("200");
      expect(responses).toHaveProperty("304");
      expect(responses).toHaveProperty("429");
      expect(responses).toHaveProperty("503");
      const successHeaders = record(
        record(responses["200"], `${path} 200`).headers,
        `${path} 200 headers`,
      );
      expect(successHeaders).toHaveProperty("Cache-Control");
      expect(successHeaders).toHaveProperty("ETag");
    }
    expect(operationIds.size).toBe(Object.keys(paths).length);

    const components = record(contract.components, "components");
    expect(components).not.toHaveProperty("securitySchemes");
    expect(JSON.stringify(paths)).not.toMatch(
      /\/auth|\/billing|\/login|\/inventories|"post"|"requestBody"/u,
    );
  });

  it("defines versioned envelopes, pagination, caching, and bounded errors", () => {
    const paths = record(contract.paths, "paths");
    const changes = record(
      record(paths["/v1/changes"], "changes path").get,
      "changes operation",
    );
    expect(changes.description).toMatch(/exclusive lower bound/u);
    expect(changes.description).toMatch(/Cursors are opaque/u);
    expect(array(changes.parameters, "change parameters")).toEqual(
      expect.arrayContaining([
        { $ref: "#/components/parameters/ProviderIds" },
        { $ref: "#/components/parameters/Since" },
        { $ref: "#/components/parameters/Cursor" },
        { $ref: "#/components/parameters/Limit" },
      ]),
    );

    const components = record(contract.components, "components");
    const headers = record(components.headers, "headers");
    expect(
      record(
        record(headers.StableCacheControl, "stable cache").schema,
        "schema",
      ).const,
    ).toBe("public, max-age=300, stale-while-revalidate=60");
    expect(
      record(
        record(headers.ChangeCacheControl, "change cache").schema,
        "schema",
      ).const,
    ).toBe("public, max-age=60, stale-while-revalidate=60");
    expect(
      record(
        record(headers.NoStoreCacheControl, "error cache").schema,
        "schema",
      ).const,
    ).toBe("no-store");

    const schemas = record(components.schemas, "schemas");
    for (const [name, value] of Object.entries(schemas)) {
      if (!name.endsWith("EnvelopeV1")) continue;
      const schema = record(value, name);
      expect(array(schema.required, `${name}.required`)).toContain(
        "api_version",
      );
      expect(
        record(
          record(schema.properties, `${name}.properties`).api_version,
          `${name}.api_version`,
        ).const,
      ).toBe("v1");
    }
    const errorEnvelope = record(schemas.ErrorEnvelopeV1, "error envelope");
    expect(array(errorEnvelope.required, "error envelope required")).toEqual(
      expect.arrayContaining([
        "api_version",
        "type",
        "title",
        "status",
        "code",
        "request_id",
      ]),
    );
    expect(
      record(errorEnvelope.properties, "error envelope properties"),
    ).not.toHaveProperty("error");

    const errorResponses = record(components.responses, "responses");
    for (const name of [
      "BadRequest",
      "NotFound",
      "TooManyRequests",
      "ServiceUnavailable",
    ]) {
      expect(JSON.stringify(errorResponses[name])).toContain(
        "application/problem+json",
      );
      expect(JSON.stringify(errorResponses[name])).toContain("ErrorEnvelopeV1");
    }
  });

  it("resolves every reference and validates all synthetic response fixtures", async () => {
    const references = localReferences(contract);
    expect(references.length).toBeGreaterThan(40);
    for (const reference of references) {
      expect(reference).toMatch(/^#\//u);
      expect(resolvePointer(contract, reference), reference).toBeDefined();
    }

    const schemas = record(
      record(contract.components, "components").schemas,
      "schemas",
    );
    const rewrittenSchemas = rewriteSchemaReferences(schemas) as JsonRecord;
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);

    for (const [name, schemaName] of Object.entries(fixtureSchemas)) {
      const validate = ajv.compile({
        $schema: "https://json-schema.org/draft/2020-12/schema",
        $ref: `#/$defs/${schemaName}`,
        $defs: rewrittenSchemas,
      });
      const value = await fixture(name);
      expect(validate(value), `${name}: ${formatErrors(validate.errors)}`).toBe(
        true,
      );
    }

    const validateCapabilities = ajv.compile({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $ref: "#/$defs/CapabilitiesEnvelopeV1",
      $defs: rewrittenSchemas,
    });
    expect(
      validateCapabilities({
        ...((await fixture("capabilities-response.json")) as JsonRecord),
        api_version: "v2",
      }),
    ).toBe(false);
  });
});
