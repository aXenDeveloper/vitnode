import { defineModerationScope } from "@vitnode/core/api/moderation";
import { and, asc, gt, ilike, inArray } from "drizzle-orm";

import { example_categories } from "@/database/categories";

export const exampleCategoryScope = defineModerationScope({
  id: "example.category",
  label: "@vitnode/example.moderation.category.label",
  description: "@vitnode/example.moderation.category.desc",
  list: async (c, { cursor, limit, search }) => {
    const rows = await c
      .get("db")
      .select({ id: example_categories.id, name: example_categories.name })
      .from(example_categories)
      .where(
        and(
          cursor ? gt(example_categories.id, Number(cursor)) : undefined,
          search ? ilike(example_categories.name, `%${search}%`) : undefined,
        ),
      )
      .orderBy(asc(example_categories.id))
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
      .select({ id: example_categories.id, name: example_categories.name })
      .from(example_categories)
      .where(inArray(example_categories.id, numeric));

    return rows.map(row => ({ id: String(row.id), label: row.name }));
  },
});
