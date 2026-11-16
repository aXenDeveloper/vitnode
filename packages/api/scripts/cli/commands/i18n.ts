import type { CommandContext, OutputOptions } from "../context";

import { UserError } from "../errors";

export interface I18nOptions extends OutputOptions {
  ci?: boolean;
  code?: string;
  codes?: string[];
  concurrency?: string;
  model?: string;
  name?: string[];
  yes?: boolean;
}

/**
 * The i18n commands. Each one runs the matching script with the CLI's own
 * terminal, prompter and error boundary; the scripts never touch `process`.
 */
export const runI18nCheckCommand = async (
  context: CommandContext,
  { ci }: I18nOptions,
): Promise<number> => {
  context.ui.header("Translations");
  const { i18nCheck } = await import("../../i18n-check");

  return i18nCheck({ ci, cwd: context.cwd, ui: context.ui });
};

export const runI18nCreateCommand = async (
  context: CommandContext,
  { code, name }: I18nOptions,
): Promise<number> => {
  context.ui.header("Add a language");
  const { i18nCreate } = await import("../../i18n-create");

  return i18nCreate({
    code,
    context,
    name: name === undefined || name.length === 0 ? undefined : name.join(" "),
  });
};

export const runI18nDeleteCommand = async (
  context: CommandContext,
  { code, yes }: I18nOptions,
): Promise<number> => {
  context.ui.header("Remove a language");
  const { i18nDelete } = await import("../../i18n-delete");

  return i18nDelete({ code, context, yes });
};

export const runI18nUpdateCommand = async (
  context: CommandContext,
  _options: I18nOptions,
): Promise<number> => {
  context.ui.header("Sync translations");
  const { i18nUpdate } = await import("../../i18n-update");

  return i18nUpdate({ cwd: context.cwd, ui: context.ui });
};

export const parseConcurrency = (value: string | undefined) => {
  if (value === undefined) return undefined;
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new UserError(`"${value}" is not a valid --concurrency.`, {
      hint: "Use a whole number above 0, e.g. --concurrency 4.",
    });
  }

  return parsed;
};

export const runI18nUpdateAiCommand = async (
  context: CommandContext,
  { codes, concurrency, model }: I18nOptions,
): Promise<number> => {
  context.ui.header("Translate with AI");
  const { i18nUpdateAi } = await import("../../i18n-update-ai");

  return i18nUpdateAi({
    codes,
    concurrency: parseConcurrency(concurrency),
    context,
    model,
  });
};
