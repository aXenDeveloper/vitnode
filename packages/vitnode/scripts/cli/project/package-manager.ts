import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import type { Env } from "../context";

import { readPackageJson } from "./packages";

export type PackageManager = "bun" | "npm" | "pnpm" | "yarn";

const PACKAGE_MANAGERS: readonly PackageManager[] = [
  "bun",
  "npm",
  "pnpm",
  "yarn",
];

const LOCKFILES: readonly (readonly [string, PackageManager])[] = [
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
];

const packageManagerNamed = (name: string): PackageManager | undefined =>
  PACKAGE_MANAGERS.find(manager => manager === name);

export const declaredPackageManager = (
  root: string,
): PackageManager | undefined => {
  let current = resolve(root);

  for (;;) {
    const declared = readPackageJson(current)?.packageManager;
    if (declared !== undefined) {
      return packageManagerNamed(declared.split("@")[0]);
    }

    const lockfile = LOCKFILES.find(([file]) =>
      existsSync(join(current, file)),
    );
    if (lockfile !== undefined) return lockfile[1];

    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
};

export const detectPackageManager = (
  root: string,
  env: Env,
): PackageManager | undefined => {
  const runningManager = env.npm_config_user_agent?.split("/")[0];

  return runningManager === undefined
    ? declaredPackageManager(root)
    : packageManagerNamed(runningManager);
};
