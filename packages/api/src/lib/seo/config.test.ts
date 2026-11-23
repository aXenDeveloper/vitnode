import type { Context } from "hono";

import { describe, expect, it } from "vitest";

import { createLocaleRouting } from "@/lib/i18n/locale-routing";

import type { SitemapSource } from "./sitemap";

import { resolveSeoConfig } from "./config";
import { DEFAULT_ROBOTS_DISALLOW } from "./robots";

const source = (id: string): SitemapSource => ({
  count: async () => await Promise.resolve(0),
  getEntries: async () => await Promise.resolve([]),
  id,
  label: id,
});

const c = {
  get: (key: string) =>
    key === "core"
      ? {
          i18n: {
            localeRouting: createLocaleRouting({
              defaultLocale: "en",
              locales: ["en"],
            }),
          },
        }
      : undefined,
} as unknown as Context;

describe("resolveSeoConfig", () => {
  it("orders sources static, content types, plugins, then the app", () => {
    const { sitemapSources } = resolveSeoConfig({
      config: { sitemap: { sources: [source("app")] } },
      contentSources: [source("blog_post")],
      plugins: [
        { pluginId: "a", sitemap: { sources: [source("plugin_a")] } },
        { pluginId: "b" },
      ],
    });

    expect(sitemapSources.map(entry => entry.id)).toStrictEqual([
      "static",
      "blog_post",
      "plugin_a",
      "app",
    ]);
  });

  it.each([
    [
      "a plugin reuses the static id",
      {
        plugins: [{ pluginId: "a", sitemap: { sources: [source("static")] } }],
      },
      'share the id "static"',
    ],
    [
      "the app reuses a content type's id",
      {
        config: { sitemap: { sources: [source("blog_post")] } },
        contentSources: [source("blog_post")],
      },
      'share the id "blog_post"',
    ],
    [
      "an id is invalid",
      { config: { sitemap: { sources: [source("Bad.Id")] } } },
      "Invalid sitemap source id",
    ],
  ])("throws when %s", (_, args, message) => {
    expect(() =>
      resolveSeoConfig({ contentSources: [], plugins: [], ...args }),
    ).toThrow(message);
  });

  it("lists `/` and every contributed path once, the later definition winning", async () => {
    const { sitemapSources } = resolveSeoConfig({
      config: {
        sitemap: { paths: [{ path: "/blog", priority: 0.9 }, "/"] },
      },
      contentSources: [],
      plugins: [{ pluginId: "a", sitemap: { paths: ["/blog", "/forum"] } }],
    });

    expect(
      await sitemapSources[0].getEntries(c, { limit: 10, offset: 0 }),
    ).toStrictEqual([
      { changeFrequency: null, loc: "/", priority: null },
      { changeFrequency: null, loc: "/blog", priority: 0.9 },
      { changeFrequency: null, loc: "/forum", priority: null },
    ]);
  });

  it("adds the app's disallowed paths to core's, once each", () => {
    expect(
      resolveSeoConfig({
        config: { robots: { disallow: ["/admin", "/drafts"] } },
        contentSources: [],
        plugins: [],
      }).robotsDisallow,
    ).toStrictEqual([...DEFAULT_ROBOTS_DISALLOW, "/drafts"]);
  });
});
