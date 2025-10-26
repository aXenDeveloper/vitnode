import type { Command } from "commander";

import { input } from "@inquirer/prompts";
import { basename, resolve } from "node:path";

import { validateNpmName } from "../helpers/validate-pkg.js";
import { createPluginQuestionsCli } from "./questions.js";
import { validationProjectForPlugin } from "./validation.js";

export const createPlugin = async ({
  program,
  projectPath,
}: {
  program: Command;
  projectPath: string;
}) => {
  let name = projectPath;
  if (!name) {
    name = await input({
      message: "What is your plugin named?",
      default: "my-vitnode-plugin",
      validate: (name: string) => {
        const validation = validateNpmName({ name: basename(resolve(name)) });
        if (validation.valid) return true;

        return `Invalid plugin name: ${validation.problems[0]}`;
      },
    });
  }

  const { pluginName, pluginPath } = await validationProjectForPlugin(name);

  const options = await createPluginQuestionsCli(program);
};
