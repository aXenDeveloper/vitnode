import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import type { Env } from "../context";

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

const OTHER_LOCKFILES = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"];
const BUN_LOCKFILES = ["bun.lock", "bun.lockb"];

/**
 * Bun when the CLI itself runs under Bun, when Bun started the script that
 * runs it, or when the project (or its workspace) is a Bun project - a
 * `packageManager: "bun@..."` field or a Bun lockfile, whichever the closest
 * folder declares first.
 */
export const detectRuntime = (
  root: string,
  env: Env,
  versions: NodeJS.ProcessVersions = process.versions,
): Runtime => {
  if (versions.bun !== undefined) return "bun";
  if (env.npm_config_user_agent?.startsWith("bun/")) return "bun";

  let current = resolve(root);
  for (;;) {
    const manager = readPackageJson(current)?.packageManager;
    if (manager !== undefined)
      return manager.startsWith("bun@") ? "bun" : "node";
    if (BUN_LOCKFILES.some(file => existsSync(join(current, file)))) {
      return "bun";
    }
    if (OTHER_LOCKFILES.some(file => existsSync(join(current, file)))) {
      return "node";
    }

    const parent = dirname(current);
    if (parent === current) return "node";
    current = parent;
  }
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
