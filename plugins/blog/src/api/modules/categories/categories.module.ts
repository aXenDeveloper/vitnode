import type { EnvVitNode } from "@vitnode/core/api/middlewares/global.middleware";
import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { setPageCacheTags } from "@vitnode/core/api/lib/page-cache";
import {
  CONTENT_LOCALE_MAX_LENGTH,
  contentLocalesMatch,
} from "@vitnode/core/content";
import {
  contentListPageCacheTags,
  contentLocaleHeaders,
  rememberContentPublicRead,
  resolveContentRequestLocale,
} from "@vitnode/core/content/server";
import { asc } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { buildModule, buildRoute } from "@/api/builders";
import { blog_categories, categoryContent } from "@/database/categories";

const { definition } = categoryContent;

/** One category as readers see it: never its translations, never its timestamps. */
export const zodBlogCategorySummary = z.object({
  color: z.string().nullable(),
  id: z.number(),
  /** In the requested locale, or the default locale's when it has none. */
  name: z.string(),
});

type BlogCategorySummary = z.infer<typeof zodBlogCategorySummary>;

const readCategorySummaries = async (
  c: Context<EnvVitNode>,
  locale: string | undefined,
): Promise<BlogCategorySummary[]> => {
  const rows = await c
    .get("db")
    .select({ color: blog_categories.color, id: blog_categories.id })
    .from(blog_categories)
    .orderBy(asc(blog_categories.id));

  // One query for every translation of every category, not one per category.
  const translations =
    (await categoryContent
      .translationService?.(c)
      .findManyRowsForItems(rows.map(row => row.id))) ?? [];

  const { defaultLocale, fallback } = definition.localization;
  const nameIn = (id: number, wanted: string | undefined) =>
    wanted === undefined
      ? undefined
      : translations.find(
          translation =>
            translation.itemId === id &&
            contentLocalesMatch(translation.locale, wanted),
        )?.values.name;

  const collator = new Intl.Collator(locale ?? defaultLocale);

  return rows
    .flatMap(({ color, id }) => {
      // The content type's own fallback rule, the one its articles follow too.
      const name =
        nameIn(id, locale ?? defaultLocale) ??
        (fallback === "default" ? nameIn(id, defaultLocale) : undefined);

      return name ? [{ color, id, name }] : [];
    })
    .sort((a, b) => collator.compare(a.name, b.name));
};

/**
 * Every blog category with its name in one language and its colour, for
 * filters and article labels. Public: categories have no draft state, and this
 * is exactly the allowlist - no translation metadata, no timestamps.
 *
 * Cached per locale until a category changes: every category write moves the
 * Content Engine's public-read generation for `blog.category` and expires the
 * pages tagged with its list tag.
 */
const publicCategoriesRoute = buildRoute({
  route: {
    method: "get",
    path: "/",
    description:
      "Every blog category with its name in the requested locale and its colour",
    request: {
      query: z.object({
        locale: z.string().min(1).max(CONTENT_LOCALE_MAX_LENGTH).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ items: z.array(zodBlogCategorySummary) }),
          },
        },
        description: "Every category, ordered by name",
      },
      404: { description: "The requested locale is not served" },
    },
  },
  handler: async c => {
    const resolved = await resolveContentRequestLocale(c, definition);
    if (!resolved) {
      throw new HTTPException(404, { message: "Locale not found." });
    }

    const items = await rememberContentPublicRead(c, {
      contentTypeId: definition.id,
      key: {
        locale: resolved.locale ?? null,
        route: "@vitnode/blog:category-summaries",
        source: resolved.source,
      },
      load: async () => await readCategorySummaries(c, resolved.locale),
    });

    setPageCacheTags(c, contentListPageCacheTags(definition));

    return c.json({ items }, 200, contentLocaleHeaders(resolved));
  },
});

/** `GET /api/@vitnode/blog/categories` - the public category summaries. */
export const categoriesModule = buildModule({
  name: "categories",
  routes: [publicCategoriesRoute],
});
