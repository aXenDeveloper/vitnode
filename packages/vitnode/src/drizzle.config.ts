import type { Config } from "drizzle-kit";

import { defineConfig } from "drizzle-kit";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import type { VitNodeApiConfig } from "./vitnode.config";

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

      // Return glob pattern for schema files
      return join(pluginPath, "*.js").replace(/\\/g, "/");
    } catch {
      return null;
    }
  };

  const cwd = process.cwd();
  const monorepoRoot = findMonorepoRoot(cwd);

  const pluginPaths = ["@vitnode/core", ...pluginId]
    .flatMap(itemId => {
      const paths: string[] = [];

      // Check in current working directory
      const cwdPath = checkPluginPath(cwd, itemId);
      if (cwdPath) paths.push(cwdPath);

      // Check in monorepo root if it exists and is different from cwd
      if (monorepoRoot && monorepoRoot !== cwd) {
        const rootPath = checkPluginPath(monorepoRoot, itemId);
        if (rootPath) paths.push(rootPath);
      }

      return paths;
    })
    .filter((pluginPath): pluginPath is string => pluginPath !== null);

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
