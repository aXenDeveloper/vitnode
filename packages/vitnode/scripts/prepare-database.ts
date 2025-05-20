/* eslint-disable no-console */

import { dbClient } from '@/database/client.js';
import { core_admin_permissions } from '@/database/schema/admins.js';
import {
  core_languages,
  core_languages_words,
} from '@/database/schema/languages.js';
import { core_moderators_permissions } from '@/database/schema/moderators.js';
import { core_roles } from '@/database/schema/roles.js';
import { count } from 'drizzle-orm';

import { runInteractiveShellCommand } from './run-interactive-shell-command.js';

export const generateDatabaseMigrations = async () => {
  try {
    await runInteractiveShellCommand('npm', ['run', 'drizzle-kit', 'up']);
    await runInteractiveShellCommand('npm', ['run', 'drizzle-kit', 'generate']);
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', err);
    process.exit(1);
  }
};

export const runMigrations = async () => {
  try {
    await runInteractiveShellCommand('npm', ['run', 'drizzle-kit', 'migrate']);
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', err);
    process.exit(1);
  }
};

export const initialDataForDatabase = async () => {
  const [roleCount] = await dbClient
    .select({
      count: count(),
    })
    .from(core_roles)
    .limit(1);

  const [languageCount] = await dbClient
    .select({
      count: count(),
    })
    .from(core_languages);
  if (languageCount.count === 0) {
    await dbClient.insert(core_languages).values([
      {
        code: 'en',
        name: 'English (USA)',
        default: true,
        protected: true,
        timezone: 'America/New_York',
      },
    ]);
  }

  if (roleCount.count === 0) {
    const roles = await dbClient
      .insert(core_roles)
      .values([
        {
          // Guest role
          protected: true,
          guest: true,
        },
        {
          // Member role
          protected: true,
          default: true,
        },
        {
          // Moderator role
          protected: true,
          color: 'hsl(122, 80%, 45%)',
        },
        {
          // Administrator role
          protected: true,
          root: true,
          color: 'hsl(0, 100%, 50%)',
        },
      ])
      .returning({ id: core_roles.id });

    await dbClient.insert(core_languages_words).values([
      {
        // Guest role
        languageCode: 'en',
        pluginCode: 'core',
        itemId: roles[0].id,
        value: 'Guest',
        tableName: 'core_roles',
        variable: 'name',
      },
      {
        // Member role
        languageCode: 'en',
        pluginCode: 'core',
        itemId: roles[1].id,
        value: 'Member',
        tableName: 'core_roles',
        variable: 'name',
      },
      {
        // Moderator role
        languageCode: 'en',
        pluginCode: 'core',
        itemId: roles[2].id,
        value: 'Moderator',
        tableName: 'core_roles',
        variable: 'name',
      },
      {
        // Administrator role
        languageCode: 'en',
        pluginCode: 'core',
        itemId: roles[3].id,
        value: 'Administrator',
        tableName: 'core_roles',
        variable: 'name',
      },
    ]);

    // Insert default permissions
    await Promise.all([
      await dbClient.insert(core_moderators_permissions).values({
        roleId: roles[2].id,
        protected: true,
      }),
      await dbClient.insert(core_admin_permissions).values({
        roleId: roles[3].id,
        protected: true,
      }),
    ]);
  }
};

export const prepareDatabase = async ({
  initMessage,
}: {
  initMessage: string;
}) => {
  console.log(`${initMessage} [1/3] Generate migrations...`);
  await generateDatabaseMigrations();
  console.log(`${initMessage} [2/3] Run migrations...`);
  await runMigrations();
  console.log(`\n${initMessage} [3/3] Insert initial data...`);
  await initialDataForDatabase();
  console.log(`${initMessage} \x1b[32mDatabase prepared successfully.\x1b[0m`);
  process.exit(0);
};
