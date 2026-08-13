import { readFileSync } from "node:fs";
import nodePath from "node:path";

interface PackageMetadata {
  readonly name?: unknown;
  readonly version?: unknown;
}

function readPackageVersion(): string {
  const metadata = JSON.parse(
    readFileSync(nodePath.join(__dirname, "../package.json"), "utf8"),
  ) as PackageMetadata;
  if (
    metadata.name !== "develra" ||
    typeof metadata.version !== "string" ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(metadata.version)
  ) {
    throw new Error("The Develra package version is missing or invalid.");
  }
  return metadata.version;
}

export const VERSION = readPackageVersion();
