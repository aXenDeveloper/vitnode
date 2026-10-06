import type { CommandContext, OutputOptions } from "../context";

import {
  databaseBootstrap,
  generateDatabaseMigrations,
} from "../../prepare-database";
import { EXIT_CODE } from "../errors";

/**
 * `vitnode db:prepare` - generate, apply, seed: the bootstrap a `dev` script
 * gates on. Unchanged to the step; only its output goes through the CLI's UI
 * and its failure through the CLI's error boundary.
 */
export const runDbPrepareCommand = async (
  { ui }: CommandContext,
  _options: OutputOptions,
): Promise<number> => {
  ui.header("Database");
  await databaseBootstrap({
    log: message => {
      ui.note(message);
    },
  });
  ui.success("Database ready.");

  return EXIT_CODE.ok;
};

/**
 * `vitnode migrate` - the same bootstrap under its older name, kept because
 * deployment guides and generated projects spell it. `--generate` only writes
 * the migration.
 */
export const runMigrateCommand = async (
  { ui }: CommandContext,
  { generate }: OutputOptions & { generate?: boolean },
): Promise<number> => {
  ui.header("Database");

  if (generate === true) {
    await generateDatabaseMigrations();
    ui.success("Database migrations generated.");

    return EXIT_CODE.ok;
  }

  await databaseBootstrap({
    log: message => {
      ui.note(message);
    },
  });
  ui.success("Database migrated.");

  return EXIT_CODE.ok;
};

// The i18n commands read their own arguments and exit on their own; the
// parser in front of them only refuses what they would not understand.

export const runI18nCheckCommand = async (
  _context: CommandContext,
  { ci }: OutputOptions & { ci?: boolean },
): Promise<number> => {
  const { i18nCheck } = await import("../../i18n-check");
  await i18nCheck(ci === true ? "--ci" : undefined);

  return EXIT_CODE.ok;
};

export const runI18nCreateCommand = async (): Promise<number> => {
  const { i18nCreate } = await import("../../i18n-create");
  await i18nCreate();

  return EXIT_CODE.ok;
};

export const runI18nDeleteCommand = async (): Promise<number> => {
  const { i18nDelete } = await import("../../i18n-delete");
  await i18nDelete();

  return EXIT_CODE.ok;
};

export const runI18nUpdateCommand = async (): Promise<number> => {
  const { i18nUpdate } = await import("../../i18n-update");
  await i18nUpdate();

  return EXIT_CODE.ok;
};

export const runI18nUpdateAiCommand = async (): Promise<number> => {
  const { i18nUpdateAi } = await import("../../i18n-update-ai");
  await i18nUpdateAi();

  return EXIT_CODE.ok;
};
