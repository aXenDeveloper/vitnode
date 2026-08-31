import type { Command } from "commander";

import { confirm, select } from "@inquirer/prompts";
import color from "picocolors";

import { getAvailablePackageManagers } from "./helpers/get-available-package-managers.js";

export interface CreateCliReturn {
  docker?: boolean;
  eslint: boolean;
  install: boolean;
  mode: "apiMonorepo" | "onlyApi" | "singleApp";
  monorepo?: boolean;
  packageManager: string;
}

export const createQuestionsCli = async (
  program: Command,
): Promise<CreateCliReturn> => {
  const optionsFromProgram = program.opts();
  const options: CreateCliReturn = {
    packageManager: optionsFromProgram.packageManager,
    eslint: optionsFromProgram.eslint,
    install: optionsFromProgram.install === true,
    docker: optionsFromProgram.docker,
    mode: optionsFromProgram.mode,
    monorepo: optionsFromProgram.monorepo,
  };

  if (!optionsFromProgram.packageManager) {
    const availablePackageManagers = await getAvailablePackageManagers();
    options.packageManager = await select({
      message: `Which ${color.blue("package manager")} do you want to use?`,
      choices: [
        {
          name: `bun${availablePackageManagers.bun ? `@${availablePackageManagers.bun}` : ""}`,
          value: "bun",
          disabled: !availablePackageManagers.bun,
        },
        {
          name: `pnpm${availablePackageManagers.pnpm ? `@${availablePackageManagers.pnpm}` : ""}`,
          value: "pnpm",
          disabled: !availablePackageManagers.pnpm,
        },
        {
          name: `npm${availablePackageManagers.npm ? `@${availablePackageManagers.npm}` : ""}`,
          value: "npm",
          disabled: !availablePackageManagers.npm,
        },
      ],
    });
  }

  if (optionsFromProgram.mode === undefined) {
    options.mode = await select({
      message: `What type of ${color.blue("app")} do you want to create?`,
      choices: [
        {
          name: `Single App - ${color.blue("TanStack Start")} & ${color.blue("Hono.js")}`,
          description:
            "One app: a TanStack Start frontend with the Hono API mounted inside it at /api.",
          value: "singleApp",
        },
        {
          name: `Monorepo App - ${color.blue("TanStack Start")} & ${color.blue("Hono.js")}`,
          description:
            "Two apps: a TanStack Start frontend and a Hono API served separately.",
          value: "apiMonorepo",
        },
        {
          name: `Only API - ${color.blue("Hono.js")}`,
          description: "Just the Hono API, with no frontend app.",
          value: "onlyApi",
        },
      ],
      default: "singleApp",
    });
  }

  if (
    optionsFromProgram.monorepo === undefined &&
    options.mode !== "apiMonorepo"
  ) {
    options.monorepo = await confirm({
      message: `Would you like to use ${color.blue("TurboRepo")} for monorepo management? ${color.red("(Required for plugins development)")}`,
      default: false,
    });
  }

  if (optionsFromProgram.eslint === undefined) {
    options.eslint = await confirm({
      message: `Would you like to use ${color.blue("ESLint & Prettier")}?`,
    });
  }

  if (optionsFromProgram.docker === undefined) {
    options.docker = await confirm({
      message: `Would you like to use ${color.blue("Docker Container")}?`,
    });
  }

  /**
   * Both spellings, so the whole generator can be driven without a terminal.
   * `--skip-install` alone could only ever say no.
   */
  if (
    optionsFromProgram.skipInstall === undefined &&
    optionsFromProgram.install === undefined
  ) {
    options.install = await confirm({
      message: `Would you like to ${color.blue("Install dependencies")}?`,
    });
  }

  return options;
};
