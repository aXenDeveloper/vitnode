#!/usr/bin/env node
/* eslint-disable no-console */

import { config } from "dotenv";

import { buildPlugin } from "./build.js";
import { devPlugin } from "./dev.js";
import { i18nCheck } from "./i18n-check.js";
import { i18nCreate } from "./i18n-create.js";
import { i18nDelete } from "./i18n-delete.js";
import { i18nUpdate } from "./i18n-update.js";
import { processPlugin } from "./plugin.js";
import {
  generateDatabaseMigrations,
  initialDataForDatabase,
  prepareDatabase,
  runMigrations,
} from "./prepare-database.js";
import { preparePluginsFiles } from "./prepare-plugins-files.js";

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

  case "init":
    void prepareDatabase({ initMessage, flag });
    break;

  case "migrate":
    await generateDatabaseMigrations();
    if (flag === "--generate") {
      console.log(
        `${initMessage} \x1b[32mDatabase migrations generated successfully.\x1b[0m`,
      );
      process.exit(0);
    }
    await runMigrations();
    await initialDataForDatabase();

    console.log(
      `${initMessage} \x1b[32mDatabase migrated successfully.\x1b[0m`,
    );
    process.exit(0);
    break;

  case "plugin":
    if (flag === "--w" || flag === "--watch") {
      processPlugin({ initMessage });
    }
    break;

  case "prepare-plugins":
    await preparePluginsFiles(flag);
    console.log(`${initMessage} \x1b[32mPlugins prepared successfully.\x1b[0m`);
    process.exit(0);

    break;

  default:
    console.log(
      `${initMessage} \x1b[31mCommand not found: "${command ?? ""}"\x1b[0m`,
    );
    process.exit(1);
}
