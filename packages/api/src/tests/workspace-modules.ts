import { existsSync, mkdirSync, readdirSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";

/** `packages/api`. */
export const API_ROOT = resolve(import.meta.dirname, "..", "..");

/** `packages/vitnode` - `@vitnode/core`. */
export const CORE_ROOT = resolve(API_ROOT, "..", "vitnode");

/** `packages/create-vitnode-app`. */
export const CREATOR_ROOT = resolve(API_ROOT, "..", "create-vitnode-app");

const linkEntries = (from: string, into: string) => {
  for (const entry of readdirSync(from)) {
    if (entry === ".bin" || entry === "@vitnode") continue;
    const target = join(into, entry);
    if (entry.startsWith("@")) {
      mkdirSync(target, { recursive: true });
      linkEntries(join(from, entry), target);
      continue;
    }
    if (!existsSync(target)) symlinkSync(join(from, entry), target, "junction");
  }
};

/**
 * A plugin's `node_modules` as a workspace install leaves it: the dependencies
 * of `@vitnode/core` and `@vitnode/api`, plus links to both packages and
 * `@vitnode/config`. Both packages resolve to their build output, so they have
 * to be built first (`pnpm build:plugins`).
 */
export const linkWorkspaceModules = (modules: string): void => {
  mkdirSync(join(modules, "@vitnode"), { recursive: true });
  linkEntries(join(CORE_ROOT, "node_modules"), modules);
  linkEntries(join(API_ROOT, "node_modules"), modules);
  symlinkSync(CORE_ROOT, join(modules, "@vitnode", "core"), "junction");
  symlinkSync(API_ROOT, join(modules, "@vitnode", "api"), "junction");
  symlinkSync(
    resolve(API_ROOT, "..", "config"),
    join(modules, "@vitnode", "config"),
    "junction",
  );
};

/** Why a test that needs the build output cannot run, or `null`. */
export const missingBuildOutput = (): null | string => {
  if (!existsSync(join(API_ROOT, "dist", "src", "lib", "plugin.d.ts"))) {
    return "@vitnode/api is not built: run `pnpm build:plugins` in packages/api first.";
  }
  if (!existsSync(join(CORE_ROOT, "dist", "src", "routing", "index.d.ts"))) {
    return "@vitnode/core is not built: run `pnpm build:plugins` in packages/vitnode first.";
  }

  return null;
};
