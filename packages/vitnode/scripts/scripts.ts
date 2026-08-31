#!/usr/bin/env node
/* eslint-disable no-console */

import { config } from "dotenv";

import { buildPlugin } from "./build.js";
import { parseCliArguments } from "./cli-arguments.js";
import { HELP_FLAGS, renderHelp } from "./cli-commands.js";
import { devPlugin } from "./dev.js";
import { i18nCheck } from "./i18n-check.js";
import { i18nCreate } from "./i18n-create.js";
import { i18nDelete } from "./i18n-delete.js";
import { i18nUpdateAi } from "./i18n-update-ai.js";
import { i18nUpdate } from "./i18n-update.js";
import {
  databaseBootstrap,
  generateDatabaseMigrations,
} from "./prepare-database.js";

config({
  quiet: true,
});

const initMessage = "\x1b[34m[VitNode]\x1b[0m";

const argv = process.argv.slice(2);
const [name] = argv;

/**
 * The two invocations that are a question rather than a command.
 *
 * Answered above the parser, because `--help` and a bare `vitnode` are not
 * commands and `parseCliArguments` refuses both - correctly, and uselessly for
 * somebody who is asking what the commands *are*. The list is the answer to that
 * question, so it prints and exits 0. See `./cli-commands.ts`.
 */
if (name === undefined || HELP_FLAGS.includes(name)) {
  console.log(renderHelp());
  process.exit(0);
}

/**
 * The invocation, checked before anything can act on it.
 *
 * Above the `switch` and not inside it, because the guarantee is that an invalid
 * `argv` performs *no* command side effect: nothing is generated, nothing is
 * migrated, nothing is seeded and no compiler is started. `vitnode migrate
 * --generat` used to reach `databaseBootstrap` - the mistyped flag simply failed
 * an `=== "--generate"` test and fell through to the full run. It now exits 1
 * here. See `./cli-arguments.ts`.
 *
 * The refusal is followed by the command list, because every refusal this can
 * print - an unknown command, an unknown flag, a flag missing its value - is
 * somebody who needs to see the surface rather than be told again that they
 * missed it.
 */
const parsed = parseCliArguments(argv);

if (!parsed.ok) {
  console.error(`${initMessage} \x1b[31m${parsed.message}\x1b[0m`);
  console.log(renderHelp());
  process.exit(1);
}

const { args, command } = parsed;

/**
 * Runs a database command, and turns a failure into an exit code.
 *
 * Both database commands are the same work, so both fail the same way, and the
 * `await` is the whole point of the wrapper: a `dev` script chains on `&&`, so
 * nothing may start unless this resolved. An unawaited call would leave a failed
 * step as an unhandled rejection - non-zero by Node's default rather than by
 * anybody's decision.
 */
const runDatabaseCommand = async (
  succeeded: string,
  failed: string,
  run: () => Promise<void>,
): Promise<never> => {
  try {
    await run();
    console.log(`${initMessage} \x1b[32m${succeeded}\x1b[0m`);
    process.exit(0);
  } catch (error) {
    console.error(`${initMessage} \x1b[31m${failed}\x1b[0m`);
    console.error(
      error instanceof Error ? (error.stack ?? error.message) : String(error),
    );
    process.exit(1);
  }
};

switch (command) {
  case "build":
    try {
      await buildPlugin();
      console.log(
        `${initMessage} \x1b[32mBuild completed successfully.\x1b[0m`,
      );
      process.exit(0);
    } catch (error) {
      // The compilers inherit this process' streams, so a *compile* error has
      // already been printed. This one is the other kind - a binary that could
      // not be started at all - and it used to exit 1 saying nothing.
      console.error(`${initMessage} \x1b[31mBuild failed.\x1b[0m`);
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
    break;

  /**
   * The development bootstrap, and the one command a `dev` script waits for.
   * Generate, apply, seed - see `databaseBootstrap`.
   */
  case "db:prepare":
    await runDatabaseCommand(
      "Database ready.",
      "Database bootstrap failed - not starting anything.",
      async () => {
        await databaseBootstrap({ initMessage });
      },
    );
    break;

  case "dev":
    devPlugin({ initMessage });
    break;

  /**
   * `--ci` is read off the validated arguments, so the only thing that can turn
   * it on is that exact spelling. `--cii` no longer reaches this line at all -
   * it used to arrive as an unrecognised `flag` and quietly produce a soft,
   * zero-exit report for a CI job that had asked for a hard failure.
   */
  case "i18n:check":
    await i18nCheck(args.includes("--ci") ? "--ci" : undefined);
    break;

  case "i18n:create":
    await i18nCreate();
    break;

  case "i18n:delete":
    await i18nDelete();
    break;

  case "i18n:update":
    await i18nUpdate();
    break;

  case "i18n:update:ai":
    await i18nUpdateAi();
    break;

  /**
   * The explicit migration workflow, and the name every deployment guide spells.
   *
   * `--generate` writes migration files and stops - the only thing either
   * database command does that the other does not. It is read off the validated
   * arguments, so nothing but that exact spelling can ask for it. Without it this
   * is `db:prepare`'s work under `db:prepare`'s implementation, so the two names
   * cannot drift into two behaviours.
   */
  case "migrate":
    await runDatabaseCommand(
      args.includes("--generate")
        ? "Database migrations generated successfully."
        : "Database migrated successfully.",
      "Database migration failed.",
      args.includes("--generate")
        ? generateDatabaseMigrations
        : async () => {
            await databaseBootstrap({ initMessage });
          },
    );
    break;
}
