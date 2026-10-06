import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { ConfigError } from "../errors";

export interface PackageJson {
  bin?: Record<string, string> | string;
  dependencies?: Record<string, string>;
  description?: string;
  devDependencies?: Record<string, string>;
  exports?: unknown;
  name?: string;
  packageManager?: string;
  peerDependencies?: Record<string, string>;
  private?: boolean;
  scripts?: Record<string, string>;
  type?: string;
  version?: string;
  workspaces?: string[] | { packages?: string[] };
}

export const readPackageJson = (dir: string): null | PackageJson => {
  const file = join(dir, "package.json");
  if (!existsSync(file)) return null;

  try {
    return JSON.parse(readFileSync(file, "utf8")) as PackageJson;
  } catch {
    return null;
  }
};

/** The closest directory at or above `from` with a `package.json`. */
export const findPackageRoot = (from: string): null | string => {
  let current = resolve(from);

  for (;;) {
    if (existsSync(join(current, "package.json"))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
};

/**
 * Where an installed package lives, as Node would find it from `from`.
 *
 * Walks `node_modules` folders upward instead of `require.resolve`-ing
 * `<name>/package.json`, because a package with an `exports` map may not export
 * its manifest - drizzle-kit does not - and that is no reason to call it
 * missing. Symlinks are followed, so a pnpm workspace link reports the real
 * package directory.
 */
export const findPackageDir = (from: string, name: string): null | string => {
  let current = resolve(from);

  for (;;) {
    const candidate = join(current, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) {
      return realpathSync(candidate);
    }
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
};

/**
 * The absolute path of a package's executable, run later with `node` itself.
 *
 * Executing the script through `process.execPath` rather than the `.bin` shim
 * is what keeps spawning shell-free on every platform: on Windows the shim is a
 * `.cmd` file, which only a shell can run.
 */
export const resolveBin = (
  from: string,
  packageName: string,
  binName: string = packageName.split("/").pop() ?? packageName,
): string => {
  const dir = findPackageDir(from, packageName);
  const manifest = dir === null ? null : readPackageJson(dir);

  if (dir === null || manifest === null) {
    throw new ConfigError(`"${packageName}" is not installed.`, {
      hint: `Add it to the project, e.g. pnpm add -D ${packageName}`,
    });
  }

  const bin =
    typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.[binName];

  if (bin === undefined) {
    throw new ConfigError(
      `"${packageName}" does not provide a "${binName}" executable.`,
    );
  }

  return join(dir, bin);
};

/**
 * Imports a package the way the project itself would, not the way the CLI
 * would.
 *
 * Vite in particular has to be the app's own copy: its config, its plugins and
 * the Vite version they were written against all live there.
 */
export const importFromProject = async <T>(
  root: string,
  specifier: string,
): Promise<T> => {
  let file: string;

  try {
    file = createRequire(join(root, "package.json")).resolve(specifier);
  } catch (error) {
    throw new ConfigError(`Could not find "${specifier}" from ${root}.`, {
      cause: error,
      hint: `Install it in the project, e.g. pnpm add -D ${specifier}`,
    });
  }

  return (await import(pathToFileURL(file).href)) as T;
};
