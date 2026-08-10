"use server";

import { contentApiFetch } from "@vitnode/core/content/admin/fetch.server";
import { z } from "zod";

import { CONFIG_PLUGIN } from "@/const";
import { blogCategoryContentType } from "@/content/category";

const zodCategories = z.object({
  edges: z.array(
    z
      .object({
        id: z.number(),
        translation: z.object({ title: z.string() }).nullable().optional(),
      })
      .loose(),
  ),
});

/**
 * Categories, named in the language the editor is working in.
 *
 * The Content Engine resolves a relation picker's labels from the target's
 * `admin.titleField`, which has to be a **shared** column - and every text field
 * on a blog category is localized, so there is no shared column that could
 * honestly be its name. The generic picker therefore falls back to identifiers,
 * and `#3` is not a category anybody recognises.
 *
 * So the label - and only the label - is resolved here, from the generated admin
 * list route the engine already publishes: `?locale=` makes it return each row's
 * translation in that language. The relation itself is entirely the engine's: a
 * real foreign key, a real `onDelete: "restrict"`, validated by the generated
 * create and update schemas. What the combobox stores is the identifier the API
 * takes, exactly as the generated picker would have stored it.
 *
 * The route is gated by the category's own `can_view`, so this exposes nothing a
 * relation picker did not already show.
 */
export const loadBlogCategoryOptions = async (
  locale: string,
): Promise<{ label: string; value: string }[]> => {
  const result = await contentApiFetch({
    definition: blogCategoryContentType,
    method: "get",
    pluginId: CONFIG_PLUGIN.pluginId,
    query: { first: "100", locale },
    schema: zodCategories,
  });

  return (result.data?.edges ?? []).map(edge => ({
    // A category with no translation in this language is still selectable -
    // hiding it would make an article unassignable for the wrong reason.
    label: edge.translation?.title ?? `#${edge.id}`,
    value: edge.id.toString(),
  }));
};
