import { createJiti } from "jiti";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

import type {
  AppMessagesMap,
  VitNodeI18nConfig,
} from "../src/lib/i18n/types.js";
import type { VitNodeApiConfig } from "../src/vitnode.config.js";

import { ConfigError } from "./cli/errors.js";

type ConfigName = "api.config" | "config" | "server.config";

/**
 * What the CLI reads from an app's frontend `vitnode.config.ts`. The full type
 * (`VitNodeConfig`) belongs to `@vitnode/core`, which an API-only project does
 * not install; any value `buildConfig` returns satisfies this view.
 */
export interface FrontendConfigView {
  i18n?: Partial<VitNodeI18nConfig>;
  plugins?: readonly { pluginId: string }[];
}

/** What the CLI reads from an app's `vitnode.server.config.ts`. */
export interface ServerConfigView {
  messages?: AppMessagesMap;
}

type ConfigType<T extends ConfigName> = T extends "config"
  ? FrontendConfigView
  : T extends "server.config"
    ? ServerConfigView
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
    throw new ConfigError(`Config file not found: src/${filename}`, {
      details: [
        `Searched recursively in ${cwd} (excluding node_modules, .*, dist, build, out).`,
      ],
    });
  }

  try {
    const configVarName = CONFIG_EXPORTS[type];

    const jiti = createJiti(import.meta.url, {
      alias: { "@/": `${dirname(configPath)}/` },
      interopDefault: true,
    });

    // oxlint-disable-next-line typescript/no-explicit-any
    const loaded = (await jiti.import(configPath)) as any;
    const config = loaded[configVarName];

    if (!config) {
      if (optional) return null;
      throw new ConfigError(
        `Export "${configVarName}" not found in ${configPath}`,
      );
    }

    return config as ConfigType<T>;
  } catch (error) {
    if (optional) return null;
    if (error instanceof ConfigError) throw error;
    throw new ConfigError(`Failed to load ${configPath}`, {
      cause: error,
      details: [error instanceof Error ? error.message : String(error)],
    });
  }
}
