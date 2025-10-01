import { program } from "commander";
import { existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import color from "picocolors";

import { isFolderEmpty } from "./helpers/is-folder-empty.js";
import { isWriteable } from "./helpers/is-writeable.js";
import { validateNpmName } from "./helpers/validate-pkg.js";

export const validationProject = async (projectPath: string) => {
  // Verify the project path is provided
  if (!projectPath) {
    console.log(
      "\nPlease specify the project directory:\n" +
        `  ${color.cyan(program.name())} ${color.green("<project-directory>")}\n` +
        "For example:\n" +
        `  ${color.cyan(program.name())} ${color.green("my-vitnode-app")}\n\n` +
        `Run ${color.cyan(`${program.name()} --help`)} to see all options.`,
    );
    process.exit(1);
  }

  // Verify the project name is valid
  const resolvedProjectPath = resolve(projectPath);
  const projectName = basename(resolvedProjectPath);
  const validation = validateNpmName({ name: projectName });
  if (!validation.valid) {
    console.error(
      `Could not create a project called ${color.red(
        `"${projectName}"`,
      )} because of npm naming restrictions:`,
    );

    validation.problems.forEach(p => {
      console.error(`${color.red(color.bold("*"))} ${p}`);
    });
    process.exit(1);
  }

  // Verify the project dir is empty or doesn't exist
  const root = resolve(resolvedProjectPath);
  const appName = basename(root);
  const folderExists = existsSync(root);
  if (folderExists && !isFolderEmpty(root, appName)) {
    console.error("The specified directory is not empty.");
    process.exit(1);
  }

  // Verify the project dir is writeable
  if (!(await isWriteable(dirname(root)))) {
    console.error(
      "The application path is not writable, please check folder permissions and try again.",
    );
    console.error(
      "It is likely you do not have write permissions for this folder.",
    );
    process.exit(1);
  }

  return { appName, root };
};
