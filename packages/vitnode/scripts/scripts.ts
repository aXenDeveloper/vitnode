#!/usr/bin/env node
/** biome-ignore-all lint/suspicious/noConsole: <no need> */

import { config } from "dotenv";

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
