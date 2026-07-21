import type {
  SearchDocument,
  SearchIndexer,
} from "@vitnode/core/api/models/search";
import type { Context } from "hono";

import { core_languages } from "@vitnode/core/database/languages";
import { asc, count, eq } from "drizzle-orm";

import { blog_posts } from "@/database/posts";

import type { PostTranslations } from "./posts-language";

import {
  getDefaultLanguageCode,
  loadPostTranslations,
  resolveLangValue,
} from "./posts-language";

interface BlogPostForSearch {
  authorId: null | number;
  categoryId: number;
  createdAt: Date;
  id: number;
  updatedAt?: Date;
}

const getEnabledLanguageCodes = async (c: Context): Promise<string[]> => {
  const rows = await c
    .get("db")
    .select({ code: core_languages.code })
    .from(core_languages)
    .where(eq(core_languages.enabled, true));

  return rows.map(row => row.code);
};

// One search document per enabled language: each language gets its own
// translation (falling back to the default-language mirror) and its own
// friendly URL, so search and discovery can be scoped to the viewer's locale.
const buildDocumentsForPost = (
  post: BlogPostForSearch,
  languageCodes: string[],
  translations: PostTranslations | undefined,
  defaultLanguageCode: null | string,
): SearchDocument[] => {
  const codes = languageCodes.length > 0 ? languageCodes : [""];

  return codes.map(languageCode => {
    const friendlyUrl = resolveLangValue(
      translations?.friendlyUrl,
      languageCode,
      defaultLanguageCode,
    );

    return {
      itemType: "blog_post",
      itemId: post.id,
      languageCode,
      authorId: post.authorId,
      title: resolveLangValue(
        translations?.title,
        languageCode,
        defaultLanguageCode,
      ),
      content: resolveLangValue(
        translations?.content,
        languageCode,
        defaultLanguageCode,
      ),
      containerType: "blog_category",
      containerId: post.categoryId,
      url: `/blog/${post.categoryId}/${friendlyUrl}`,
      isPublic: true,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  });
};

export const reindexBlogPost = async (
  c: Context,
  post: BlogPostForSearch,
): Promise<void> => {
  const [languageCodes, defaultLanguageCode, translations] = await Promise.all([
    getEnabledLanguageCodes(c),
    getDefaultLanguageCode(c),
    loadPostTranslations(c, [post.id]),
  ]);

  // Drop every language row first so translations removed since the last index
  // don't linger.
  await c.get("search").delete("blog_post", post.id);
  await c
    .get("search")
    .bulkIndex(
      buildDocumentsForPost(
        post,
        languageCodes,
        translations.get(post.id),
        defaultLanguageCode,
      ),
    );
};

export const blogPostSearchIndexer: SearchIndexer = {
  itemType: "blog_post",
  count: async c => {
    const [row] = await c.get("db").select({ value: count() }).from(blog_posts);

    return row?.value ?? 0;
  },
  load: async (c, offset, limit) => {
    const rows = await c
      .get("db")
      .select({
        id: blog_posts.id,
        categoryId: blog_posts.categoryId,
        authorId: blog_posts.authorId,
        createdAt: blog_posts.createdAt,
        updatedAt: blog_posts.updatedAt,
      })
      .from(blog_posts)
      .orderBy(asc(blog_posts.id))
      .limit(limit)
      .offset(offset);

    if (rows.length === 0) {
      return [];
    }

    const [languageCodes, defaultLanguageCode, translations] =
      await Promise.all([
        getEnabledLanguageCodes(c),
        getDefaultLanguageCode(c),
        loadPostTranslations(
          c,
          rows.map(row => row.id),
        ),
      ]);

    return rows.flatMap(post =>
      buildDocumentsForPost(
        post,
        languageCodes,
        translations.get(post.id),
        defaultLanguageCode,
      ),
    );
  },
};
