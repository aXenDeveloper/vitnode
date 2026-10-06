import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import type { PackageJson } from "../project/packages";
import type { TemplateFile } from "./template";

import { ConfigError, UserError } from "../errors";
import { readPackageJson } from "../project/packages";
import { toDisplayPath } from "../ui/format";
import { isPluginPackage } from "./discover";
import { validatePackageName, validatePluginName } from "./naming";
import {
  findWorkspaceRoot,
  workspaceGlobs,
  workspacePackageDirs,
} from "./workspace";

export interface PluginWorkspace {
  /** Package name → directory, for every package the workspace declares. */
  packages: Map<string, string>;
  /** Where new plugins go. */
  pluginsDir: string;
  /** Whether the workspace globs cover `pluginsDir`, i.e. pnpm will link it. */
  pluginsDirIsLinked: boolean;
  root: string;
}

/**
 * The workspace a new plugin is created in, and where in it.
 *
 * Plugins live in `plugins/` - the folder VitNode's own repository and every
 * generated monorepo use. A workspace that keeps its plugins elsewhere is
 * followed instead: the folder its existing plugins are in wins.
 */
export const resolvePluginWorkspace = (cwd: string): PluginWorkspace => {
  const root = findWorkspaceRoot(cwd);

  if (root === null) {
    throw new ConfigError(
      "Plugins are created inside a workspace, and none was found.",
      {
        hint: "Run this from a VitNode monorepo (one with pnpm-workspace.yaml or package.json workspaces).",
      },
    );
  }

  const packages = new Map<string, string>();
  const dirs = workspacePackageDirs(root);
  for (const dir of dirs) {
    const name = readPackageJson(dir)?.name;
    if (name !== undefined) packages.set(name, dir);
  }

  const existingPluginDir = dirs.find(dir => isPluginPackage(dir));
  const pluginsDir =
    existingPluginDir === undefined
      ? join(root, "plugins")
      : dirname(existingPluginDir);
  const relativeDir = toDisplayPath(relative(root, pluginsDir));

  return {
    packages,
    pluginsDir,
    pluginsDirIsLinked: workspaceGlobs(root).some(
      glob => glob === `${relativeDir}/*` || glob === `${relativeDir}/**`,
    ),
    root,
  };
};

export interface PluginPlan {
  description: string;
  name: string;
  packageName: string;
  targetDir: string;
  workspace: PluginWorkspace;
}

/**
 * Checks everything that could make creating the plugin fail or clobber
 * something - before a single file is written.
 */
export const planPlugin = ({
  description,
  name,
  packageName,
  workspace,
}: {
  description: string;
  name: string;
  packageName: string;
  workspace: PluginWorkspace;
}): PluginPlan => {
  const nameProblem = validatePluginName(name);
  if (nameProblem !== null) throw new UserError(nameProblem);

  const packageProblem = validatePackageName(packageName);
  if (packageProblem !== null) throw new UserError(packageProblem);

  const existing = workspace.packages.get(packageName);
  if (existing !== undefined) {
    throw new UserError(
      `A package named "${packageName}" already exists at ${toDisplayPath(relative(workspace.root, existing))}.`,
      {
        hint: "The package name is the plugin id, so it has to be unique - pick another name or --package-name.",
      },
    );
  }

  const targetDir = join(workspace.pluginsDir, name);
  if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
    throw new UserError(
      `${toDisplayPath(relative(workspace.root, targetDir))} already exists and is not empty.`,
      {
        hint: "VitNode never overwrites an existing plugin - choose another name.",
      },
    );
  }

  return { description, name, packageName, targetDir, workspace };
};

/**
 * Dependency versions for a new plugin, taken from `@vitnode/core` itself, so
 * a plugin is generated against the versions the core it depends on was built
 * and tested with. Inside a workspace that contains core (VitNode's own
 * repository) core and its config are linked rather than installed.
 */
export const pluginDependencyVersions = (
  core: null | PackageJson,
  workspace: PluginWorkspace,
): Record<string, string> => {
  const version = core?.version ?? "latest";
  const linked = (name: string) =>
    workspace.packages.has(name) ? "workspace:*" : `^${version}`;

  return {
    ...core?.peerDependencies,
    ...core?.dependencies,
    ...core?.devDependencies,
    "@vitnode/config": linked("@vitnode/config"),
    "@vitnode/core": linked("@vitnode/core"),
  };
};

/**
 * Writes the files of one template group. `wx` refuses to replace anything,
 * so even a file that appeared since {@link planPlugin} checked is kept.
 */
export const writeTemplateFiles = (
  targetDir: string,
  files: readonly TemplateFile[],
): void => {
  for (const file of files) {
    const path = join(targetDir, file.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.content, { encoding: "utf8", flag: "wx" });
  }
};
