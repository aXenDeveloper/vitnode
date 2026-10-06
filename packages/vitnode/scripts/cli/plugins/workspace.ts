import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { readPackageJson } from "../project/packages";

/** The closest directory at or above `from` that declares a workspace. */
export const findWorkspaceRoot = (from: string): null | string => {
  let current = resolve(from);

  for (;;) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) return current;
    if (readPackageJson(current)?.workspaces !== undefined) return current;

    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
};

/**
 * The `packages:` globs of a `pnpm-workspace.yaml`, read line by line.
 *
 * Only the list itself is needed, and it is always a flat sequence of strings -
 * not worth a YAML parser in the CLI's dependencies.
 */
export const parsePnpmWorkspaceGlobs = (source: string): string[] => {
  const globs: string[] = [];
  let inPackages = false;

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trimEnd();
    if (line.trim() === "") continue;

    if (/^\S/.test(line)) {
      inPackages = /^packages\s*:/.test(line);
      continue;
    }

    const item = /^\s*-\s*["']?([^"']+)["']?\s*$/.exec(line);
    if (inPackages && item) globs.push(item[1]);
  }

  return globs;
};

export const workspaceGlobs = (workspaceRoot: string): string[] => {
  const pnpm = join(workspaceRoot, "pnpm-workspace.yaml");
  if (existsSync(pnpm)) {
    return parsePnpmWorkspaceGlobs(readFileSync(pnpm, "utf8"));
  }

  const { workspaces } = readPackageJson(workspaceRoot) ?? {};

  return Array.isArray(workspaces) ? workspaces : (workspaces?.packages ?? []);
};

/**
 * Every package directory a workspace declares.
 *
 * Supports the two shapes VitNode workspaces use - `dir/*` and an exact `dir` -
 * and skips negations. A deeper glob (`dir/**`) is treated as `dir/*`.
 */
export const workspacePackageDirs = (workspaceRoot: string): string[] =>
  workspaceGlobs(workspaceRoot)
    .filter(glob => !glob.startsWith("!"))
    .flatMap(glob => {
      const wildcard = glob.indexOf("*");
      if (wildcard === -1) return [join(workspaceRoot, glob)];

      const base = join(workspaceRoot, glob.slice(0, wildcard));
      if (!existsSync(base)) return [];

      return readdirSync(base)
        .filter(entry => !entry.startsWith("."))
        .map(entry => join(base, entry))
        .filter(dir => statSync(dir).isDirectory());
    })
    .filter(dir => existsSync(join(dir, "package.json")))
    .sort();
