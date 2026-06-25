import type { Context } from "hono";

import { and, eq, inArray } from "drizzle-orm";

import { core_languages_words } from "@/database/languages";

export interface ResolvedRoleName {
  languageCode: string;
  name: string;
}

// Role names are not stored on `core_roles` — every translation lives in
// `core_languages_words`. This resolves the name translations for a set of role
// ids in a single query and returns them keyed by role id, ready to hand to the
// `RoleFormat` component (which picks the active locale on the frontend).
export const resolveRoleNames = async (
  c: Context,
  roleIds: number[],
): Promise<Map<number, ResolvedRoleName[]>> => {
  const ids = [...new Set(roleIds)];
  if (ids.length === 0) {
    return new Map();
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
        eq(core_languages_words.tableName, "core_roles"),
        eq(core_languages_words.variable, "name"),
        eq(core_languages_words.pluginCode, "core"),
        inArray(core_languages_words.itemId, ids),
      ),
    );

  const result = new Map<number, ResolvedRoleName[]>();
  for (const id of ids) {
    result.set(
      id,
      words
        .filter(word => word.itemId === id)
        .map(word => ({ name: word.value, languageCode: word.languageCode })),
    );
  }

  return result;
};
