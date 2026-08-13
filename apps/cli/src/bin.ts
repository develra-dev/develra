#!/usr/bin/env node
import nodePath from "node:path";

import {
  DevelraError,
  errorMessage,
  parseLockfile,
  resolveReadableInsideRoot,
  type Confidence,
} from "@develra/core";
import {
  bundledProviderDirectory,
  loadBundledProviders,
  validateProviderPath,
} from "@develra/providers";
import { Command, CommanderError, Option } from "commander";
import { readFile } from "node:fs/promises";

import { loadConfig } from "./config.js";
import { performCheck, performScan, writeGraphFromLockfile } from "./index.js";
import { VERSION } from "./version.js";

const CONFIDENCE = ["possible", "probable", "confirmed"] as const;

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function confidence(value: string): Confidence {
  if (!(CONFIDENCE as readonly string[]).includes(value))
    throw new Error(`Expected possible, probable, or confirmed; got ${value}.`);
  return value as Confidence;
}

function positiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw new Error(`Expected a positive integer; got ${value}.`);
  return parsed;
}

function rootFor(pathArgument: string | undefined, globalRoot: string): string {
  return nodePath.resolve(globalRoot, pathArgument ?? ".");
}

const program = new Command()
  .name("develra")
  .description("Local-first external-contract scanner and lockfile")
  .version(VERSION)
  .option("--root <path>", "repository root", ".")
  .option("--config <path>", "configuration path")
  .option("--quiet", "suppress nonessential output")
  .option("--no-color", "disable ANSI color")
  .option("--debug", "include debug diagnostics")
  .option("--strict", "treat recoverable diagnostics as errors")
  .showHelpAfterError();

program
  .command("scan")
  .description("scan a repository and write develra.lock")
  .argument("[path]", "repository path")
  .option("--no-write", "do not write develra.lock")
  .option("--lockfile <path>", "lockfile path")
  .option("--report <path>", "write Markdown report")
  .option("--json <path>", "write normalized JSON; use - for stdout")
  .option("--graph <path>", "write SVG graph")
  .option("--sarif <path>", "write SARIF")
  .addOption(
    new Option("--confidence <level>", "minimum visible confidence").choices([
      ...CONFIDENCE,
    ]),
  )
  .option("--include <glob>", "additional include", collect, [])
  .option("--exclude <glob>", "additional exclude", collect, [])
  .option(
    "--max-file-size <bytes>",
    "maximum source file size",
    positiveInteger,
  )
  .action(
    async (
      pathArgument: string | undefined,
      options: Record<string, unknown>,
      command: Command,
    ) => {
      const global = command.optsWithGlobals();
      const result = await performScan({
        root: rootFor(pathArgument, global.root as string),
        ...(global.config ? { config: global.config as string } : {}),
        write: options.write as boolean,
        ...(options.lockfile ? { lockfile: options.lockfile as string } : {}),
        ...(options.report ? { report: options.report as string } : {}),
        ...(options.json ? { json: options.json as string } : {}),
        ...(options.graph ? { graph: options.graph as string } : {}),
        ...(options.sarif ? { sarif: options.sarif as string } : {}),
        ...(options.confidence
          ? { confidence: confidence(options.confidence as string) }
          : {}),
        ...((options.include as string[]).length
          ? { include: options.include as string[] }
          : {}),
        ...((options.exclude as string[]).length
          ? { exclude: options.exclude as string[] }
          : {}),
        ...(options.maxFileSize
          ? { maxFileSize: options.maxFileSize as number }
          : {}),
        strict: Boolean(global.strict),
        quiet: Boolean(global.quiet),
      });
      if (result.result.diagnostics.some((item) => item.severity === "error"))
        process.exitCode = 3;
    },
  );

program
  .command("check")
  .description("verify develra.lock matches the repository")
  .argument("[path]", "repository path")
  .option("--lockfile <path>", "lockfile path")
  .addOption(
    new Option("--fail-on <level>", "confidence threshold").choices([
      "none",
      ...CONFIDENCE,
    ]),
  )
  .option("--fail-on-change <kind>", "change kind", collect, [])
  .option("--json <path>", "write JSON; use - for stdout")
  .option("--markdown <path>", "write Markdown report")
  .option("--sarif <path>", "write SARIF")
  .action(
    async (
      pathArgument: string | undefined,
      options: Record<string, unknown>,
      command: Command,
    ) => {
      const global = command.optsWithGlobals();
      const result = await performCheck({
        root: rootFor(pathArgument, global.root as string),
        ...(global.config ? { config: global.config as string } : {}),
        ...(options.lockfile ? { lockfile: options.lockfile as string } : {}),
        ...(options.failOn
          ? { failOn: options.failOn as Confidence | "none" }
          : {}),
        ...((options.failOnChange as string[]).length
          ? { failOnChanges: options.failOnChange as never[] }
          : {}),
        ...(options.json ? { json: options.json as string } : {}),
        ...(options.markdown ? { markdown: options.markdown as string } : {}),
        ...(options.sarif ? { sarif: options.sarif as string } : {}),
        strict: Boolean(global.strict),
        quiet: Boolean(global.quiet),
      });
      if (!result.passed) process.exitCode = 3;
    },
  );

