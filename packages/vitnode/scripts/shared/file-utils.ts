import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Where a VitNode project starts, for the scripts that have to read something
 * outside the directory they were run in.
 *
 * Both are used by the `i18n:*` commands and by nothing else: one locates the
 * project, the other locates an installed package inside it. Neither has
 * anything to do with routing - a plugin's pages are never copied anywhere, so
 * there is no file-copying machinery here to reach for.
 */

/**
 * The root of the project, found by walking up to a `turbo.json`.
 *
 * A monorepo is the interesting case - a command is run inside `apps/web` and
 * has to reach `plugins/` - so the marker is the file only a repository root
 * has. A standalone project has no `turbo.json` and no directories above it to
 * search, so its own `package.json` is the answer.
 */
export function findRepoRoot(startPath: string): string {
  let currentPath = startPath;
  while (currentPath !== resolve(currentPath, "..")) {
    const turboConfigPath = join(currentPath, "turbo.json");

    if (existsSync(turboConfigPath)) {
      return currentPath;
    }
    currentPath = resolve(currentPath, "..");
  }

  const packagePath = join(startPath, "package.json");
  if (existsSync(packagePath)) {
    return startPath;
  }

  throw new Error("❌ Could not locate project root");
}

/**
 * Locates an installed package, checking the current project before the
 * monorepo root (where pnpm hoists workspace links).
 */
export function findPackagePath(
  packageName: string,
  repoRoot: string,
): null | string {
  const cwd = process.cwd();
  const candidates = [
    join(cwd, "node_modules", packageName),
    ...(repoRoot === cwd ? [] : [join(repoRoot, "node_modules", packageName)]),
  ];

  return candidates.find(candidate => existsSync(candidate)) ?? null;
}
