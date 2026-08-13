import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import nodePath from "node:path";
import { fileURLToPath } from "node:url";

import type {
  Diagnostic,
  ProviderCatalog,
  ProviderDefinition,
} from "@develra/core";
import Ajv2020Import, {
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import addFormatsImport from "ajv-formats";
import { parseDocument } from "yaml";

export interface ProviderValidationResult {
  readonly valid: boolean;
  readonly providers: readonly ProviderDefinition[];
  readonly diagnostics: readonly Diagnostic[];
}

interface AjvLike {
  compile(schema: object): ValidateFunction;
}

type AjvConstructor = new (options: Record<string, unknown>) => AjvLike;
type FormatInstaller = (ajv: AjvLike) => unknown;

const Ajv2020 = Ajv2020Import as unknown as AjvConstructor;
const addFormats = addFormatsImport as unknown as FormatInstaller;

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorsText(errors: readonly ErrorObject[] | null | undefined): string {
  return (errors ?? [])
    .map(
      (error) =>
        `${error.instancePath || "/"} ${error.message ?? "is invalid"}`,
    )
    .join("; ");
}

async function providerValidator(): Promise<ValidateFunction> {
  const schema = JSON.parse(
    await readFile(
      new URL("../../../schemas/provider.schema.json", import.meta.url),
      "utf8",
    ),
  ) as object;
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    validateFormats: true,
  });
  addFormats(ajv);
  return ajv.compile(schema);
}

function parseProvider(text: string, file: string): ProviderDefinition {
  const document = parseDocument(text, {
    prettyErrors: false,
    strict: true,
    uniqueKeys: true,
  });
  if (document.errors.length > 0)
    throw new Error(document.errors.map((error) => error.message).join("; "));
  const value = document.toJS({ maxAliasCount: 100 }) as unknown;
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${file}: expected an object`);
  return value as ProviderDefinition;
}

async function yamlFiles(path: string): Promise<string[]> {
  const pathStat = await stat(path);
  if (pathStat.isFile()) return [path];
  if (!pathStat.isDirectory()) return [];
  return (await readdir(path))
    .filter(
      (entry) =>
        !entry.startsWith("_") &&
        (entry.endsWith(".yaml") || entry.endsWith(".yml")),
    )
    .sort(compare)
    .map((entry) => nodePath.join(path, entry));
}

export async function validateProviderPath(
  path: string,
): Promise<ProviderValidationResult> {
  const validator = await providerValidator();
  const providers: ProviderDefinition[] = [];
  const diagnostics: Diagnostic[] = [];
  for (const file of await yamlFiles(path)) {
    try {
      const provider = parseProvider(await readFile(file, "utf8"), file);
      if (!validator(provider)) {
        diagnostics.push({
          code: "DVL_PROVIDER_SCHEMA",
          severity: "error",
          message: `${nodePath.basename(file)}: ${errorsText(validator.errors)}`,
        });
      } else providers.push(provider);
    } catch (error) {
      diagnostics.push({
        code: "DVL_PROVIDER_PARSE",
        severity: "error",
        message: `${nodePath.basename(file)}: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
  diagnostics.push(...semanticDiagnostics(providers));
  return {
    valid: diagnostics.every((item) => item.severity !== "error"),
    providers,
    diagnostics,
  };
}

function semanticDiagnostics(
  providers: readonly ProviderDefinition[],
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const ids = new Map<string, string>();
  const packages = new Map<string, string>();
  const domains = new Map<string, string>();
  for (const provider of [...providers].sort((left, right) =>
    compare(left.id, right.id),
  )) {
    const previousId = ids.get(provider.id);
    if (previousId)
      diagnostics.push({
        code: "DVL_PROVIDER_ID_CONFLICT",
        severity: "error",
        message: `Duplicate provider ID: ${provider.id}`,
      });
    ids.set(provider.id, provider.id);
    for (const [ecosystem, names] of Object.entries(provider.packages ?? {})) {
      for (const name of names ?? []) {
        const key = `${ecosystem}:${name.toLowerCase()}`;
        const previous = packages.get(key);
        if (previous && previous !== provider.id) {
          diagnostics.push({
            code: "DVL_PROVIDER_PACKAGE_CONFLICT",
            severity: "error",
            message: `${key} is claimed by both ${previous} and ${provider.id}.`,
          });
        }
        packages.set(key, provider.id);
      }
    }
    for (const domain of provider.domains ?? []) {
      const key = domain.toLowerCase();
      const previous = domains.get(key);
      if (previous && previous !== provider.id) {
        diagnostics.push({
          code: "DVL_PROVIDER_DOMAIN_CONFLICT",
          severity: "error",
          message: `${key} is claimed by both ${previous} and ${provider.id}.`,
        });
      }
      domains.set(key, provider.id);
    }
    const operationIds = new Set<string>();
    const matchers = new Set<string>();
    for (const operation of provider.operations ?? []) {
      if (operationIds.has(operation.id)) {
        diagnostics.push({
          code: "DVL_PROVIDER_OPERATION_CONFLICT",
          severity: "error",
          message: `${provider.id} repeats operation ${operation.id}.`,
        });
      }
      operationIds.add(operation.id);
      for (const matcher of operation.matchers) {
        const key = JSON.stringify(matcher);
        if (matchers.has(key)) {
          diagnostics.push({
            code: "DVL_PROVIDER_MATCHER_CONFLICT",
            severity: "error",
            message: `${provider.id} repeats a matcher for ${operation.id}.`,
          });
        }
        matchers.add(key);
      }
    }
  }
  return diagnostics.sort((left, right) =>
    compare(`${left.code}:${left.message}`, `${right.code}:${right.message}`),
  );
}

export function createProviderCatalog(
  providers: readonly ProviderDefinition[],
): ProviderCatalog {
  const semantic = semanticDiagnostics(providers);
  if (semantic.length > 0)
    throw new Error(semantic.map((item) => item.message).join("; "));
  const sorted = [...providers].sort((left, right) =>
    compare(left.id, right.id),
  );
  const packageIndex = new Map<string, ProviderDefinition>();
  const importIndex = new Map<string, ProviderDefinition>();
  const domainIndex = new Map<string, ProviderDefinition>();
  for (const provider of sorted) {
    for (const [ecosystem, names] of Object.entries(provider.packages ?? {})) {
      for (const name of names ?? [])
        packageIndex.set(`${ecosystem}:${name.toLowerCase()}`, provider);
    }
    for (const item of provider.imports ?? [])
      importIndex.set(`${item.language}:${item.source}`, provider);
    for (const domain of provider.domains ?? [])
      domainIndex.set(domain.toLowerCase(), provider);
  }
  return Object.freeze({
    providers: Object.freeze(sorted),
    packageIndex,
    importIndex,
    domainIndex,
  });
}

export function bundledProviderDirectory(): string {
  const moduleDirectory = nodePath.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    nodePath.resolve(moduleDirectory, "data"),
    nodePath.resolve(moduleDirectory, "../data"),
    nodePath.resolve("packages/providers/data"),
  ];
  return (
    candidates.find((candidate) => existsSync(candidate)) ??
    candidates[0] ??
    nodePath.resolve("packages/providers/data")
  );
}

let bundledCatalog: Promise<ProviderCatalog> | undefined;

export async function loadBundledProviders(): Promise<ProviderCatalog> {
  bundledCatalog ??= (async () => {
    const result = await validateProviderPath(bundledProviderDirectory());
    if (!result.valid)
      throw new Error(
        result.diagnostics.map((item) => item.message).join("; "),
      );
    return createProviderCatalog(result.providers);
  })();
  return bundledCatalog;
}
