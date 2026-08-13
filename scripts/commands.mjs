import { execFileSync } from "node:child_process";

export function runNpm(args, options) {
  return execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", args, {
    ...options,
    shell: process.platform === "win32",
  });
}

export function runPnpm(args, options) {
  const entry = process.env.npm_execpath;
  if (entry) return execFileSync(process.execPath, [entry, ...args], options);
  return execFileSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    args,
    {
      ...options,
      shell: process.platform === "win32",
    },
  );
}
