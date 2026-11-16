import type { Config } from "drizzle-kit";

import { defineConfig } from "drizzle-kit";
import { existsSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { VitNodeApiConfig } from "./vitnode.config";

/**
 * A Drizzle Kit config for a VitNode API: the app's own `schema` plus the
 * built-in tables from `@vitnode/api` and every configured plugin's compiled
 * `dist/src/database` schema. Server-only.
 */
export const defineVitNodeDrizzleConfig = ({
  vitNodeApiConfig,
  ...args
}: Config & {
  vitNodeApiConfig: VitNodeApiConfig;
}) => {
  const pluginId = vitNodeApiConfig.plugins.map(plugin => plugin.pluginId);

  const findMonorepoRoot = (startPath: string): null | string => {
    let currentPath = startPath;
    while (currentPath !== resolve(currentPath, "..")) {
      const turboConfigPath = join(currentPath, "turbo.json");

      if (existsSync(turboConfigPath)) {
        return currentPath;
      }
      currentPath = resolve(currentPath, "..");
    }

    return null;
  };

  const checkPluginPath = (basePath: string, itemId: string): null | string => {
    const pluginPath = resolve(
      basePath,
      "node_modules",
      itemId,
      "dist",
      "src",
      "database",
    );

    // Check if the plugin path exists
    if (!existsSync(pluginPath)) {
      return null;
    }

    // Check if there are any .js files in the directory
    try {
      const files = readdirSync(pluginPath);
      const hasSchemaFiles = files.some(file => file.endsWith(".js"));
      if (!hasSchemaFiles) return null;

      // Resolve symlinks before returning: in a workspace the app's own
      // `node_modules/<plugin>` and the root's are two links onto one
      // directory, and the caller dedupes on this path.
      return realpathSync(pluginPath);
    } catch {
      return null;
    }
  };

  const cwd = process.cwd();
  const monorepoRoot = findMonorepoRoot(cwd);

  // Deduplicated by real path. Both candidates below usually resolve to the
  // same workspace directory, and handing Drizzle Kit the same schema twice
  // makes it report every table, column, index and constraint as a duplicate -
  // dozens of warnings that bury the ones worth reading.
  const pluginDirs = new Set<string>();

  // The built-in schema ships beside this module, wherever the package manager
  // put it. Drizzle Kit imports the config natively, so `import.meta.url` is
  // the installed package, not a bundle.
  const ownDatabase = join(dirname(fileURLToPath(import.meta.url)), "database");
  if (
    existsSync(ownDatabase) &&
    readdirSync(ownDatabase).some(file => file.endsWith(".js"))
  ) {
    pluginDirs.add(realpathSync(ownDatabase));
  }

  for (const itemId of pluginId) {
    // Check in current working directory
    const cwdPath = checkPluginPath(cwd, itemId);
    if (cwdPath) pluginDirs.add(cwdPath);

    // Check in monorepo root if it exists and is different from cwd
    if (monorepoRoot && monorepoRoot !== cwd) {
      const rootPath = checkPluginPath(monorepoRoot, itemId);
      if (rootPath) pluginDirs.add(rootPath);
    }
  }

  const pluginPaths = [...pluginDirs].map(dir =>
    join(dir, "*.js").replace(/\\/g, "/"),
  );

  // Normalize args.schema into an array without nested ternary expressions
  let baseSchemas: string[] = [];
  if (Array.isArray(args.schema)) {
    baseSchemas = args.schema;
  } else if (args.schema) {
    baseSchemas = [args.schema];
  }

  return defineConfig({
    ...args,
    schema: [...baseSchemas, ...pluginPaths],
  });
};
