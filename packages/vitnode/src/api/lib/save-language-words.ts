import type { Context } from "hono";

import { and, eq } from "drizzle-orm";

import type { MultiLangValue } from "@/lib/helpers/multi-lang";

import { core_languages_words } from "@/database/languages";

export interface SaveLanguageWordsArgs {
  itemId: number;
  pluginCode: string;
  tableName: string;
  values: MultiLangValue;
  variable: string;
}

// Write mirror of `resolveRoleNames`: persists a `multiLang` field value (the
// `{ languageCode, value }[]` produced by the form) into `core_languages_words`.
// The remaining columns - the `(pluginCode, tableName, variable, itemId)` tuple
// that identifies the field - are supplied here by the backend. There is no
// unique constraint on that tuple, so the write replaces the existing rows
// (delete + insert) inside a single transaction.
export const saveLanguageWords = async (
  c: Context,
  { pluginCode, tableName, variable, itemId, values }: SaveLanguageWordsArgs,
): Promise<void> => {
  await c.get("db").transaction(async tx => {
    await tx
      .delete(core_languages_words)
      .where(
        and(
          eq(core_languages_words.pluginCode, pluginCode),
          eq(core_languages_words.tableName, tableName),
          eq(core_languages_words.variable, variable),
          eq(core_languages_words.itemId, itemId),
        ),
      );

    if (!values || values.length === 0) {
      return;
    }

    await tx.insert(core_languages_words).values(
      values.map(({ languageCode, value }) => ({
        languageCode,
        pluginCode,
        itemId,
        value,
        tableName,
        variable,
      })),
    );
  });
};
