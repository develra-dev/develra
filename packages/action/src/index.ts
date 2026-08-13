import { realpath } from "node:fs/promises";
import nodePath from "node:path";

import * as core from "@actions/core";
import { DevelraError, isInsideRoot, resolveInsideRoot } from "@develra/core";
import { renderDiffMarkdown, renderMarkdown } from "@develra/reporters";
import {
  performCheck,
  performScan,
  type OutputWriter,
} from "../../../apps/cli/src/index.js";

type ActionCommand = "scan" | "check";
type FailOn = "none" | "possible" | "probable" | "confirmed";

function choice<T extends string>(
  name: string,
  value: string,
  choices: readonly T[],
): T {
  if (!(choices as readonly string[]).includes(value)) {
    throw new DevelraError(
      `${name} must be one of: ${choices.join(", ")}.`,
      2,
      "DVL_ACTION_INPUT",
    );
  }
  return value as T;
}

function optional(name: string): string | undefined {
  const value = core.getInput(name).trim();
  return value || undefined;
}

function relative(workspace: string, absolute: string | undefined): string {
  if (!absolute) return "";
  return nodePath.relative(workspace, absolute).replaceAll("\\", "/");
}

export async function run(): Promise<void> {
  let summary =
    "## Develra external-contract check\n\nNo trustworthy result was produced.";
  try {
    const workspace = await realpath(
      nodePath.resolve(process.env.GITHUB_WORKSPACE ?? process.cwd()),
    );
    const command = choice<ActionCommand>(
      "command",
      core.getInput("command") || "check",
      ["scan", "check"],
    );
    const failOn = choice<FailOn>(
      "fail-on",
      core.getInput("fail-on") || "probable",
      ["none", "possible", "probable", "confirmed"],
    );
    const requestedRoot = resolveInsideRoot(
      workspace,
      core.getInput("root") || ".",
    );
    const root = await realpath(requestedRoot);
    if (!isInsideRoot(workspace, root)) {
      throw new DevelraError(
        "The scan root resolves outside GITHUB_WORKSPACE.",
        5,
        "DVL_PATH_SYMLINK_ESCAPE",
      );
    }
    const lockfile = core.getInput("lockfile") || "develra.lock";
    const markdown = optional("markdown");
    const sarif = optional("sarif");
    const config = optional("config");
    const messages: string[] = [];
    const writer: OutputWriter = {
      stdout: (text) => messages.push(text),
      stderr: (text) => messages.push(text),
    };

    if (command === "scan") {
      const scan = await performScan({
        root,
        lockfile,
        ...(markdown ? { report: markdown } : {}),
        ...(sarif ? { sarif } : {}),
        ...(config ? { config } : {}),
        writer,
      });
      const findings =
        scan.result.providers.length +
        scan.result.mcp_servers.length +
        scan.result.unknowns.length;
      summary = renderMarkdown(scan.result, "Develra external-contract scan");
      core.setOutput("status", "ok");
      core.setOutput("findings", String(findings));
      core.setOutput(
        "report-path",
        relative(
          workspace,
          scan.reportPaths.find((path) => path.endsWith(".md")),
        ),
      );
      core.setOutput(
        "sarif-path",
        relative(
          workspace,
          scan.reportPaths.find((path) => path.endsWith(".sarif")),
        ),
      );
    } else {
      const check = await performCheck({
        root,
        lockfile,
        failOn,
        ...(markdown ? { markdown } : {}),
        ...(sarif ? { sarif } : {}),
        ...(config ? { config } : {}),
        writer,
      });
      summary = renderDiffMarkdown(check.diff);
      core.setOutput("status", check.passed ? "ok" : "changed");
      core.setOutput("findings", String(check.diff.changes.length));
      core.setOutput(
        "report-path",
        relative(
          workspace,
          check.reportPaths.find((path) => path.endsWith(".md")),
        ),
      );
      core.setOutput(
        "sarif-path",
        relative(
          workspace,
          check.reportPaths.find((path) => path.endsWith(".sarif")),
        ),
      );
      if (!check.passed)
        core.setFailed(
          "External contract inventory changed. Run `npx develra scan` and review develra.lock.",
        );
    }
    for (const message of messages) core.info(message.trimEnd());
  } catch (error) {
    core.setOutput("status", "error");
    core.setOutput("findings", "0");
    core.setFailed(error instanceof Error ? error.message : String(error));
  } finally {
    try {
      await core.summary.addRaw(summary).write();
    } catch (error) {
      core.warning(
        `Could not write job summary: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

void run();
