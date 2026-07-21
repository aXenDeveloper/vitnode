import type { MultiLangValue } from "@vitnode/core/lib/helpers/multi-lang";
import type { Context } from "hono";

import { saveLanguageWords } from "@vitnode/core/api/lib/save-language-words";
import {
  core_languages,
  core_languages_words,
} from "@vitnode/core/database/languages";
import { getLangValue } from "@vitnode/core/lib/helpers/multi-lang";
import { removeSpecialCharacters } from "@vitnode/core/lib/special-characters";
import { and, eq, inArray } from "drizzle-orm";

import { CONFIG_PLUGIN } from "@/const";

export const POST_LANG_TABLE = "blog_posts";
export const POST_LANG_VARIABLES = ["title", "content", "friendlyUrl"] as const;
export type PostLangVariable = (typeof POST_LANG_VARIABLES)[number];

export interface PostTranslations {
  content: MultiLangValue;
  friendlyUrl: MultiLangValue;
  title: MultiLangValue;
}

export const slugifyMultiLang = (values: MultiLangValue): MultiLangValue =>
  values.map(({ languageCode, value }) => ({
    languageCode,
    value: removeSpecialCharacters(value),
  }));

export const getDefaultLanguageCode = async (
  c: Context,
): Promise<null | string> => {
  const [language] = await c
    .get("db")
    .select({ code: core_languages.code })
    .from(core_languages)
    .where(eq(core_languages.default, true))
    .limit(1);

  return language?.code ?? null;
};

// Every translated field lives in `core_languages_words`; nothing text-like
// remains on the table. This picks the default-language value (falling back to
// the first available) - used to derive slugs and validate required fields.
export const pickDefaultValue = (
  values: MultiLangValue,
  defaultLanguageCode: null | string,
): string =>
  values.find(item => item.languageCode === defaultLanguageCode)?.value ??
  values[0]?.value ??
  "";

// Resolve a translated field for a language: the exact translation, else the
// default-language value, else the first available. Used when rendering/indexing
// now that the flat mirror columns are gone.
export const resolveLangValue = (
  values: MultiLangValue | undefined,
  languageCode: string,
  defaultLanguageCode: null | string,
): string =>
  getLangValue(values, languageCode) ||
  pickDefaultValue(values ?? [], defaultLanguageCode);

export const savePostTranslations = async (
  c: Context,
  itemId: number,
  translations: PostTranslations,
): Promise<void> => {
  await Promise.all(
    POST_LANG_VARIABLES.map(async variable => {
      await saveLanguageWords(c, {
        pluginCode: CONFIG_PLUGIN.pluginId,
        tableName: POST_LANG_TABLE,
        variable,
        itemId,
        values:
          variable === "friendlyUrl"
            ? slugifyMultiLang(translations.friendlyUrl)
            : translations[variable],
      });
    }),
  );
};

export const loadPostTranslations = async (
  c: Context,
  postIds: number[],
): Promise<Map<number, PostTranslations>> => {
  const result = new Map<number, PostTranslations>();
  if (postIds.length === 0) {
    return result;
  }

  const words = await c
    .get("db")
    .select({
      itemId: core_languages_words.itemId,
      variable: core_languages_words.variable,
      languageCode: core_languages_words.languageCode,
      value: core_languages_words.value,
    })
    .from(core_languages_words)
    .where(
      and(
        eq(core_languages_words.pluginCode, CONFIG_PLUGIN.pluginId),
        eq(core_languages_words.tableName, POST_LANG_TABLE),
        inArray(core_languages_words.variable, [...POST_LANG_VARIABLES]),
        inArray(core_languages_words.itemId, postIds),
      ),
    );

  for (const id of postIds) {
    result.set(id, {
      title: words
        .filter(word => word.itemId === id && word.variable === "title")
        .map(({ languageCode, value }) => ({ languageCode, value })),
      content: words
        .filter(word => word.itemId === id && word.variable === "content")
        .map(({ languageCode, value }) => ({ languageCode, value })),
      friendlyUrl: words
        .filter(word => word.itemId === id && word.variable === "friendlyUrl")
        .map(({ languageCode, value }) => ({ languageCode, value })),
    });
  }

  return result;
};
