import { core_admin_permissions } from '@/database/schema/admins';
import { core_groups } from '@/database/schema/groups';
import {
  core_languages,
  core_languages_words,
} from '@/database/schema/languages';
import { core_moderators_permissions } from '@/database/schema/moderators';
import { count } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import coreSchemaDatabase from '../src/database';

export const checkUpdateSchemaDatabase = async ({
  db,
}: {
  db: NodePgDatabase<typeof coreSchemaDatabase>;
}) => {
  const [languageCount] = await db
    .select({
      count: count(),
    })
    .from(core_languages);

  if (languageCount.count === 0) {
    await db.insert(core_languages).values([
      {
        code: 'en',
        name: 'English (USA)',
        default: true,
        protected: true,
        timezone: 'America/New_York',
        locale: 'en',
      },
    ]);
  }

  const [groupCount] = await db
    .select({
      count: count(),
    })
    .from(core_groups);

  if (groupCount.count === 0) {
    const [guestGroup] = await db
      .insert(core_groups)
      .values({
        protected: true,
        guest: true,
        files_allow_upload: false,
      })
      .returning();

    await db.insert(core_languages_words).values({
      language_code: 'en',
      plugin_code: 'core',
      item_id: guestGroup.id,
      value: 'Guest',
      table_name: 'core_groups',
      variable: 'name',
    });

    const [memberGroup] = await db
      .insert(core_groups)
      .values({
        protected: true,
        default: true,
      })
      .returning();

    await db.insert(core_languages_words).values({
      language_code: 'en',
      plugin_code: 'core',
      item_id: memberGroup.id,
      value: 'Member',
      table_name: 'core_groups',
      variable: 'name',
    });

    const [moderatorGroup] = await db
      .insert(core_groups)
      .values({
        protected: true,
        color: 'hsl(122, 80%, 45%)',
      })
      .returning();

    await db.insert(core_languages_words).values({
      language_code: 'en',
      plugin_code: 'core',
      item_id: moderatorGroup.id,
      value: 'Moderator',
      table_name: 'core_groups',
      variable: 'name',
    });

    const [adminGroup] = await db
      .insert(core_groups)
      .values({
        protected: true,
        root: true,
        color: 'hsl(0, 100%, 50%)',
      })
      .returning();

    await db.insert(core_languages_words).values({
      language_code: 'en',
      plugin_code: 'core',
      item_id: adminGroup.id,
      value: 'Administrator',
      table_name: 'core_groups',
      variable: 'name',
    });

    const [adminPermissions] = await db
      .select({
        count: count(),
      })
      .from(core_admin_permissions);

    if (adminPermissions.count === 0) {
      await db.insert(core_admin_permissions).values({
        group_id: adminGroup.id,
        protected: true,
        permissions: [],
      });
    }

    const [modPermissions] = await db
      .select({
        count: count(),
      })
      .from(core_moderators_permissions);

    if (modPermissions.count === 0) {
      await db.insert(core_moderators_permissions).values({
        group_id: moderatorGroup.id,
        protected: true,
      });

      await db.insert(core_moderators_permissions).values({
        group_id: adminGroup.id,
        protected: true,
      });
    }
  }
};
