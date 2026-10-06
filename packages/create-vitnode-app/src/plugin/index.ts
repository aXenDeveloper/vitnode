import type { Command } from "commander";

import { input } from "@inquirer/prompts";
import { basename, resolve } from "node:path";

import { validateNpmName } from "../helpers/validate-pkg.js";
import { createPluginVitNode } from "./create/create-plugin-vitnode.js";
import { createPluginQuestionsCli } from "./questions.js";
import {
  reservedPluginNameProblem,
  validationProjectForPlugin,
} from "./validation.js";

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
        const base = basename(resolve(name));
        const validation = validateNpmName({ name: base });
        if (!validation.valid) {
          return `Invalid plugin name: ${validation.problems[0]}`;
        }

        return reservedPluginNameProblem(base) ?? true;
      },
    });
  }

  const { pluginName, pluginPath, eslint } =
    await validationProjectForPlugin(name);
  const options = await createPluginQuestionsCli(program);
  await createPluginVitNode({
    pluginName,
    pluginPath,
    eslint,
    ...options,
  });
};
