import type { MultiLangValue } from "@vitnode/core/lib/helpers/multi-lang";
import type { Context } from "hono";

import { saveLanguageWords } from "@vitnode/core/api/lib/save-language-words";
import { core_languages_words } from "@vitnode/core/database/languages";
import { and, eq, inArray } from "drizzle-orm";

import { CONFIG_PLUGIN } from "@/const";

export const CATEGORY_LANG_TABLE = "blog_categories";
export const CATEGORY_LANG_VARIABLE = "title";

export interface CategoryTranslations {
  title: MultiLangValue;
}

// The category title lives entirely in `core_languages_words` (one row per
// language); nothing text-like remains on `blog_categories`.
export const saveCategoryTranslations = async (
  c: Context,
  itemId: number,
  { title }: CategoryTranslations,
): Promise<void> => {
  await saveLanguageWords(c, {
    pluginCode: CONFIG_PLUGIN.pluginId,
    tableName: CATEGORY_LANG_TABLE,
    variable: CATEGORY_LANG_VARIABLE,
    itemId,
    values: title,
  });
};

export const loadCategoryTranslations = async (
  c: Context,
  categoryIds: number[],
): Promise<Map<number, MultiLangValue>> => {
  const result = new Map<number, MultiLangValue>();
  if (categoryIds.length === 0) {
    return result;
  }

  const words = await c
    .get("db")
    .select({
      itemId: core_languages_words.itemId,
      languageCode: core_languages_words.languageCode,
      value: core_languages_words.value,
    })
    .from(core_languages_words)
    .where(
      and(
        eq(core_languages_words.pluginCode, CONFIG_PLUGIN.pluginId),
        eq(core_languages_words.tableName, CATEGORY_LANG_TABLE),
        eq(core_languages_words.variable, CATEGORY_LANG_VARIABLE),
        inArray(core_languages_words.itemId, categoryIds),
      ),
    );

  for (const id of categoryIds) {
    result.set(
      id,
      words
        .filter(word => word.itemId === id)
        .map(({ languageCode, value }) => ({ languageCode, value })),
    );
  }

  return result;
};
