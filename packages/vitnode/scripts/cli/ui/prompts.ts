import type { Ui } from "./ui";

import { CliError, EXIT_CODE, UserError } from "../errors";

export interface Prompter {
  confirm: (
    message: string,
    options?: { default?: boolean },
  ) => Promise<boolean>;
  text: (
    message: string,
    options?: {
      default?: string;
      validate?: (value: string) => string | true;
    },
  ) => Promise<string>;
}

const cancelled = () =>
  new CliError("usage", "Cancelled.", { exitCode: EXIT_CODE.interrupted });

const isPromptExit = (error: unknown): boolean =>
  error instanceof Error && error.name === "ExitPromptError";

/**
 * Prompts in the CLI's own visual language: `◆` while asking, `◇` once
 * answered, so a finished prompt reads like the rest of the output.
 *
 * `@inquirer/prompts` is imported on first use - `vitnode --help` and every
 * command that never asks anything should not pay for it.
 */
export const createPrompter = (ui: Ui): Prompter => {
  const theme = {
    prefix: {
      done: ui.colors.success(ui.symbols.active),
      idle: ui.colors.primary(ui.symbols.brand),
    },
  };

  const guard = async <T>(ask: () => Promise<T>): Promise<T> => {
    if (!ui.interactive) {
      throw new UserError(
        "This command needs an answer, but the terminal is not interactive.",
      );
    }

    try {
      return await ask();
    } catch (error) {
      if (isPromptExit(error)) throw cancelled();
      throw error;
    }
  };

  return {
    confirm: async (message, options = {}) =>
      guard(async () => {
        const { confirm } = await import("@inquirer/prompts");

        return confirm({ default: options.default, message, theme });
      }),
    text: async (message, options = {}) =>
      guard(async () => {
        const { input } = await import("@inquirer/prompts");

        return input({
          default: options.default,
          message,
          theme,
          validate: options.validate,
        });
      }),
  };
};

/**
 * Asks before something irreversible - or, where nobody can be asked, refuses
 * unless the command line already said yes.
 *
 * Never waits on a non-interactive terminal: a CI job either passed the flag
 * or gets a usage error naming it.
 */
export const requireConfirmation = async ({
  flag = "--yes",
  message,
  prompter,
  ui,
  yes,
}: {
  flag?: string;
  message: string;
  prompter: Prompter;
  ui: Ui;
  yes: boolean;
}): Promise<boolean> => {
  if (yes) return true;

  if (!ui.interactive) {
    throw new UserError(
      `${message} Confirmation is required, but the terminal is not interactive.`,
      { hint: `Pass ${flag} to confirm from a script or CI job.` },
    );
  }

  return prompter.confirm(message, { default: true });
};