program
  .command("graph")
  .description("render a deterministic SVG contract graph")
  .argument("[path]", "repository path")
  .option("--lockfile <path>", "lockfile path", "develra.lock")
  .requiredOption("--output <path>", "SVG output path")
  .option("--include-unknowns", "include unknown external signals")
  .option("--title <text>", "graph title")
  .addOption(
    new Option("--confidence <level>", "minimum confidence")
      .choices([...CONFIDENCE])
      .default("possible"),
  )
  .action(
    async (
      pathArgument: string | undefined,
      options: Record<string, unknown>,
      command: Command,
    ) => {
      const global = command.optsWithGlobals();
      const root = rootFor(pathArgument, global.root as string);
      const target = await writeGraphFromLockfile(
        root,
        options.lockfile as string,
        options.output as string,
        {
          ...(options.title ? { title: options.title as string } : {}),
          ...(options.includeUnknowns ? { includeUnknowns: true } : {}),
          confidence: confidence(options.confidence as string),
        },
      );
      if (!global.quiet)
        process.stdout.write(
          `Wrote ${nodePath.relative(root, target).replaceAll("\\", "/")}\n`,
        );
    },
  );

const providers = program
  .command("providers")
  .description("inspect and validate provider packs");
providers
  .command("list")
  .description("list bundled provider packs")
  .option("--json", "emit JSON")
  .action(async (options: { json?: boolean }) => {
    const catalog = await loadBundledProviders();
    if (options.json)
      process.stdout.write(`${JSON.stringify(catalog.providers, null, 2)}\n`);
    else {
      for (const provider of catalog.providers) {
        const packages = Object.entries(provider.packages ?? {}).flatMap(
          ([ecosystem, values]) =>
            (values ?? []).map((value) => `${ecosystem}:${value}`),
        );
        process.stdout.write(
          `${provider.id.padEnd(12)} ${provider.name}  ${packages.join(", ")}  ${(provider.domains ?? []).join(", ")}\n`,
        );
      }
    }
  });
providers
  .command("validate")
  .description("validate a provider YAML file or directory")
  .argument("<path>", "provider path")
  .action(async (path: string) => {
    const result = await validateProviderPath(nodePath.resolve(path));
    for (const diagnostic of result.diagnostics)
      process.stderr.write(`${diagnostic.code} ${diagnostic.message}\n`);
    if (!result.valid)
      throw new DevelraError(
        "Provider validation failed.",
        2,
        "DVL_PROVIDER_INVALID",
      );
    process.stdout.write(
      `Validated ${result.providers.length} provider pack${result.providers.length === 1 ? "" : "s"}.\n`,
    );
  });

program
  .command("doctor")
  .description(
    "report local environment and configuration without scanning source",
  )
  .action(async (_options: unknown, command: Command) => {
    const global = command.optsWithGlobals();
    const root = nodePath.resolve(global.root as string);
    const config = await loadConfig(root, global.config as string | undefined);
    const catalog = await loadBundledProviders();
    let lockStatus = "missing";
    try {
      await parseLockfile(
        await readFile(
          await resolveReadableInsideRoot(
            root,
            config?.lockfile?.path ?? "develra.lock",
          ),
          "utf8",
        ),
      );
      lockStatus = "valid v1";
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        lockStatus = "invalid";
    }
    const displayRoot = process.env.CI ? "." : root;
    process.stdout.write(
      [
        `Node                  ${process.versions.node}`,
        `Repository root       ${displayRoot}`,
        `Config                ${config ? (global.config ?? "develra.config.yaml") : "none"}`,
        `Bundled providers     ${catalog.providers.length} valid`,
        `Provider directory    ${process.env.CI ? "packages/providers/data" : bundledProviderDirectory()}`,
        `Lockfile              ${lockStatus}`,
        "Network for scan      disabled",
      ].join("\n") + "\n",
    );
  });

program.exitOverride();

async function main(): Promise<void> {
  try {
    if (process.argv.length === 2) {
      program.outputHelp();
      return;
    }
    await program.parseAsync(process.argv);
  } catch (error) {
    if (
      error instanceof CommanderError &&
      ["commander.helpDisplayed", "commander.version"].includes(error.code)
    ) {
      process.exitCode = 0;
    } else {
      const debug = process.argv.includes("--debug");
      process.stderr.write(`Develra: ${errorMessage(error)}\n`);
      if (debug && error instanceof Error && error.stack)
        process.stderr.write(`${error.stack}\n`);
      process.exitCode =
        error instanceof DevelraError
          ? error.exitCode
          : error instanceof CommanderError
            ? 2
            : 1;
    }
  }
}

void main();
