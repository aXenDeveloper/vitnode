import type { Context } from "hono";

import type { NavigationText } from "@/lib/navigation";

import { saveLanguageWords } from "@/api/lib/save-language-words";
import { CONFIG_PLUGIN } from "@/config";
import { NAVIGATION_TABLE_NAME, NAVIGATION_WORDS } from "@/lib/navigation";

const nonEmpty = (values: readonly NavigationText[]): NavigationText[] =>
  values
    .map(item => ({
      languageCode: item.languageCode,
      value: item.value.trim(),
    }))
    .filter(item => item.value.length > 0);

export const saveNavigationWords = async (
  c: Context,
  itemId: number,
  {
    description,
    title,
  }: {
    description?: readonly NavigationText[];
    title?: readonly NavigationText[];
  },
): Promise<void> => {
  if (title !== undefined) {
    await saveLanguageWords(c, {
      itemId,
      pluginCode: CONFIG_PLUGIN.pluginId,
      tableName: NAVIGATION_TABLE_NAME,
      values: nonEmpty(title),
      variable: NAVIGATION_WORDS.title,
    });
  }

  if (description !== undefined) {
    await saveLanguageWords(c, {
      itemId,
      pluginCode: CONFIG_PLUGIN.pluginId,
      tableName: NAVIGATION_TABLE_NAME,
      values: nonEmpty(description),
      variable: NAVIGATION_WORDS.description,
    });
  }
};
