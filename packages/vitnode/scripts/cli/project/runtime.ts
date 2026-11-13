import type { Env } from "../context";

import { declaredPackageManager } from "./package-manager";
import { readPackageJson } from "./packages";

/**
 * What a standalone API app runs on.
 *
 * A Bun project runs its TypeScript entry directly (`bun --hot`, `bun
 * src/index.ts`); a Node project compiles it with `tsc` and runs `dist`. This is
 * the same split `create-vitnode-app` generates, so the CLI follows the project
 * rather than asking.
 */
export type Runtime = "bun" | "node";

/**
 * The runtime a project declares in its `package.json` -
 * `"vitnode": { "runtime": "bun" }` - which `create-vitnode-app` writes. It
 * wins over every guess below, so a project installed with Bun can still run
 * on Node and the other way round.
 */
const declaredRuntime = (root: string): Runtime | undefined => {
  const runtime = readPackageJson(root)?.vitnode?.runtime;

  return runtime === "bun" || runtime === "node" ? runtime : undefined;
};

/**
 * The project's declared `vitnode.runtime`, else Bun when the CLI itself runs
 * under Bun, when Bun started the script that runs it, or when the project (or
 * its workspace) is a Bun project - a `packageManager: "bun@..."` field or a
 * Bun lockfile, whichever the closest folder declares first.
 */
export const detectRuntime = (
  root: string,
  env: Env,
  versions: NodeJS.ProcessVersions = process.versions,
): Runtime => {
  const declared = declaredRuntime(root);
  if (declared) return declared;
  if (versions.bun !== undefined) return "bun";
  if (env.npm_config_user_agent?.startsWith("bun/")) return "bun";

  return declaredPackageManager(root) === "bun" ? "bun" : "node";
};

/**
 * The executable for a runtime: this very process when it already is that
 * runtime, otherwise `bun` from the PATH - spawned without a shell, which
 * Windows resolves to `bun.exe` on its own.
 */
export const runtimeExecutable = (
  runtime: Runtime,
  versions: NodeJS.ProcessVersions = process.versions,
): string =>
  runtime === "node" || versions.bun !== undefined ? process.execPath : "bun";
