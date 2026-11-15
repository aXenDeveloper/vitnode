import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

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
