import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import nodePath from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020Import, {
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import addFormatsImport from "ajv-formats";

import { DevelraError } from "./errors.js";

type SchemaName =
  | "develra-lock.schema.json"
  | "develra-config.schema.json"
  | "registry-response.schema.json";

interface AjvLike {
  compile(schema: object): ValidateFunction;
}

type AjvConstructor = new (options: Record<string, unknown>) => AjvLike;
type FormatInstaller = (ajv: AjvLike) => unknown;

const Ajv2020 = Ajv2020Import as unknown as AjvConstructor;
const addFormats = addFormatsImport as unknown as FormatInstaller;

const validatorCache = new Map<SchemaName, Promise<ValidateFunction>>();

function bundledSchemaPath(name: SchemaName): string {
  const moduleDirectory = nodePath.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    nodePath.join(moduleDirectory, "schemas", name),
    nodePath.resolve(moduleDirectory, "../../../schemas", name),
    nodePath.resolve("schemas", name),
  ];
  return (
    candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]!
  );
}

async function schemaValidator(name: SchemaName): Promise<ValidateFunction> {
  let pending = validatorCache.get(name);
  if (!pending) {
    pending = (async () => {
      const schema = JSON.parse(
        await readFile(bundledSchemaPath(name), "utf8"),
      ) as object;
      const ajv = new Ajv2020({
        allErrors: true,
        strict: true,
        validateFormats: true,
      });
      addFormats(ajv);
      return ajv.compile(schema);
    })();
    validatorCache.set(name, pending);
  }
  return pending;
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

export async function validateLockfile(value: unknown): Promise<void> {
  const validator = await schemaValidator("develra-lock.schema.json");
  if (!validator(value)) {
    throw new DevelraError(
      `Invalid develra.lock: ${formatErrors(validator.errors)}`,
      2,
      "DVL_LOCK_SCHEMA",
    );
  }
}

export async function validateConfig(value: unknown): Promise<void> {
  const validator = await schemaValidator("develra-config.schema.json");
  if (!validator(value)) {
    throw new DevelraError(
      `Invalid Develra config: ${formatErrors(validator.errors)}`,
      2,
      "DVL_CONFIG_SCHEMA",
    );
  }
}

export async function validateRegistryResponse(value: unknown): Promise<void> {
  const validator = await schemaValidator("registry-response.schema.json");
  if (!validator(value)) {
    throw new DevelraError(
      `Invalid registry response: ${formatErrors(validator.errors)}`,
      4,
      "DVL_REGISTRY_SCHEMA",
    );
  }
}
