import { readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

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
 * Recursively find all package.json files in a directory
 * @param dir - The directory to search in
 * @param results - Array to accumulate results (used internally)
 * @returns Array of absolute paths to package.json files
 */
const findPackageJsonFiles = async (
  dir: string,
  results: string[] = [],
): Promise<string[]> => {
  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      // Skip node_modules and dist folders
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
 * 4. Skips packages in the plugins folder (except the new plugin itself)
 * 5. Respects the package manager's workspace protocol
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
  // Find all package.json files in the workspace
  const packageJsonFiles = await findPackageJsonFiles(rootPath);

  for (const packageJsonPath of packageJsonFiles) {
    // Skip if this is the plugin's own package.json
    if (packageJsonPath === join(pluginPath, "package.json")) {
      continue;
    }

    // Skip if this is in the plugins folder (excluding the new plugin itself)
    if (
      packageJsonPath.includes("/plugins/") &&
      !packageJsonPath.startsWith(pluginPath)
    ) {
      continue;
    }

    try {
      const content = await readFile(packageJsonPath, "utf-8");
      const pkg: PackageJSON = JSON.parse(content);

      // Check if this package has @vitnode/core
      const hasVitnodeCore =
        pkg.dependencies?.["@vitnode/core"] ??
        pkg.devDependencies?.["@vitnode/core"];

      if (!hasVitnodeCore) {
        continue;
      }

      // Determine the workspace reference based on package manager
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

      // Add the plugin to dependencies
      pkg.dependencies ??= {};

      pkg.dependencies[pluginName] = workspaceReference;

      // Sort dependencies alphabetically
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
