import { existsSync, realpathSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

import type { PackageJson } from "../project/packages";

import { CORE_PLUGIN_ID } from "../../../src/framework/plugin-routes/core";
import { findConfigFile } from "../../get-config";
import { ConfigError, errorMessage } from "../errors";
import {
  findPackageDir,
  findPackageRoot,
  readPackageJson,
} from "../project/packages";
import { findWorkspaceRoot, workspacePackageDirs } from "./workspace";

/**
 * Where a plugin comes from:
 *
 * - `workspace` - a package in this repository, linked into the app.
 * - `package` - installed from a registry into `node_modules`.
 */
export type PluginSource = "package" | "workspace";

export interface DiscoveredPlugin {
  /** Listed in the app's `vitnode.config.ts`. */
  configured: boolean;
  description: null | string;
  /** The plugin id, which VitNode requires to equal the package name. */
  id: string;
  /** The package directory, or `null` when it is configured but not installed. */
  root: null | string;
  source: PluginSource;
  version: null | string;
}

export interface PluginDiscovery {
  /** The app whose `vitnode.config.ts` was read, if one was found. */
  appRoot: null | string;
  plugins: DiscoveredPlugin[];
  workspaceRoot: null | string;
}

const PLUGIN_SOURCES = [
  "src/config.tsx",
  "src/config.ts",
  "dist/src/config.js",
];

const dependsOnCore = (manifest: PackageJson) =>
  [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
  ].some(deps => deps !== undefined && CORE_PLUGIN_ID in deps);

/**
 * Whether a package is a VitNode plugin: it depends on core and has the plugin
 * definition module (`src/config.tsx`, or its build output). Adapters such as
 * `@vitnode/s3` depend on core too, but define no plugin.
 */
export const isPluginPackage = (dir: string): boolean => {
  const manifest = readPackageJson(dir);
  if (manifest === null || manifest.name === CORE_PLUGIN_ID) return false;

  return (
    dependsOnCore(manifest) &&
    PLUGIN_SOURCES.some(file => existsSync(join(dir, file)))
  );
};

/**
 * The app whose plugins a command should talk about: the one at or below
 * `cwd`, otherwise the first one in the workspace `cwd` belongs to - which is
 * what lets `vitnode plugin list` work from a plugin's own folder.
 */
export const findAppRoot = (
  cwd: string,
  workspaceRoot: null | string,
): null | string => {
  const packageRoot = findPackageRoot(cwd) ?? cwd;
  const config =
    findConfigFile(packageRoot, "vitnode.config.ts") ??
    (workspaceRoot === null
      ? null
      : findConfigFile(workspaceRoot, "vitnode.config.ts"));

  return config === null ? null : dirname(dirname(config));
};

const sourceOf = (dir: string, workspaceRoot: null | string): PluginSource => {
  const inNodeModules = dir.split(sep).includes("node_modules");

  return workspaceRoot !== null &&
    !inNodeModules &&
    !relative(realpathSync(workspaceRoot), realpathSync(dir)).startsWith("..")
    ? "workspace"
    : "package";
};

const describe = (
  id: string,
  dir: null | string,
  configured: boolean,
  workspaceRoot: null | string,
): DiscoveredPlugin => {
  const manifest = dir === null ? null : readPackageJson(dir);

  return {
    configured,
    description: manifest?.description ?? null,
    id,
    root: dir,
    source: dir === null ? "package" : sourceOf(dir, workspaceRoot),
    version: manifest?.version ?? null,
  };
};

export type LoadConfiguredPluginIds = (appRoot: string) => Promise<string[]>;

/**
 * The app's configured plugins, read by the same loader its Vite build uses.
 *
 * Imported lazily: it brings jiti and the route compiler with it, which
 * nothing but plugin discovery needs.
 */
export const loadConfiguredPluginIds: LoadConfiguredPluginIds =
  async appRoot => {
    const { configuredPluginIds } =
      await import("../../../src/framework/vite/plugin-routes");

    return configuredPluginIds(appRoot);
  };

/**
 * Every plugin a developer would expect to see: the ones the app configures,
 * then workspace plugins it does not (yet) configure.
 *
 * Nothing is kept in a registry of the CLI's own. Configured plugins come from
 * the app's `vitnode.config.ts` - evaluated, not pattern-matched, because a
 * plugin list can be built any way TypeScript allows - and workspace plugins
 * from the workspace's own package globs.
 */
export const discoverPlugins = async (
  cwd: string,
  {
    loadIds = loadConfiguredPluginIds,
  }: { loadIds?: LoadConfiguredPluginIds } = {},
): Promise<PluginDiscovery> => {
  const workspaceRoot = findWorkspaceRoot(cwd);
  const appRoot = findAppRoot(cwd, workspaceRoot);
  const plugins: DiscoveredPlugin[] = [];

  if (appRoot !== null) {
    let ids: string[];
    try {
      ids = await loadIds(appRoot);
    } catch (error) {
      throw new ConfigError(
        `Could not load the plugins configured in ${relative(cwd, join(appRoot, "src", "vitnode.config.ts")) || "vitnode.config.ts"}.`,
        {
          cause: error,
          details: [errorMessage(error).split("\n")[0] ?? ""],
          hint: "Plugins are loaded from their build output - build them first (pnpm build:plugins), then run this again.",
        },
      );
    }

    for (const id of ids) {
      plugins.push(
        describe(id, findPackageDir(appRoot, id), true, workspaceRoot),
      );
    }
  }

  if (workspaceRoot !== null) {
    const known = new Set(plugins.map(plugin => plugin.id));

    for (const dir of workspacePackageDirs(workspaceRoot)) {
      if (!isPluginPackage(dir)) continue;
      const id = readPackageJson(dir)?.name;
      if (id === undefined || known.has(id)) continue;
      plugins.push(describe(id, dir, false, workspaceRoot));
    }
  }

  return { appRoot, plugins, workspaceRoot };
};
