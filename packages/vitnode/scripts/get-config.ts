/* eslint-disable no-console */
import { createJiti } from "jiti";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import type {
  VitNodeApiConfig,
  VitNodeConfig,
  VitNodeServerConfig,
} from "../src/vitnode.config.js";

type ConfigName = "api.config" | "config" | "server.config";

type ConfigType<T extends ConfigName> = T extends "config"
  ? VitNodeConfig
  : T extends "server.config"
    ? VitNodeServerConfig
    : VitNodeApiConfig;

/**
 * The export each config file is read through - `vitnode.<type>.config.ts` is
 * only half the convention, the named export is the other half.
 */
const CONFIG_EXPORTS: Record<ConfigName, string> = {
  "api.config": "vitNodeApiConfig",
  config: "vitNodeConfig",
  "server.config": "vitNodeServerConfig",
};

export const findConfigFile = (
  baseDir: string,
  filename: string,
  maxDepth = 4,
): null | string => {
  const searchRecursively = (dir: string, depth: number): null | string => {
    if (depth > maxDepth) return null;

    try {
      const configPath = join(dir, "src", filename);
      if (existsSync(configPath)) {
        return configPath;
      }

      const items = readdirSync(dir);
      for (const item of items) {
        // Skip node_modules, hidden directories, and build output folders
        if (
          item === "node_modules" ||
          item.startsWith(".") ||
          item === "dist" ||
          item === "build" ||
          item === "out"
        ) {
          continue;
        }

        const itemPath = join(dir, item);
        try {
          if (statSync(itemPath).isDirectory()) {
            const found = searchRecursively(itemPath, depth + 1);
            if (found) return found;
          }
        } catch {
          // Ignore permission errors
        }
      }
    } catch {
      // Ignore errors
    }

    return null;
  };

  return searchRecursively(baseDir, 0);
};

export async function getConfig<T extends ConfigName = "config">(args: {
  baseDir?: string;
  optional: true;
  type?: T;
}): Promise<ConfigType<T> | null>;
export async function getConfig<T extends ConfigName = "config">(args?: {
  baseDir?: string;
  optional?: false;
  type?: T;
}): Promise<ConfigType<T>>;
export async function getConfig<T extends ConfigName = "config">({
  baseDir,
  type = "config" as T,
  optional = false,
}: {
  baseDir?: string;
  optional?: boolean;
  type?: T;
} = {}): Promise<ConfigType<T> | null> {
  // Defaults to the current app; callers pass `baseDir` to search elsewhere,
  // e.g. one directory up to reach a sibling app's config in a monorepo.
  const cwd = baseDir ?? process.cwd();
  const filename = `vitnode.${type}.ts`;
  const configPath = findConfigFile(cwd, filename);

  if (!configPath) {
    if (optional) return null;
    console.error(`Config file not found: ${filename}`);
    console.error(
      `Searched recursively in ${cwd} (excluding node_modules, .*, dist, build, out)`,
    );
    process.exit(1);
  }

  try {
    const configVarName = CONFIG_EXPORTS[type];

    const jiti = createJiti(import.meta.url, {
      interopDefault: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const loaded = (await jiti.import(configPath)) as any;
    const config = loaded[configVarName];

    if (!config) {
      if (optional) return null;
      console.error(`Export "${configVarName}" not found in ${configPath}`);
      process.exit(1);
    }

    return config as ConfigType<T>;
  } catch (error) {
    if (optional) return null;
    console.error("Failed to load config:", error);
    process.exit(1);
  }
}
