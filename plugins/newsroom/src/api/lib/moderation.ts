import { defineModerationScope } from "@vitnode/core/api/moderation";
import { and, asc, gt, ilike, inArray } from "drizzle-orm";

import { newsroom_categories } from "@/database/categories";

export const categoryModerationScope = defineModerationScope({
  id: "newsroom.category",
  label: "newsroom.moderation.category.label",
  description: "newsroom.moderation.category.desc",
  list: async (c, { cursor, limit, search }) => {
    const rows = await c
      .get("db")
      .select({ id: newsroom_categories.id, name: newsroom_categories.name })
      .from(newsroom_categories)
      .where(
        and(
          cursor ? gt(newsroom_categories.id, Number(cursor)) : undefined,
          search ? ilike(newsroom_categories.name, `%${search}%`) : undefined,
        ),
      )
      .orderBy(asc(newsroom_categories.id))
      .limit(limit + 1);

    const page = rows.slice(0, limit);

    return {
      items: page.map(row => ({ id: String(row.id), label: row.name })),
      nextCursor: rows.length > limit ? String(page.at(-1)?.id) : null,
    };
  },
  find: async (c, ids) => {
    const numeric = ids.map(Number).filter(id => Number.isSafeInteger(id));
    if (numeric.length === 0) return [];

    const rows = await c
      .get("db")
      .select({ id: newsroom_categories.id, name: newsroom_categories.name })
      .from(newsroom_categories)
      .where(inArray(newsroom_categories.id, numeric));

    return rows.map(row => ({ id: String(row.id), label: row.name }));
  },
});
