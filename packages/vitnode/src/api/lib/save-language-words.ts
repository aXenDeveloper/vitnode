import type { Context } from "hono";

import { and, eq } from "drizzle-orm";

import type { MultiLangValue } from "@/lib/helpers/multi-lang";

import { core_languages_words } from "@/database/languages";

/** Which field of which record a multi-language value belongs to, plus the value. */
export interface SaveLanguageWordsArgs {
  /** The record's id. */
  itemId: number;
  /** The owning plugin's code, e.g. `"blog"`. */
  pluginCode: string;
  /** The record's table, e.g. `"blog_categories"`. */
  tableName: string;
  /** The `multiLang` field's value: one `{ languageCode, value }` per language. Empty or missing clears it. */
  values: MultiLangValue;
  /** The field name, e.g. `"name"`. */
  variable: string;
}

/**
 * Saves a multi-language field value (an `AutoForm` `multiLang` field) to
 * `core_languages_words`, replacing every stored translation of that field in
 * one transaction. Server-only; read the rows back by the same
 * `(pluginCode, tableName, variable, itemId)` to prefill an edit form.
 *
 * @example
 * ```ts
 * import { saveLanguageWords } from "@vitnode/core/api/lib/save-language-words";
 *
 * await saveLanguageWords(c, {
 *   pluginCode: "blog",
 *   tableName: "blog_categories",
 *   variable: "name",
 *   itemId: category.id,
 *   values: name,
 * });
 * ```
 */
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
