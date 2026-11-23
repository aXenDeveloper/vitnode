import type { Context } from "hono";

import { beforeAll, describe, expect, it } from "vitest";

import { defineContentType } from "@/content/define";
import { field } from "@/content/fields";
import { createContentModel } from "@/content/server/model";
import { core_content_slug_history } from "@/database/content";
import { core_languages } from "@/database/languages";
import {
  ACCESS_PLUGIN_ID,
  BOARD,
  createAccessWorld,
  testAccessBoards,
} from "@/tests/content-access";
import { testContentLocaleRouting } from "@/tests/content-fixtures";

import { contentSitemapSource } from "./sitemap-source";

const sitemapPostType = defineContentType({
  id: "test.sitemap-post",
  tableName: "test_sitemap_posts",
  publication: true,
  visibility: true,
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    slug: field.slug({ source: "title" }),
    noIndex: field.boolean({ nullable: true }),
    board: field.container({ definition: testAccessBoards, required: true }),
  },
  publicApi: {
    path: "sitemap-posts",
    fields: ["id", "title", "slug", "noIndex"],
  },
  delivery: {
    seo: { noIndexField: "noIndex", titleField: "title" },
    sitemap: { changeFrequency: "weekly", priority: 0.6 },
  },
});

const sitemapPageType = defineContentType({
  id: "test.sitemap-page",
  tableName: "test_sitemap_pages",
  localization: { defaultLocale: "en", fallback: "default" },
  publication: true,
  fields: {
    title: field.text({ localized: true, required: true, maxLength: 200 }),
    slug: field.slug({ localized: true, source: "title" }),
  },
  publicApi: { path: "sitemap-pages", fields: ["id", "title", "slug"] },
  delivery: { hreflang: { xDefault: "defaultLocale" }, sitemap: true },
});

const posts = createContentModel(sitemapPostType);
const pages = createContentModel(sitemapPageType);

const LIVE = new Date("2026-01-01T00:00:00.000Z");
const LATER = new Date("2026-02-01T00:00:00.000Z");
const FUTURE = new Date("2999-01-01T00:00:00.000Z");
const LANGUAGE = { EN: 1, PL: 2 } as const;

const post = (id: number, overrides: Record<string, unknown> = {}) => ({
  board: BOARD.OPEN,
  createdAt: LIVE,
  hiddenAt: null,
  id,
  noIndex: false,
  publishedAt: LIVE,
  slug: `post-${id}`,
  status: "published",
  title: `Post ${id}`,
  updatedAt: LIVE,
  ...overrides,
});

const translation = (
  itemId: number,
  languageId: number,
  overrides: Record<string, unknown> = {},
) => ({
  createdAt: LIVE,
  itemId,
  languageId,
  publishedAt: LIVE,
  slug: `${languageId === LANGUAGE.EN ? "page" : "strona"}-${itemId}`,
  status: "published",
  title: `Page ${itemId}`,
  updatedAt: LIVE,
  ...overrides,
});

let c: Context;

beforeAll(async () => {
  const world = await createAccessWorld();
  const { db } = world.memory;
  await db
    .insert(posts.table)
    .values([
      post(1),
      post(2, { status: "draft" }),
      post(3, { publishedAt: FUTURE }),
      post(4, { hiddenAt: LIVE }),
      post(5, { noIndex: true }),
      post(6, { noIndex: null }),
      post(7, { board: BOARD.MEMBERS }),
      post(8, { slug: "renamed" }),
    ]);
  await db.insert(core_content_slug_history).values({
    contentTypeId: sitemapPostType.id,
    itemId: "8",
    languageId: null,
    path: "/sitemap-posts/post-8",
    pluginId: ACCESS_PLUGIN_ID,
    retiredAt: LIVE,
    slug: "post-8",
  });
  await db.insert(core_languages).values([
    { code: "en", default: true, id: LANGUAGE.EN, name: "English" },
    { code: "pl", default: false, id: LANGUAGE.PL, name: "Polski" },
  ]);
  await db.insert(pages.table).values(
    [10, 11, 12].map(id => ({
      createdAt: LIVE,
      id,
      publishedAt: LIVE,
      status: id === 12 ? "draft" : "published",
      updatedAt: LIVE,
    })),
  );
  if (!pages.translationTable) throw new Error("pages are localized");
  await db
    .insert(pages.translationTable)
    .values([
      translation(10, LANGUAGE.EN),
      translation(10, LANGUAGE.PL, { updatedAt: LATER }),
      translation(11, LANGUAGE.EN),
      translation(11, LANGUAGE.PL, { status: "draft" }),
      translation(12, LANGUAGE.EN),
    ]);

  const values = world.contextValues(null);
  const core = values.core as { contentModels: unknown[] };
  const given: Record<string, unknown> = {
    ...values,
    core: {
      ...core,
      contentModels: [
        ...core.contentModels,
        { model: posts, pluginId: ACCESS_PLUGIN_ID },
        { model: pages, pluginId: ACCESS_PLUGIN_ID },
      ],
      i18n: { localeRouting: testContentLocaleRouting() },
    },
  };
  c = { get: (key: string) => given[key] } as unknown as Context;
});

describe("contentSitemapSource", () => {
  const source = contentSitemapSource({
    model: posts,
    pluginId: ACCESS_PLUGIN_ID,
  });

  it("lists only what a guest may read and may index, at the current slug", async () => {
    expect(await source.count(c)).toBe(3);
    expect(await source.getEntries(c, { limit: 10, offset: 0 })).toStrictEqual(
      ["post-1", "post-6", "renamed"].map(slug => ({
        changeFrequency: "weekly",
        lastModified: LIVE,
        loc: `/sitemap-posts/${slug}`,
        priority: 0.6,
      })),
    );
  });

  it("pages in id order, so page n always holds the same URLs", async () => {
    const locs = async (offset: number) =>
      (await source.getEntries(c, { limit: 2, offset })).map(
        entry => entry.loc,
      );

    expect([...(await locs(0)), ...(await locs(2))]).toStrictEqual([
      "/sitemap-posts/post-1",
      "/sitemap-posts/post-6",
      "/sitemap-posts/renamed",
    ]);
  });
});

describe("contentSitemapSource for a localized type", () => {
  const source = contentSitemapSource({
    model: pages,
    pluginId: ACCESS_PLUGIN_ID,
  });

  it("lists one URL per published translation, each with its languages and x-default", async () => {
    const alternates = [
      { href: "/sitemap-pages/page-10", hreflang: "en" },
      { href: "/pl/sitemap-pages/strona-10", hreflang: "pl" },
      { href: "/sitemap-pages/page-10", hreflang: "x-default" },
    ];
    const entry = { changeFrequency: null, priority: null };

    expect(await source.count(c)).toBe(3);
    expect(await source.getEntries(c, { limit: 10, offset: 0 })).toStrictEqual([
      {
        ...entry,
        alternates,
        lastModified: LIVE,
        loc: "/sitemap-pages/page-10",
      },
      {
        ...entry,
        alternates,
        lastModified: LATER,
        loc: "/pl/sitemap-pages/strona-10",
      },
      { ...entry, lastModified: LIVE, loc: "/sitemap-pages/page-11" },
    ]);
  });
});
