import { access, readdir, readFile, writeFile } from "fs/promises";
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

export const dependsOn = (pkg: PackageJSON, name: string): boolean =>
  Boolean(pkg.dependencies?.[name] ?? pkg.devDependencies?.[name]);

/**
 * Whether a workspace package is an app that installs plugins: one on
 * `@vitnode/core` (a web or single app), or one on `@vitnode/api` that serves
 * the API itself (`src/vitnode.api.config.ts`). A package that only builds on
 * `@vitnode/api` - an adapter - is not a host.
 */
const isVitNodeHost = async (
  dir: string,
  pkg: PackageJSON,
): Promise<boolean> => {
  if (dependsOn(pkg, "@vitnode/core")) return true;
  if (!dependsOn(pkg, "@vitnode/api")) return false;

  try {
    await access(join(dir, "src", "vitnode.api.config.ts"));

    return true;
  } catch {
    return false;
  }
};

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

      if (!(await isVitNodeHost(dirname(packageJsonPath), pkg))) {
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
