import type { EnvVitNode } from "@vitnode/core/api/middlewares/global.middleware";
import type { ContentAccessFlags } from "@vitnode/core/content";
import type { ContentPublicHiddenAccess } from "@vitnode/core/content/server";
import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { setPageCacheTags } from "@vitnode/core/api/lib/page-cache";
import {
  CONTENT_LOCALE_MAX_LENGTH,
  contentAccessTag,
  contentLocalesMatch,
  zodContentAccessFlags,
} from "@vitnode/core/content";
import {
  contentAccessFlagsForScopes,
  contentListHiddenAccess,
  contentListPageCacheTags,
  contentLocaleHeaders,
  createContentAccess,
  findContentAccessFamily,
  isContentAccessFamilyOpen,
  listContentLanguages,
  rememberContentPublicRead,
  resolveContentRequestLocale,
} from "@vitnode/core/content/server";
import { and, asc, count, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { buildModule, buildRoute } from "@/api/builders";
import { publicPostConditionIn } from "@/api/lib/public-posts";
import { blog_categories, categoryContent } from "@/database/categories";
import {
  blog_posts,
  blog_posts_category_id,
  postContent,
} from "@/database/posts";
import { manifest } from "@/manifest.gen";

const { definition } = categoryContent;

/** One category as readers see it: never its translations, never its timestamps. */
export const zodBlogCategorySummary = z.object({
  /** What the viewer may do in the category, as its access rules decide. */
  access: zodContentAccessFlags,
  articleCount: z.number().int(),
  color: z.string().nullable(),
  id: z.number(),
  /** In the requested locale, or the default locale's when it has none. */
  name: z.string(),
  slug: z.string(),
  slugs: z.record(z.string(), z.string()),
});

type LocalizedBlogCategory = Omit<
  z.infer<typeof zodBlogCategorySummary>,
  "access" | "articleCount"
>;

interface BlogArticleCounts {
  byCategory: Record<number, number>;
  total: number;
}

const readCategorySummaries = async (
  c: Context<EnvVitNode>,
  locale: string | undefined,
): Promise<LocalizedBlogCategory[]> => {
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
  const languages = (await listContentLanguages(c))
    .filter(language => language.isEnabled)
    .map(language => language.locale);
  const valueIn = (id: number, wanted: string) =>
    translations.find(
      translation =>
        translation.itemId === id &&
        contentLocalesMatch(translation.locale, wanted),
    )?.values;
  // The content type's own fallback rule, the one its articles follow too.
  const resolve = (id: number, wanted: string) =>
    valueIn(id, wanted) ??
    (fallback === "default" ? valueIn(id, defaultLocale) : undefined);

  const collator = new Intl.Collator(locale ?? defaultLocale);

  return rows
    .flatMap(({ color, id }) => {
      const values = resolve(id, locale ?? defaultLocale);
      if (!values?.name || !values.friendlyUrl) return [];

      const slugs = Object.fromEntries(
        languages.flatMap(language => {
          const slug = resolve(id, language)?.friendlyUrl;

          return slug ? [[language, slug]] : [];
        }),
      );

      return [
        { color, id, name: values.name, slug: values.friendlyUrl, slugs },
      ];
    })
    .sort((a, b) => collator.compare(a.name, b.name));
};

const readArticleCounts = async (
  c: Context<EnvVitNode>,
  locale: string | undefined,
  hidden?: ContentPublicHiddenAccess,
): Promise<BlogArticleCounts> => {
  const published = await publicPostConditionIn(c, locale, hidden);
  if (published === null) return { byCategory: {}, total: 0 };
  // Only articles this viewer may read are counted: a restricted category's
  // articles never show up in anybody else's totals.
  const condition = and(
    published,
    await createContentAccess(c).condition(postContent, "read"),
  );

  const db = c.get("db");
  const [rows, [totals]] = await Promise.all([
    db
      .select({
        categoryId: blog_posts_category_id.relatedItemId,
        value: count(),
      })
      .from(blog_posts_category_id)
      .innerJoin(blog_posts, eq(blog_posts_category_id.itemId, blog_posts.id))
      .where(condition)
      .groupBy(blog_posts_category_id.relatedItemId),
    db.select({ value: count() }).from(blog_posts).where(condition),
  ]);

  return {
    byCategory: Object.fromEntries(
      rows.map(row => [Number(row.categoryId), row.value]),
    ),
    total: totals.value,
  };
};

const categoryFamily = (c: Context<EnvVitNode>) => {
  const family = findContentAccessFamily(c, definition.id);
  if (!family) {
    throw new Error("Blog categories are an access scope family.");
  }

  return family;
};

/** Each category's flags for the viewer, keyed by category id. */
const categoryFlags = async (
  c: Context<EnvVitNode>,
  ids: readonly number[],
): Promise<Map<number, ContentAccessFlags>> => {
  const family = categoryFamily(c);
  const entries = await Promise.all(
    ids.map(async id => {
      const { denied: _denied, ...flags } = await contentAccessFlagsForScopes(
        c,
        { scopes: [{ family: family.id, scopeId: String(id) }] },
      );

      return [id, flags] as const;
    }),
  );

  return new Map(entries);
};

/**
 * Every blog category with its name in one language, its colour and how many
 * articles readers can open in it, plus the total for "All articles". Public:
 * categories have no draft state, and this is exactly the allowlist - no
 * translation metadata, no timestamps.
 *
 * Names are cached per locale until a category changes, counts until an
 * article changes: each half lives in its own content type's public-read
 * generation, and the response carries both list tags.
 */
const publicCategoriesRoute = buildRoute({
  route: {
    method: "get",
    path: "/",
    description:
      "Every blog category with its name in the requested locale, its colour and its article count",
    request: {
      query: z.object({
        locale: z.string().min(1).max(CONTENT_LOCALE_MAX_LENGTH).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              items: z.array(zodBlogCategorySummary),
              total: z.number().int(),
            }),
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

    const key = {
      locale: resolved.locale ?? null,
      source: resolved.source,
    };
    const hidden = await contentListHiddenAccess(c, {
      model: postContent,
      pluginId: manifest.id,
    });
    const access = createContentAccess(c);
    // Shared only when no access rule of a category or an article can change
    // the answer; otherwise it is this viewer's own.
    const shareable =
      !hidden &&
      (await access.isOpen(postContent)) &&
      (await isContentAccessFamilyOpen(c, categoryFamily(c)));
    const [names, counts] = await Promise.all([
      rememberContentPublicRead(c, {
        contentTypeId: definition.id,
        key: { ...key, route: "@vitnode/blog:category-summaries" },
        load: async () => await readCategorySummaries(c, resolved.locale),
      }),
      !shareable
        ? readArticleCounts(c, resolved.locale, hidden)
        : rememberContentPublicRead(c, {
            contentTypeId: postContent.definition.id,
            key: { ...key, route: "@vitnode/blog:category-counts" },
            load: async () => await readArticleCounts(c, resolved.locale),
          }),
    ]);

    if (shareable) {
      setPageCacheTags(c, [
        ...contentListPageCacheTags(definition),
        ...contentListPageCacheTags(postContent.definition),
        contentAccessTag(definition.id),
      ]);
    }

    // A category the viewer may not see is left out, name and all.
    const flags = await categoryFlags(
      c,
      names.map(category => category.id),
    );
    const items = names.flatMap(category => {
      const categoryAccess = flags.get(category.id);
      if (!categoryAccess?.canView) return [];

      return [
        {
          ...category,
          access: categoryAccess,
          articleCount: categoryAccess.canRead
            ? (counts.byCategory[category.id] ?? 0)
            : 0,
        },
      ];
    });

    return c.json(
      { items, total: counts.total },
      200,
      shareable
        ? contentLocaleHeaders(resolved)
        : {
            "Cache-Control": "private, no-store",
            ...contentLocaleHeaders(resolved),
          },
    );
  },
});

/** `GET /api/@vitnode/blog/categories` - the public category summaries. */
export const categoriesModule = buildModule({
  name: "categories",
  routes: [publicCategoriesRoute],
});
