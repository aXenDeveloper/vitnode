#!/usr/bin/env node
/* eslint-disable no-console */

import { createClientDatabase, DATABASE_ENVS } from '@/utils/database/client';
import { existsSync } from 'fs';
import { join } from 'path';

import coreSchemaDatabase from '../src/database';
import { checkUpdateSchemaDatabase } from './check-update-schema-database';
import { copyFiles } from './copy-files';
import { generateDatabaseMigrations, runMigrations } from './database';
import { generateConfig } from './generate-config';
import { generateManifest } from './generate-manifest';
import { updatePlugins } from './update-plugins';

const initConsole = '\x1b[34m[VitNode]\x1b[0m \x1b[33m[Backend]\x1b[0m';

const getPluginsPath = () => {
  const pluginsPath = join(process.cwd(), 'src', 'plugins');
  if (!existsSync(pluginsPath)) {
    console.log(
      `⛔️ Plugins not found in 'src/plugins' directory. "${pluginsPath}"`,
    );
    process.exit(1);
  }

  return pluginsPath;
};

const init = async () => {
  let skipDatabase = false;
  if (process.argv[3] === '--skip-database') {
    const skipDatabaseMessage = `${initConsole} '--skip-database' flag detected. Skipping database setup...`;
    console.log(skipDatabaseMessage);
    skipDatabase = true;
  }

  const pluginsPath = getPluginsPath();
  console.log(
    `${initConsole} [1/${skipDatabase ? 2 : 6}] Setup the project. Generating the config file...`,
  );
  await generateConfig({ pluginsPath });

  console.log(
    `${initConsole} [2/${skipDatabase ? 2 : 6}] Copying files into backend...`,
  );
  await copyFiles({ pluginsPath });

  if (skipDatabase) {
    console.log(`${initConsole} ✅ Project setup complete.`);
    process.exit(0);
  }

  console.log(`${initConsole} [3/7] Generating database migrations...`);
  await generateDatabaseMigrations();

  const database = createClientDatabase({
    config: DATABASE_ENVS,
    schemaDatabase: coreSchemaDatabase,
  });

  console.log(
    `${initConsole} [4/7] Create tables in database using migrations...`,
  );
  await runMigrations();

  console.log(`${initConsole} [5/7] Updating plugins...`);
  await updatePlugins({ pluginsPath, db: database.db });

  console.log(`${initConsole} [6/7] Checking and updating schema database...`);
  await checkUpdateSchemaDatabase({ db: database.db });

  console.log(`${initConsole} [7/7] Generating the manifest files...`);
  await generateManifest({ db: database.db });

  console.log(`${initConsole} ✅ Project setup complete.`);
  process.exit(0);
};

const db = async () => {
  console.log(`${initConsole} [1/2] Generating database migrations...`);
  await generateDatabaseMigrations();

  console.log(
    `${initConsole} [2/2] Create tables in database using migrations...`,
  );
  await runMigrations();

  console.log(`${initConsole} ✅ Project setup complete.`);
  process.exit(0);
};

if (process.argv[2] === 'init') {
  void init();
}

if (process.argv[2] === 'db') {
  void db();
}
