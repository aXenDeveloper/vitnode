import { core_languages_words } from '@/database/schema/languages';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { and, eq, getTableName } from 'drizzle-orm';
import { PgTableWithColumns, TableConfig } from 'drizzle-orm/pg-core';
import { StringLanguage } from 'vitnode-shared/string-language.dto';

import { ParseStringLanguageHelper } from './parse.service';

@Injectable()
export class StringLanguageHelper extends ParseStringLanguageHelper {
  constructor(databaseService: InternalDatabaseService) {
    super(databaseService);
  }

  async delete<T extends TableConfig>({
    plugin_code,
    item_id,
    database,
  }: {
    database: PgTableWithColumns<T>;
    item_id: number;
    plugin_code: string;
  }) {
    const oldData =
      await this.databaseService.db.query.core_languages_words.findMany({
        where: (table, { eq, and }) =>
          and(
            eq(table.plugin_code, plugin_code),
            eq(table.item_id, item_id),
            eq(table.table_name, getTableName(database)),
          ),
        columns: {
          value: true,
        },
      });

    await this.parseContent({
      content: [],
      oldContent: oldData.map(({ value }) => value),
      plugin_code,
    });

    await this.databaseService.db
      .delete(core_languages_words)
      .where(
        and(
          eq(core_languages_words.plugin_code, plugin_code),
          eq(core_languages_words.item_id, item_id),
          eq(core_languages_words.table_name, getTableName(database)),
        ),
      );
  }

  async get<T extends TableConfig>({
    plugin_code,
    item_ids,
    database,
    variables,
  }: {
    database: PgTableWithColumns<T>;
    item_ids: number[];
    plugin_code: string;
    variables: string[];
  }) {
    const tableName = getTableName(database);

    const strings =
      await this.databaseService.db.query.core_languages_words.findMany({
        columns: {
          language_code: true,
          value: true,
          variable: true,
          item_id: true,
        },
        where: (table, { eq, and, inArray }) =>
          and(
            eq(table.plugin_code, plugin_code),
            inArray(table.item_id, item_ids),
            eq(table.table_name, tableName),
            inArray(table.variable, variables),
          ),
      });

    return strings;
  }

  async parse<T extends TableConfig>({
    plugin_code,
    item_id,
    database,
    data = [],
    variable,
  }: {
    data: StringLanguage[];
    database: PgTableWithColumns<T>;
    item_id: number;
    plugin_code: string;
    variable: string;
  }) {
    // Check if plugin exists
    const plugin = await this.databaseService.db.query.core_plugins.findFirst({
      where: (table, { eq }) => eq(table.code, plugin_code),
      columns: {
        id: true,
      },
    });

    if (!plugin && plugin_code !== 'core') {
      throw new HttpException('PLUGIN_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    const tableName = getTableName(database);

    // Get old strings
    const oldString =
      await this.databaseService.db.query.core_languages_words.findMany({
        where: (table, { eq, and }) =>
          and(
            eq(table.plugin_code, plugin_code),
            eq(table.item_id, item_id),
            eq(table.table_name, tableName),
            eq(table.variable, variable),
          ),
        columns: {
          id: true,
          language_code: true,
          value: true,
        },
      });

    const updateData = await Promise.all(
      data.map(async item => {
        const itemExist = oldString.find(
          value => value.language_code === item.language_code,
        );

        if (itemExist) {
          const [update] = await this.databaseService.db
            .update(core_languages_words)
            .set({
              value: item.value,
            })
            .where(eq(core_languages_words.id, itemExist.id))
            .returning();

          return update;
        }

        const [insert] = await this.databaseService.db
          .insert(core_languages_words)
          .values({
            language_code: item.language_code,
            plugin_code,
            item_id,
            value: item.value,
            table_name: tableName,
            variable,
          })
          .returning();

        return insert;
      }),
    );

    await this.parseContent({
      oldContent: oldString.map(({ value }) => value),
      content: updateData.map(({ value }) => value),
      plugin_code,
    });

    // Delete remaining strings
    await Promise.all(
      oldString.map(async item => {
        const exist = updateData.find(
          el => el.language_code === item.language_code,
        );
        if (exist) return;

        await this.databaseService.db
          .delete(core_languages_words)
          .where(eq(core_languages_words.id, item.id));
      }),
    );

    return updateData;
  }
}
