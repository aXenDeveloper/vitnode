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
