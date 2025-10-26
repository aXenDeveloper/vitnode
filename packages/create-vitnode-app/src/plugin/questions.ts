import type { Command } from "commander";

import { confirm } from "@inquirer/prompts";
import color from "picocolors";

export interface CreatePluginCliReturn {
  install: boolean;
}

export const createPluginQuestionsCli = async (
  program: Command,
): Promise<CreatePluginCliReturn> => {
  const optionsFromProgram = program.opts();

  const options: CreatePluginCliReturn = {
    install: !optionsFromProgram.skipInstall,
  };

  if (optionsFromProgram.skipInstall === undefined) {
    options.install = await confirm({
      message: `Would you like to ${color.blue("Install dependencies")}?`,
    });
  }

  return options;
};
