import { readFile, rename, writeFile } from "node:fs/promises";
import nodePath from "node:path";

import {
  DevelraError,
  diffLockfiles,
  evaluatePolicy,
  parseLockfile,
  resolveReadableInsideRoot,
  resolveWritableInsideRoot,
  scanRepository,
  serializeLockfile,
  toLockfile,
  writeLockfileAtomic,
  type ChangeKind,
  type Confidence,
  type LockfileDiff,
  type ScanResult,
} from "@develra/core";
import { loadBundledProviders } from "@develra/providers";
import {
  renderConsole,
  renderDiffConsole,
  renderDiffMarkdown,
  renderJson,
  renderMarkdown,
  renderSarif,
  renderSvg,
} from "@develra/reporters";

import { loadConfig } from "./config.js";

export interface OutputWriter {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export const processWriter: OutputWriter = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

async function writeArtifact(
  root: string,
  requestedPath: string,
  contents: string,
): Promise<string> {
  const target = await resolveWritableInsideRoot(root, requestedPath);
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, contents, "utf8");
  await rename(temporary, target);
  return target;
}

function outputPath(root: string, target: string): string {
  return nodePath.relative(root, target).replaceAll("\\", "/") || ".";
}

export interface ScanCommandOptions {
  readonly root: string;
  readonly config?: string;
  readonly write?: boolean;
  readonly lockfile?: string;
  readonly report?: string;
  readonly json?: string;
  readonly graph?: string;
  readonly sarif?: string;
  readonly confidence?: Confidence;
  readonly include?: readonly string[];
  readonly exclude?: readonly string[];
  readonly maxFileSize?: number;
  readonly strict?: boolean;
  readonly quiet?: boolean;
  readonly writer?: OutputWriter;
}

export interface ScanCommandResult {
  readonly result: ScanResult;
  readonly lockfilePath?: string;
  readonly reportPaths: readonly string[];
}

export async function performScan(
  options: ScanCommandOptions,
): Promise<ScanCommandResult> {
  const root = nodePath.resolve(options.root);
  const config = await loadConfig(root, options.config);
  const catalog = await loadBundledProviders();
  const include = options.include?.length
    ? options.include
    : config?.scan?.include;
  const exclude = options.exclude?.length
    ? options.exclude
    : config?.scan?.exclude;
  const maxFileSize = options.maxFileSize ?? config?.scan?.max_file_size;
  const result = await scanRepository({
    root,
    catalog,
    ...(include ? { include } : {}),
    ...(exclude ? { exclude } : {}),
    ...(maxFileSize ? { maxFileSize } : {}),
    ...(options.strict ? { strict: true } : {}),
  });
  const lockfile = toLockfile(result);
  const lockContents = serializeLockfile(lockfile);
  const reportPaths: string[] = [];
  const writer = options.writer ?? processWriter;
  const machineStdout = options.json === "-";
  const humanWriter = machineStdout ? writer.stderr : writer.stdout;

  if (!options.quiet)
    humanWriter(
      renderConsole(
        result,
        options.confidence ?? config?.scan?.confidence ?? "possible",
      ),
    );
  let lockfilePath: string | undefined;
  if (options.write !== false) {
    lockfilePath = await writeLockfileAtomic(
      root,
      options.lockfile ?? config?.lockfile?.path ?? "develra.lock",
      lockContents,
    );
    if (!options.quiet)
      humanWriter(`Wrote ${outputPath(root, lockfilePath)}\n`);
  }

  const markdownPath = options.report ?? config?.reporters?.markdown;
  const graphPath = options.graph ?? config?.reporters?.graph;
  const jsonPath = options.json ?? config?.reporters?.json;
  const sarifPath = options.sarif ?? config?.reporters?.sarif;
  if (markdownPath)
    reportPaths.push(
      await writeArtifact(root, markdownPath, renderMarkdown(result)),
    );
  if (graphPath)
    reportPaths.push(await writeArtifact(root, graphPath, renderSvg(lockfile)));
  if (sarifPath)
    reportPaths.push(await writeArtifact(root, sarifPath, renderSarif(result)));
  if (jsonPath === "-") {
    writer.stdout(
      renderJson({
        schema_version: 1,
        command: "scan",
        status: "ok",
        result: lockfile,
        diagnostics: result.diagnostics,
      }),
    );
  } else if (jsonPath) {
    reportPaths.push(
      await writeArtifact(
        root,
        jsonPath,
        renderJson({
          schema_version: 1,
          command: "scan",
          status: "ok",
          result: lockfile,
          diagnostics: result.diagnostics,
        }),
      ),
    );
  }
  return { result, ...(lockfilePath ? { lockfilePath } : {}), reportPaths };
}

