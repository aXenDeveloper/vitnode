#!/usr/bin/env node
/* eslint-disable no-console */

import { config } from "dotenv";

import { buildPlugin } from "./build.js";
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

const command = process.argv[2];
const flag = process.argv[3];

switch (command) {
  case "build":
    try {
      await buildPlugin();
      console.log(
        `${initMessage} \x1b[32mBuild completed successfully.\x1b[0m`,
      );
      process.exit(0);
    } catch {
      process.exit(1);
    }
    break;

  /**
   * The development bootstrap, and the one command a `dev` script waits for.
   *
   * `await`ed, and the `catch` is the whole reason this branch is not a
   * one-liner: it was `case "init": void prepareDatabase(...)`, and `void` on an
   * async call means a step that throws becomes an unhandled rejection rather
   * than an exit code this process chose. It happened to exit non-zero because
   * Node's default for an unhandled rejection is to crash - which is to say the
   * fail-fast a dev server depends on was a Node default rather than a decision.
   * Now it is a decision.
   *
   * Nothing after this may start unless it resolved. `dev` scripts chain with
   * `&&` for exactly that reason.
   */
  case "db:prepare":
    try {
      await databaseBootstrap({ initMessage });
      console.log(`${initMessage} \x1b[32mDatabase ready.\x1b[0m`);
      process.exit(0);
    } catch (error) {
      console.error(
        `${initMessage} \x1b[31mDatabase bootstrap failed - not starting anything.\x1b[0m`,
      );
      console.error(
        error instanceof Error ? (error.stack ?? error.message) : String(error),
      );
      process.exit(1);
    }
    break;

  case "dev":
    devPlugin({ initMessage });
    break;

  case "i18n:check":
    await i18nCheck(flag);
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
   * The same bootstrap under its older name, kept because it is the one the
   * documentation and every deployment guide spell.
   *
   * `db:migrate` in a generated project runs this, `docs/dev/database`,
   * `docs/dev/content-engine/*` and the Vercel deployment guide all tell people
   * to run it, and published projects have it in their `package.json`. Its
   * behaviour is therefore unchanged to the step - generate, apply, seed - and it
   * delegates rather than reimplementing, so the two names cannot drift into two
   * behaviours.
   */
  case "migrate":
    try {
      if (flag === "--generate") {
        await generateDatabaseMigrations();
        console.log(
          `${initMessage} \x1b[32mDatabase migrations generated successfully.\x1b[0m`,
        );
        process.exit(0);
      }

      await databaseBootstrap({ initMessage });
      console.log(
        `${initMessage} \x1b[32mDatabase migrated successfully.\x1b[0m`,
      );
      process.exit(0);
    } catch (error) {
      console.error(`${initMessage} \x1b[31mDatabase migration failed.\x1b[0m`);
      console.error(
        error instanceof Error ? (error.stack ?? error.message) : String(error),
      );
      process.exit(1);
    }
    break;

  default:
    console.log(
      `${initMessage} \x1b[31mCommand not found: "${command ?? ""}"\x1b[0m`,
    );
    process.exit(1);
}
