/* eslint-disable no-console */
import { createJiti } from "jiti";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import type { VitNodeApiConfig, VitNodeConfig } from "../src/vitnode.config.js";

type ConfigType<T extends "api.config" | "config"> = T extends "config"
  ? VitNodeConfig
  : VitNodeApiConfig;

const findConfigFile = (
  baseDir: string,
  filename: string,
  maxDepth = 4,
): null | string => {
  // Search recursively in project
  const searchRecursively = (dir: string, depth: number): null | string => {
    if (depth > maxDepth) return null;

    try {
      // Check if config exists in src folder of current directory
      const configPath = join(dir, "src", filename);
      if (existsSync(configPath)) {
        return configPath;
      }

      // Search in subdirectories
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

export async function getConfig<
  T extends "api.config" | "config" = "config",
>(args: { optional: true; type?: T }): Promise<ConfigType<T> | null>;
export async function getConfig<
  T extends "api.config" | "config" = "config",
>(args?: { optional?: false; type?: T }): Promise<ConfigType<T>>;
export async function getConfig<T extends "api.config" | "config" = "config">({
  type = "config" as T,
  optional = false,
}: {
  optional?: boolean;
  type?: T;
} = {}): Promise<ConfigType<T> | null> {
  const cwd = process.cwd();
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
    const configVarName =
      type === "config" ? "vitNodeConfig" : "vitNodeApiConfig";

    // Use jiti to load TypeScript files
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
