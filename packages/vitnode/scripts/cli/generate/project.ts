import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

import type { Prompter } from "../ui/prompts";
import type { Ui } from "../ui/ui";

import { ConfigError, UserError } from "../errors";
import { isPluginPackage } from "../plugins/discover";
import { findWorkspaceRoot, workspacePackageDirs } from "../plugins/workspace";
import { findPackageRoot, readPackageJson } from "../project/packages";
import { toDisplayPath } from "../ui/format";

export const API_CONFIG = "src/config.api.ts";
export const API_BUILDERS = "src/api/builders.ts";
export const MODULES_DIR = "src/api/modules";

export interface GeneratorProject {
  alias: boolean;
  display: string;
  id: string;
  root: string;
}

const hasApi = (dir: string) => existsSync(join(dir, API_CONFIG));

const describe = (cwd: string, root: string): GeneratorProject => {
  const tsconfig = join(root, "tsconfig.json");
  const alias =
    existsSync(tsconfig) &&
    /["']@\/\*["']\s*:/.test(readFileSync(tsconfig, "utf8"));

  return {
    alias,
    display: toDisplayPath(relative(cwd, root)) || ".",
    id: readPackageJson(root)?.name ?? root,
    root,
  };
};

const requireApi = (cwd: string, root: string): GeneratorProject => {
  const project = describe(cwd, root);

  if (!hasApi(root)) {
    throw new ConfigError(
      `${project.id} has no API: ${API_CONFIG} is missing.`,
      {
        details: [
          "The generator adds modules to the buildApiPlugin({ modules }) call in src/config.api.ts.",
          "Create that file first - a plugin made with create-vitnode-app --plugin already has it.",
        ],
      },
    );
  }

  return project;
};

const eligiblePlugins = (cwd: string): string[] => {
  const workspaceRoot = findWorkspaceRoot(cwd);
  if (workspaceRoot === null) return [];

  return workspacePackageDirs(workspaceRoot).filter(
    dir => isPluginPackage(dir) && hasApi(dir),
  );
};

export const resolveGeneratorProject = async ({
  cwd,
  project,
  prompter,
  ui,
}: {
  cwd: string;
  project?: string;
  prompter: Prompter;
  ui: Ui;
}): Promise<GeneratorProject> => {
  if (project !== undefined) {
    const byName = eligiblePluginsOrAll(cwd).find(
      dir => readPackageJson(dir)?.name === project,
    );
    if (byName !== undefined) return requireApi(cwd, byName);

    const asPath = isAbsolute(project) ? project : resolve(cwd, project);
    if (existsSync(join(asPath, "package.json"))) {
      if (!isPluginPackage(asPath)) {
        throw new UserError(`${project} is not a VitNode plugin package.`, {
          details: [
            "API generators currently write into plugins: a package that depends on @vitnode/core and has src/config.tsx.",
          ],
        });
      }

      return requireApi(cwd, asPath);
    }

    const candidates = eligiblePlugins(cwd).map(
      dir => readPackageJson(dir)?.name ?? dir,
    );
    throw new UserError(
      `No plugin named or located at "${project}" was found.`,
      {
        hint:
          candidates.length === 0
            ? "Pass the plugin's exact package name or the path to its folder."
            : `Plugins with an API here: ${candidates.join(", ")}`,
      },
    );
  }

  const packageRoot = findPackageRoot(cwd);
  if (packageRoot !== null && isPluginPackage(packageRoot)) {
    return requireApi(cwd, packageRoot);
  }

  const candidates = eligiblePlugins(cwd);

  if (candidates.length === 1 && candidates[0] !== undefined) {
    const only = describe(cwd, candidates[0]);
    ui.note(
      `Using ${only.id} (${only.display}), the only plugin with an API in this workspace.`,
    );

    return only;
  }

  if (candidates.length === 0) {
    throw new ConfigError("No plugin to generate into was found.", {
      details: [
        "Run the command inside a plugin folder, or pass --project <package-name|path>.",
        "API generators write into plugins with a src/config.api.ts.",
      ],
      hint: "Create a plugin with npx create-vitnode-app --plugin <name>.",
    });
  }

  const choices = candidates.map(dir => {
    const info = describe(cwd, dir);

    return { name: `${info.id}  ${ui.colors.muted(info.display)}`, value: dir };
  });

  if (!ui.interactive) {
    throw new UserError("More than one plugin could take this code.", {
      details: choices.map(choice => `  ${choice.name}`),
      hint: "Pass --project <package-name> to choose one.",
    });
  }

  return describe(cwd, await prompter.select("Which plugin?", choices));
};

const eligiblePluginsOrAll = (cwd: string): string[] => {
  const workspaceRoot = findWorkspaceRoot(cwd);

  return workspaceRoot === null
    ? []
    : workspacePackageDirs(workspaceRoot).filter(dir => isPluginPackage(dir));
};
