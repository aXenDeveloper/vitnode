import { readdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";

import type { PackageJSON } from "../../helpers/packages-json.js";

const writeJson = async (path: string, data: unknown) =>
  writeFile(path, JSON.stringify(data, null, 2) + "\n");

interface AddPluginToWorkspaceArgs {
  packageManager: string;
  pluginName: string;
  pluginPath: string;
  rootPath: string;
}

/**
 * Recursively find all package.json files in a directory.
 * `results` accumulates across the recursion; callers pass nothing.
 */
const findPackageJsonFiles = async (
  dir: string,
  results: string[] = [],
): Promise<string[]> => {
  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }

      if (entry.isDirectory()) {
        await findPackageJsonFiles(fullPath, results);
      } else if (entry.name === "package.json") {
        results.push(fullPath);
      }
    }
  } catch {
    // Ignore permission errors or inaccessible directories
  }

  return results;
};

/**
 * Adds the newly created plugin to all workspace packages that depend on @vitnode/core.
 * This function:
 * 1. Finds all package.json files in the workspace (excluding node_modules and dist)
 * 2. Identifies packages that have @vitnode/core as a dependency
 * 3. Adds the new plugin as a dependency with the appropriate workspace reference
 * 4. Skips other packages in the same parent directory as the plugin (e.g., other plugins)
 * 5. Works with any folder structure (apps/, applications/, sandbox/, etc.)
 * 6. Respects the package manager's workspace protocol
 *
 * @param packageManager - The package manager being used (pnpm, npm, yarn, bun)
 * @param pluginName - The name of the plugin to add (e.g., "@my-org/my-plugin")
 * @param pluginPath - The absolute path to the plugin directory
 * @param rootPath - The absolute path to the monorepo root (where turbo.json is located)
 */

export const addPluginToWorkspace = async ({
  packageManager,
  pluginName,
  pluginPath,
  rootPath,
}: AddPluginToWorkspaceArgs) => {
  const packageJsonFiles = await findPackageJsonFiles(rootPath);

  const pluginParentDir = dirname(pluginPath);

  for (const packageJsonPath of packageJsonFiles) {
    if (packageJsonPath === join(pluginPath, "package.json")) {
      continue;
    }

    // Skip other packages in the same parent directory as the plugin
    // (e.g., if plugin is in "plugins/my-plugin", skip "plugins/other-plugin")
    const packageDir = dirname(dirname(packageJsonPath));
    if (packageDir === pluginParentDir) {
      continue;
    }

    try {
      const content = await readFile(packageJsonPath, "utf-8");
      const pkg: PackageJSON = JSON.parse(content);

      const hasVitnodeCore =
        pkg.dependencies?.["@vitnode/core"] ??
        pkg.devDependencies?.["@vitnode/core"];

      if (!hasVitnodeCore) {
        continue;
      }

      let workspaceReference: string;

      switch (packageManager) {
        case "bun":
          workspaceReference = "workspace:*";
          break;
        case "npm":
          workspaceReference = "*";
          break;
        case "pnpm":
          workspaceReference = "workspace:*";
          break;
        case "yarn":
          workspaceReference = "workspace:*";
          break;
        default:
          workspaceReference = "workspace:*";
      }

      pkg.dependencies ??= {};

      pkg.dependencies[pluginName] = workspaceReference;

      pkg.dependencies = Object.keys(pkg.dependencies)
        .sort()
        .reduce<Record<string, string>>((acc, key) => {
          acc[key] = pkg.dependencies?.[key] ?? "";

          return acc;
        }, {});

      await writeJson(packageJsonPath, pkg);
    } catch {
      // Skip files that can't be read or parsed
      continue;
    }
  }
};
