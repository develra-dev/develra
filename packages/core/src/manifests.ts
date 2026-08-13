import { parse as parseToml } from "smol-toml";

import { errorMessage } from "./errors.js";
import {
  asRecord,
  parseJsonUnique,
  parseYamlUnique,
  stringValue,
} from "./parsing.js";
import type { Diagnostic, Ecosystem, Evidence, PackageRef } from "./types.js";

export interface AdapterEvidenceResult {
  readonly evidence: readonly Evidence[];
  readonly diagnostics: readonly Diagnostic[];
}

function normalizePackageName(ecosystem: Ecosystem, name: string): string {
  const trimmed = name.trim();
  return ecosystem === "pypi"
    ? trimmed.toLowerCase().replaceAll(/[_.]+/gu, "-")
    : trimmed.toLowerCase();
}

function addPackageEvidence(
  evidence: Evidence[],
  relativePath: string,
  kind: "manifest" | "lockfile",
  packageRef: PackageRef,
  metadata?: Evidence["metadata"],
): void {
  evidence.push({
    kind,
    relativePath,
    strength: "weak",
    package: packageRef,
    ...(metadata ? { metadata } : {}),
  });
}

export function parseNpmManifest(
  text: string,
  relativePath: string,
): AdapterEvidenceResult {
  const evidence: Evidence[] = [];
  const diagnostics: Diagnostic[] = [];
  try {
    const root = asRecord(parseJsonUnique(text, relativePath));
    if (!root) throw new TypeError("Expected a JSON object");
    const sections = [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ] as const;
    for (const section of sections) {
      const dependencies = asRecord(root[section]);
      if (!dependencies) continue;
      for (const [rawName, rawVersion] of Object.entries(dependencies)) {
        const name = normalizePackageName("npm", rawName);
        const version = stringValue(rawVersion);
        if (
          !name ||
          !version ||
          version.startsWith("file:") ||
          version.startsWith("link:")
        )
          continue;
        addPackageEvidence(
          evidence,
          relativePath,
          "manifest",
          { ecosystem: "npm", name, version, direct: true },
          { manifestSection: section },
        );
      }
    }
  } catch (error) {
    diagnostics.push({
      code: "DVL_PARSE_PACKAGE_JSON",
      severity: "warning",
      message: `Invalid package manifest; skipped npm evidence (${errorMessage(error)}).`,
      file: relativePath,
    });
  }
  return { evidence, diagnostics };
}

function parsePackageLock(
  text: string,
  relativePath: string,
): AdapterEvidenceResult {
  const evidence: Evidence[] = [];
  const diagnostics: Diagnostic[] = [];
  try {
    const root = asRecord(parseJsonUnique(text, relativePath));
    if (!root) throw new TypeError("Expected a JSON object");
    const packages = asRecord(root.packages);
    const rootPackage = asRecord(packages?.[""]);
    const directNames = new Set<string>();
    for (const section of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ]) {
      for (const name of Object.keys(asRecord(rootPackage?.[section]) ?? {}))
        directNames.add(name.toLowerCase());
    }
    for (const name of [...directNames].sort()) {
      const packageRecord = asRecord(packages?.[`node_modules/${name}`]);
      const version = stringValue(packageRecord?.version);
      if (version) {
        addPackageEvidence(
          evidence,
          relativePath,
          "lockfile",
          {
            ecosystem: "npm",
            name,
            version,
            direct: true,
          },
          { resolved: true },
        );
      }
    }
  } catch (error) {
    diagnostics.push({
      code: "DVL_PARSE_PACKAGE_LOCK",
      severity: "warning",
      message: `Invalid package-lock.json; manifest versions remain available (${errorMessage(error)}).`,
      file: relativePath,
    });
  }
  return { evidence, diagnostics };
}

function dependencyVersion(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  return stringValue(asRecord(value)?.version);
}

function parsePnpmLock(
  text: string,
  relativePath: string,
): AdapterEvidenceResult {
  const evidence: Evidence[] = [];
  const diagnostics: Diagnostic[] = [];
  try {
    const root = asRecord(parseYamlUnique(text, relativePath));
    const importers = asRecord(root?.importers);
    for (const [importerName, importerValue] of Object.entries(
      importers ?? {},
    )) {
      const importer = asRecord(importerValue);
      if (!importer) continue;
      for (const section of [
        "dependencies",
        "devDependencies",
        "optionalDependencies",
      ] as const) {
        const dependencies = asRecord(importer[section]);
        for (const [rawName, rawValue] of Object.entries(dependencies ?? {})) {
          const version = dependencyVersion(rawValue)?.replace(/^npm:/u, "");
          if (!version) continue;
          addPackageEvidence(
            evidence,
            relativePath,
            "lockfile",
            {
              ecosystem: "npm",
              name: normalizePackageName("npm", rawName),
              version,
              direct: true,
            },
            { manifestSection: section, resolved: true, binding: importerName },
          );
        }
      }
    }
  } catch (error) {
    diagnostics.push({
      code: "DVL_PARSE_PNPM_LOCK",
      severity: "warning",
      message: `Invalid pnpm lockfile; manifest versions remain available (${errorMessage(error)}).`,
      file: relativePath,
    });
  }
  return { evidence, diagnostics };
}

