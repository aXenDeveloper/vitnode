import { core_languages } from '@/database/schema/languages';
import { getConfigFile } from '@/helpers/config';
import { inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import coreSchemaDatabase from '../src/database';

export const updateLanguages = async ({
  db,
}: {
  db: NodePgDatabase<typeof coreSchemaDatabase>;
}) => {
  const config = getConfigFile();

  await db.transaction(async tx => {
    const languagesFromDb = await tx.query.core_languages.findMany({});

    // Extract language codes from the database
    const dbLangCodes = languagesFromDb.map(lang => lang.code);

    // Determine which languages need to be added (in config but not in DB)
    const langsToAdd = config.langs.filter(
      lang => !dbLangCodes.includes(lang.code),
    );

    // Determine which languages need to be removed (in DB but not in config)
    const langsToRemove = dbLangCodes.filter(
      lang => !config.langs.map(l => l.code).includes(lang),
    );

    // Insert missing languages into the database
    if (langsToAdd.length > 0) {
      await tx.insert(core_languages).values(
        langsToAdd.map(lang => ({
          code: lang.code,
          name: lang.name,
          enabled: lang.enabled,
          time_24: lang.time_24,
          locale: lang.locale,
          allow_in_input: lang.allow_in_input,
          timezone: lang.timezone,
        })),
      );
    }

    // Remove languages that are not present in the config
    if (langsToRemove.length > 0) {
      await tx
        .delete(core_languages)
        .where(inArray(core_languages.code, langsToRemove));
    }
  });
};
