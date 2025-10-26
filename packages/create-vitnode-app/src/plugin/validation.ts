import { program } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import color from "picocolors";

import type { PackageJSON } from "../helpers/packages-json.js";

import { isFolderEmpty } from "../helpers/is-folder-empty.js";
import { isWriteable } from "../helpers/is-writeable.js";
import { validateNpmName } from "../helpers/validate-pkg.js";

export const validationProjectForPlugin = async (projectPath: string) => {
  // Verify the project path is provided
  if (!projectPath) {
    console.log(
      "\nPlease specify the plugin directory:\n" +
        `  ${color.cyan(program.name())} ${color.green("<plugin-directory>")}\n` +
        "For example:\n" +
        `  ${color.cyan(program.name())} ${color.green("my-vitnode-plugin")}\n\n` +
        `Run ${color.cyan(`${program.name()} --help`)} to see all options.`,
    );
    process.exit(1);
  }

  // Verify we're in a monorepo with turbo.json and package.json
  const cwd = process.cwd();
  const turboJsonPath = join(cwd, "turbo.json");
  const packageJsonPath = join(cwd, "package.json");

  // Check if turbo.json exists
  if (!existsSync(turboJsonPath)) {
    console.error(
      `${color.red("Error:")} Could not find ${color.cyan("turbo.json")} in the current directory.`,
    );
    console.error(
      `Plugins must be created inside a VitNode monorepo structure.`,
    );
    console.error(
      `\nPlease run this command from the root of your VitNode monorepo project.`,
    );
    process.exit(1);
  }

  // Check if package.json exists and has packageManager defined
  if (!existsSync(packageJsonPath)) {
    console.error(
      `${color.red("Error:")} Could not find ${color.cyan("package.json")} in the current directory.`,
    );
    console.error(
      `\nPlease run this command from the root of your VitNode monorepo project.`,
    );
    process.exit(1);
  }

  try {
    const packageJson: PackageJSON = JSON.parse(
      readFileSync(packageJsonPath, "utf-8"),
    );

    if (!packageJson.packageManager) {
      console.error(
        `${color.red("Error:")} The ${color.cyan("packageManager")} field is not defined in ${color.cyan("package.json")}.`,
      );
      console.error(
        `\nPlease add a ${color.cyan('"packageManager"')} field to your ${color.cyan("package.json")} file.`,
      );
      console.error(
        `Example: ${color.green('"packageManager": "pnpm@10.18.3"')}`,
      );
      process.exit(1);
    }
  } catch (error) {
    console.error(
      `${color.red("Error:")} Failed to read or parse ${color.cyan("package.json")}.`,
    );
    console.error(error);
    process.exit(1);
  }

  // Verify the project name is valid
  const projectName = basename(resolve(projectPath));
  const validation = validateNpmName({ name: projectName });
  if (!validation.valid) {
    console.error(
      `Could not create a plugin called ${color.red(
        `"${projectName}"`,
      )} because of npm naming restrictions:`,
    );

    validation.problems.forEach(p => {
      console.error(`${color.red(color.bold("*"))} ${p}`);
    });
    process.exit(1);
  }

  // Create plugin path inside plugins folder
  const pluginsDir = join(cwd, "plugins");
  const pluginPath = join(pluginsDir, projectName);
  const pluginName = basename(pluginPath);

  // Verify the plugin dir is empty or doesn't exist
  const folderExists = existsSync(pluginPath);
  if (folderExists && !isFolderEmpty(pluginPath, pluginName)) {
    console.error(
      `The directory ${color.cyan(`plugins/${pluginName}`)} is not empty.`,
    );
    process.exit(1);
  }

  // Verify the plugins dir is writeable
  if (!(await isWriteable(pluginsDir))) {
    console.error(
      `The plugins directory is not writable, please check folder permissions and try again.`,
    );
    console.error(
      `It is likely you do not have write permissions for this folder.`,
    );
    process.exit(1);
  }

  return { pluginName, pluginPath };
};