export function parseNpmLock(
  text: string,
  relativePath: string,
): AdapterEvidenceResult {
  if (relativePath.endsWith("package-lock.json"))
    return parsePackageLock(text, relativePath);
  if (/pnpm-lock\.ya?ml$/u.test(relativePath))
    return parsePnpmLock(text, relativePath);
  return {
    evidence: [],
    diagnostics: [
      {
        code: "DVL_LOCK_YARN_UNSUPPORTED",
        severity: "info",
        message:
          "yarn.lock version resolution is not enabled; manifest declarations were still scanned.",
        file: relativePath,
      },
    ],
  };
}

function parsePep508(
  input: string,
): { name: string; version?: string } | undefined {
  const withoutMarker = input.split(";", 1)[0]?.trim() ?? "";
  if (
    !withoutMarker ||
    withoutMarker.startsWith("-") ||
    withoutMarker.includes(" @ file:")
  )
    return undefined;
  const match = /^([A-Za-z0-9][A-Za-z0-9_.-]*)(?:\[[^\]]+\])?\s*(.*)$/u.exec(
    withoutMarker,
  );
  if (!match?.[1]) return undefined;
  const rawVersion = match[2]?.trim();
  const version =
    rawVersion && /^==[^,\s*]+$/u.test(rawVersion)
      ? rawVersion.slice(2)
      : rawVersion;
  return {
    name: normalizePackageName("pypi", match[1]),
    ...(version ? { version } : {}),
  };
}

function pythonEvidence(
  relativePath: string,
  name: string,
  version?: string,
): Evidence {
  return {
    kind: "manifest",
    relativePath,
    strength: "weak",
    package: {
      ecosystem: "pypi",
      name,
      direct: true,
      ...(version ? { version } : {}),
    },
  };
}

function parseRequirements(
  text: string,
  relativePath: string,
): AdapterEvidenceResult {
  const evidence: Evidence[] = [];
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.split("#", 1)[0]?.trim() ?? "";
    const parsed = parsePep508(line);
    if (parsed)
      evidence.push(pythonEvidence(relativePath, parsed.name, parsed.version));
  }
  return { evidence, diagnostics: [] };
}

function parsePyproject(
  text: string,
  relativePath: string,
): AdapterEvidenceResult {
  const value = asRecord(parseToml(text));
  const evidence: Evidence[] = [];
  const project = asRecord(value?.project);
  if (Array.isArray(project?.dependencies)) {
    for (const raw of project.dependencies) {
      if (typeof raw !== "string") continue;
      const parsed = parsePep508(raw);
      if (parsed)
        evidence.push(
          pythonEvidence(relativePath, parsed.name, parsed.version),
        );
    }
  }
  const poetry = asRecord(asRecord(value?.tool)?.poetry);
  for (const [rawName, rawVersion] of Object.entries(
    asRecord(poetry?.dependencies) ?? {},
  )) {
    if (rawName.toLowerCase() === "python") continue;
    const version =
      typeof rawVersion === "string"
        ? rawVersion
        : stringValue(asRecord(rawVersion)?.version);
    evidence.push(
      pythonEvidence(
        relativePath,
        normalizePackageName("pypi", rawName),
        version,
      ),
    );
  }
  return { evidence, diagnostics: [] };
}

function parsePipfile(
  text: string,
  relativePath: string,
): AdapterEvidenceResult {
  const value = asRecord(parseToml(text));
  const evidence: Evidence[] = [];
  for (const section of ["packages", "dev-packages"]) {
    for (const [rawName, rawVersion] of Object.entries(
      asRecord(value?.[section]) ?? {},
    )) {
      const version =
        typeof rawVersion === "string" && rawVersion !== "*"
          ? rawVersion
          : undefined;
      evidence.push(
        pythonEvidence(
          relativePath,
          normalizePackageName("pypi", rawName),
          version,
        ),
      );
    }
  }
  return { evidence, diagnostics: [] };
}

export function parsePythonManifest(
  text: string,
  relativePath: string,
): AdapterEvidenceResult {
  try {
    if (/requirements[^/]*\.txt$/iu.test(relativePath))
      return parseRequirements(text, relativePath);
    if (relativePath.toLowerCase().endsWith("pipfile"))
      return parsePipfile(text, relativePath);
    return parsePyproject(text, relativePath);
  } catch (error) {
    return {
      evidence: [],
      diagnostics: [
        {
          code: "DVL_PARSE_PYTHON_MANIFEST",
          severity: "warning",
          message: `Invalid Python manifest; skipped dependency evidence (${errorMessage(error)}).`,
          file: relativePath,
        },
      ],
    };
  }
}

export function parsePythonLock(
  _text: string,
  relativePath: string,
): AdapterEvidenceResult {
  return {
    evidence: [],
    diagnostics: [
      {
        code: "DVL_LOCK_PYTHON_UNSUPPORTED",
        severity: "info",
        message:
          "This Python lock format is not yet used for version resolution; manifest declarations were still scanned.",
        file: relativePath,
      },
    ],
  };
}