export interface CheckCommandOptions {
  readonly root: string;
  readonly config?: string;
  readonly lockfile?: string;
  readonly failOn?: Confidence | "none";
  readonly failOnChanges?: readonly (ChangeKind | "any")[];
  readonly json?: string;
  readonly markdown?: string;
  readonly sarif?: string;
  readonly strict?: boolean;
  readonly quiet?: boolean;
  readonly writer?: OutputWriter;
}

export interface CheckCommandResult {
  readonly result: ScanResult;
  readonly diff: LockfileDiff;
  readonly passed: boolean;
  readonly violations: number;
  readonly reportPaths: readonly string[];
}

export async function performCheck(
  options: CheckCommandOptions,
): Promise<CheckCommandResult> {
  const root = nodePath.resolve(options.root);
  const config = await loadConfig(root, options.config);
  let expected;
  try {
    const lockfilePath = await resolveReadableInsideRoot(
      root,
      options.lockfile ?? config?.lockfile?.path ?? "develra.lock",
    );
    expected = await parseLockfile(await readFile(lockfilePath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new DevelraError(
        "develra.lock was not found. Run `develra scan` first.",
        2,
        "DVL_LOCK_MISSING",
        {
          cause: error,
        },
      );
    }
    throw error;
  }
  const catalog = await loadBundledProviders();
  const result = await scanRepository({
    root,
    catalog,
    ...(config?.scan?.include ? { include: config.scan.include } : {}),
    ...(config?.scan?.exclude ? { exclude: config.scan.exclude } : {}),
    ...(config?.scan?.max_file_size
      ? { maxFileSize: config.scan.max_file_size }
      : {}),
    ...(options.strict ? { strict: true } : {}),
  });
  const current = toLockfile(result);
  const diff = diffLockfiles(expected, current);
  const policyKinds = options.failOnChanges ??
    config?.policy?.fail_on_changes ?? ["any"];
  const policy = evaluatePolicy(
    diff,
    options.failOn ?? config?.policy?.fail_on ?? "probable",
    policyKinds,
  );
  const writer = options.writer ?? processWriter;
  const machineStdout = options.json === "-";
  if (!options.quiet)
    (machineStdout ? writer.stderr : writer.stdout)(renderDiffConsole(diff));
  const reportPaths: string[] = [];
  const markdownPath = options.markdown ?? config?.reporters?.markdown;
  const sarifPath = options.sarif ?? config?.reporters?.sarif;
  if (markdownPath)
    reportPaths.push(
      await writeArtifact(root, markdownPath, renderDiffMarkdown(diff)),
    );
  if (sarifPath)
    reportPaths.push(
      await writeArtifact(root, sarifPath, renderSarif(result, diff)),
    );
  if (options.json === "-") {
    writer.stdout(
      renderJson({
        schema_version: 1,
        command: "check",
        status: diff.changed ? "changed" : "ok",
        result: { diff, policy },
        diagnostics: result.diagnostics,
      }),
    );
  } else if (options.json) {
    reportPaths.push(
      await writeArtifact(
        root,
        options.json,
        renderJson({
          schema_version: 1,
          command: "check",
          status: diff.changed ? "changed" : "ok",
          result: { diff, policy },
          diagnostics: result.diagnostics,
        }),
      ),
    );
  }
  return {
    result,
    diff,
    passed: policy.passed,
    violations: policy.violations.length,
    reportPaths,
  };
}

export async function writeGraphFromLockfile(
  root: string,
  lockfilePath: string,
  output: string,
  options: {
    title?: string;
    includeUnknowns?: boolean;
    confidence?: Confidence;
  },
): Promise<string> {
  const lockfile = await parseLockfile(
    await readFile(await resolveReadableInsideRoot(root, lockfilePath), "utf8"),
  );
  return writeArtifact(
    root,
    output,
    renderSvg(lockfile, {
      ...(options.title ? { title: options.title } : {}),
      ...(options.includeUnknowns ? { includeUnknowns: true } : {}),
      ...(options.confidence ? { minimumConfidence: options.confidence } : {}),
    }),
  );
}
