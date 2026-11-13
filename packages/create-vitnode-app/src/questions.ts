import type { Command } from "commander";

import { confirm, select } from "@inquirer/prompts";
import color from "picocolors";

import { getAvailablePackageManagers } from "./helpers/get-available-package-managers.js";

/** What the app runs on in production. */
export type DeployTarget = "bun" | "cloudflare" | "node";

export interface CreateCliReturn {
  /**
   * `node`: any Node.js host (a server, Docker, Vercel). `bun`: dev, build and
   * production on Bun - TanStack Start with Nitro's `bun` preset, the Hono API
   * on `Bun.serve`. `cloudflare`: one Cloudflare Worker with a Durable Object
   * hub for WebSockets, Single App only.
   */
  deploy: DeployTarget;
  docker?: boolean;
  git: boolean;
  install: boolean;
  mode: "apiMonorepo" | "onlyApi" | "singleApp";
  monorepo?: boolean;
  oxlint: boolean;
  packageManager: string;
}

export const createQuestionsCli = async (
  program: Command,
): Promise<CreateCliReturn> => {
  const optionsFromProgram = program.opts();
  const options: CreateCliReturn = {
    packageManager: optionsFromProgram.packageManager,
    oxlint: optionsFromProgram.oxlint,
    git: !optionsFromProgram.skipGit,
    install: !optionsFromProgram.skipInstall,
    docker: optionsFromProgram.docker,
    mode: optionsFromProgram.mode,
    monorepo: optionsFromProgram.monorepo,
    deploy: optionsFromProgram.deploy,
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

  if (options.deploy === "cloudflare" && options.mode !== "singleApp") {
    throw new Error(
      'Cloudflare Workers deployment is only available for the Single App mode. Use "--mode singleApp" or pick "--deploy node" or "--deploy bun".',
    );
  }
  if (options.deploy === undefined) {
    const { bun } = await getAvailablePackageManagers();
    options.deploy = await select<DeployTarget>({
      message: `Where do you want to ${color.blue("deploy")}?`,
      choices: [
        {
          name: `Node.js - ${color.blue("a server, Docker or Vercel")}`,
          description:
            "Runs as a Node.js process. WebSockets through Nitro; several instances share them over Redis.",
          value: "node",
        },
        {
          name: `Bun - ${color.blue("dev, build and production on Bun")}`,
          description: bun
            ? "TanStack Start built with Nitro's bun preset and the Hono API on Bun.serve. Bun must be installed wherever the app runs."
            : "Install Bun (bun.sh) to choose this.",
          value: "bun",
          disabled: !bun,
        },
        ...(options.mode === "singleApp"
          ? [
              {
                name: `Cloudflare Workers - ${color.blue("one Worker + a Durable Object")}`,
                description:
                  "Builds one Worker with a Durable Object hub for WebSockets. Needs a PostgreSQL database reachable from Cloudflare and a Workers Paid plan.",
                value: "cloudflare" as const,
              },
            ]
          : []),
      ],
      default: options.packageManager === "bun" && bun ? "bun" : "node",
    });
  }

  if (optionsFromProgram.oxlint === undefined) {
    options.oxlint = await confirm({
      message: `Would you like to use ${color.blue("Oxlint & Oxfmt")}?`,
    });
  }

  if (optionsFromProgram.docker === undefined) {
    options.docker = await confirm({
      message: `Would you like to use ${color.blue("Docker")}? (PostgreSQL and Redis for development, and a production image)`,
    });
  }

  if (optionsFromProgram.skipGit === undefined) {
    options.git = await confirm({
      message: `Would you like to initialize a ${color.blue("Git repository")}?`,
      default: true,
    });
  }

  if (optionsFromProgram.skipInstall === undefined) {
    options.install = await confirm({
      message: `Would you like to ${color.blue("Install dependencies")}?`,
    });
  }

  return options;
};
