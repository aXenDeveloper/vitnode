import type { EnvVitNode } from "@vitnode/core/api/middlewares/global.middleware";
import type { Context } from "hono";

import { buildEventListener } from "@vitnode/core/api/lib/events";
import {
  buildNotificationSubject,
  buildNotificationType,
} from "@vitnode/core/api/lib/notifications/registry";
import { contentEventName } from "@vitnode/core/content";
import { core_languages } from "@vitnode/core/database/languages";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { blogPostContentType } from "@/content/post";
import {
  blog_categories,
  blog_categories_translations,
} from "@/database/categories";
import {
  blog_posts_category_id,
  blog_posts_translations,
} from "@/database/posts";

/** A blog category readers can follow to hear about new articles in it. */
export const BLOG_CATEGORY_SUBJECT = "blog.category";

// Both content types are localized, so their translation tables always exist;
// the model types them as optional because a type without localization has none.
const requireTable = <T>(table: null | T, name: string): T => {
  if (!table) throw new Error(`[Blog] The ${name} table is missing.`);

  return table;
};
const postTranslations = requireTable(
  blog_posts_translations,
  "blog_posts_translations",
);
const categoryTranslations = requireTable(
  blog_categories_translations,
  "blog_categories_translations",
);

const isPublished = async (
  c: Context<EnvVitNode>,
  postId: number,
): Promise<boolean> => {
  const [row] = await c
    .get("db")
    .select({ itemId: postTranslations.itemId })
    .from(postTranslations)
    .where(
      and(
        eq(postTranslations.itemId, postId),
        eq(postTranslations.status, "published"),
      ),
    )
    .limit(1);

  return !!row;
};

/**
 * "New article in a category you follow". The audience is whoever follows any
 * of the article's categories - core streams that list itself, so a category
 * with ten thousand followers costs this listener one query.
 */
export const postPublishedNotification = buildNotificationType({
  id: "blog.post_published",
  version: 1,
  schema: z.object({
    postId: z.number().int().positive(),
    slug: z.string().min(1).max(255),
    title: z.string().min(1).max(255),
  }),
  category: "content",
  label: "@vitnode/blog.notifications.post_published.label",
  description: "@vitnode/blog.notifications.post_published.description",
  subjectType: "blog.post",
  defaults: { email: "daily", inApp: true },
  email: true,
  // Every recipient shares one answer: an article is public once published.
  // Unpublished or deleted since? Then nobody sees it - in the inbox it turns
  // into the "no longer available" placeholder, and no email goes out.
  access: async ({ c, data, userIds }) =>
    (await isPublished(c, data.postId)) ? userIds : [],
  present: ({ data, t }) => ({
    body: t("@vitnode/blog.notifications.post_published.body"),
    target: `/blog/${encodeURIComponent(data.slug)}`,
    title: t("@vitnode/blog.notifications.post_published.title", {
      title: data.title,
    }),
  }),
});

export const blogCategorySubject = buildNotificationSubject({
  type: BLOG_CATEGORY_SUBJECT,
  canFollow: async ({ c, id }) => {
    const categoryId = Number(id);
    if (!Number.isSafeInteger(categoryId)) return false;

    const [row] = await c
      .get("db")
      .select({ id: blog_categories.id })
      .from(blog_categories)
      .where(eq(blog_categories.id, categoryId))
      .limit(1);

    return !!row;
  },
  resolveLabels: async ({ c, ids, locale }) => {
    const categoryIds = ids.map(Number).filter(Number.isSafeInteger);
    if (categoryIds.length === 0) return {};

    const rows = await c
      .get("db")
      .select({
        code: core_languages.code,
        id: categoryTranslations.itemId,
        name: categoryTranslations.name,
      })
      .from(categoryTranslations)
      .innerJoin(
        core_languages,
        eq(core_languages.id, categoryTranslations.languageId),
      )
      .where(inArray(categoryTranslations.itemId, categoryIds));

    const labels: Record<string, string> = {};
    for (const row of rows) {
      // The reader's language wins; any other translation is a fallback.
      if (row.code === locale || !(String(row.id) in labels)) {
        labels[String(row.id)] = row.name;
      }
    }

    return labels;
  },
});

/** The article's title and slug in its default language, falling back to any. */
const loadPostSummary = async (c: Context<EnvVitNode>, postId: number) => {
  const rows = await c
    .get("db")
    .select({
      code: core_languages.code,
      slug: postTranslations.friendlyUrl,
      title: postTranslations.title,
    })
    .from(postTranslations)
    .innerJoin(
      core_languages,
      eq(core_languages.id, postTranslations.languageId),
    )
    .where(eq(postTranslations.itemId, postId));

  return (
    rows.find(
      row => row.code === blogPostContentType.localization.defaultLocale,
    ) ?? rows[0]
  );
};

export const notifyCategoryFollowersListener = buildEventListener({
  event: contentEventName(blogPostContentType.id, "published"),
  name: "notify-category-followers",
  description:
    "Tells followers of an article's categories that it was published",
  handler: async (c, payload) => {
    const postId = payload.contentId;
    const [summary, categories] = await Promise.all([
      loadPostSummary(c, postId),
      c
        .get("db")
        .select({ categoryId: blog_posts_category_id.relatedItemId })
        .from(blog_posts_category_id)
        .where(eq(blog_posts_category_id.itemId, postId))
        .orderBy(asc(blog_posts_category_id.position)),
    ]);
    if (!summary || categories.length === 0) return;

    await c.get("notifications").publish({
      type: postPublishedNotification,
      // Whoever pressed publish - or nobody, when a schedule fired it - is
      // left out of their own announcement.
      actorId: payload.scheduledBy ?? c.get("admin")?.user.id ?? null,
      followersOf: categories.map(row => ({
        id: row.categoryId,
        type: BLOG_CATEGORY_SUBJECT,
      })),
      subject: { id: postId, type: "blog.post" },
      data: { postId, slug: summary.slug, title: summary.title },
      // `publishedAt` is the first publication and never changes, so this
      // announces an article once - not again after an unpublish and republish,
      // and not twice when a scheduled publish is retried.
      idempotencyKey: `post-published:${postId}`,
    });
  },
});
