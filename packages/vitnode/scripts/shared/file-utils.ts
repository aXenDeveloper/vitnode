import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Where a VitNode project starts, for the scripts that have to read something
 * outside the directory they were run in.
 *
 * All that is left of what used to be this file. Until the Next.js cutover it
 * also held the plugin **route copier** - the machinery that read a plugin's
 * `src/routes/{main,admin,blank,breadcrumb}/` and wrote copies of those pages
 * into every Next.js app's `src/app/[locale]/…`, rewriting each import as it
 * went. A plugin's pages are no longer copied anywhere: its route tree is
 * compiled into a literal registry and the app imports the page out of the
 * plugin's own `dist`, so there is nothing to copy, nothing to clean up when a
 * source file is deleted, and no import to rewrite.
 *
 * What the copier needed and this does not: `findLocaleRoot` (it looked for an
 * `src/app/[locale]` directory, which only a Next.js App Router app has),
 * `transformFileImports`, `copyFile`, `copyDirectoryRecursive`,
 * `cleanupDeletedFiles`, `buildInitialRouteMap`, `routeKey`, `getAllFiles`,
 * `isDirectoryEmpty` and `SourceConfig`.
 *
 * The two below survive because the `i18n:*` commands use them, and neither has
 * anything to do with routing: one locates the project, the other locates an
 * installed package inside it.
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
