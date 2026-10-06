import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

export const APPLICATION_CODE = "application code";
export const VIRTUAL_MODULES = "virtual modules";

/**
 * `@scope/name` or `name` from the last `node_modules/` segment of a path -
 * the last one, because pnpm nests the real package inside
 * `node_modules/.pnpm/<id>/node_modules/<name>`.
 */
export const packageNameFromPath = (path: string): null | string => {
  const normalized = path.replaceAll("\\", "/");
  const marker = "/node_modules/";
  const index = normalized.lastIndexOf(marker);
  if (index === -1) return null;

  const [first, second] = normalized.slice(index + marker.length).split("/");
  if (first === undefined || first === "") return null;

  return first.startsWith("@") && second !== undefined
    ? `${first}/${second}`
    : first;
};

export interface PackageOwner {
  /** The project root itself is reported as {@link APPLICATION_CODE}. */
  (moduleId: string): string;
  /** The package directory a module belongs to, or `null`. */
  rootOf: (moduleId: string) => null | string;
}

/**
 * Which package a bundled module came from.
 *
 * `node_modules` paths answer directly. Everything else - the app's own files,
 * and workspace packages a pnpm link resolved outside `node_modules` - is
 * answered by the nearest `package.json`, cached per directory so a chunk of a
 * thousand modules costs a handful of file reads.
 */
export const createPackageOwner = (projectRoot: string): PackageOwner => {
  const root = resolve(projectRoot);
  const cache = new Map<string, null | { dir: string; name: string }>();

  const nearestPackage = (start: string) => {
    const visited: string[] = [];
    let current = start;
    let found: null | { dir: string; name: string } = null;

    for (;;) {
      const cached = cache.get(current);
      if (cached !== undefined) {
        found = cached;
        break;
      }
      visited.push(current);

      const manifest = join(current, "package.json");
      if (existsSync(manifest)) {
        try {
          const { name } = JSON.parse(readFileSync(manifest, "utf8")) as {
            name?: string;
          };
          found = { dir: current, name: name ?? current };
        } catch {
          found = { dir: current, name: current };
        }
        break;
      }

      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }

    visited.forEach(dir => cache.set(dir, found));

    return found;
  };

  const lookup = (moduleId: string) => {
    const path = moduleId.split("?")[0] ?? moduleId;
    if (path.startsWith("\0") || !isAbsolute(path)) return null;

    return nearestPackage(dirname(path));
  };

  const owner = ((moduleId: string): string => {
    const path = moduleId.split("?")[0] ?? moduleId;
    if (path.startsWith("\0") || !isAbsolute(path)) return VIRTUAL_MODULES;

    const fromNodeModules = packageNameFromPath(path);
    if (fromNodeModules !== null) return fromNodeModules;

    const found = lookup(moduleId);
    if (found === null || found.dir === root) return APPLICATION_CODE;

    return found.name;
  }) as PackageOwner;

  owner.rootOf = moduleId => lookup(moduleId)?.dir ?? null;

  return owner;
};
