import { defineContentType } from "@vitnode/api/content/define";
import { field } from "@vitnode/api/content/fields";
import { describe, expect, it } from "vitest";

import type { ContentUrlSource } from "../plugin-routes/content-urls.js";

import { contentSitemapSourcesFrom, SitemapSourcesError } from "./generate.js";

const contentType = ({
  delivery = true,
  id,
  localized = false,
  publicPath,
  sitemap = true,
}: {
  delivery?: boolean;
  id: string;
  localized?: boolean;
  publicPath?: string;
  sitemap?: boolean;
}) =>
  defineContentType({
    id,
    tableName: id.replace(/\W/g, "_"),
    ...(localized
      ? { localization: { defaultLocale: "en", fallback: "default" } }
      : {}),
    fields: {
      title: field.text({ localized, required: true, maxLength: 200 }),
      slug: field.slug({ localized, source: "title" }),
    },
    publication: true,
    ...(publicPath === undefined
      ? {}
      : {
          publicApi: {
            path: publicPath,
            fields: ["id", "title", "slug", "publishedAt"],
            defaultOrderBy: "publishedAt",
          },
        }),
    ...(delivery ? { delivery: { sitemap } } : {}),
  });

const plugin = (
  pluginId: string,
  ...contentTypes: ReturnType<typeof contentType>[]
): ContentUrlSource => ({ contentTypes, pluginId });

describe("contentSitemapSourcesFrom", () => {
  it("lists only types with a public API, delivery and delivery.sitemap", () => {
    const sources = contentSitemapSourcesFrom({
      contentUrls: [
        plugin(
          "@vitnode/blog",
          contentType({ id: "blog.post", publicPath: "blog" }),
          contentType({
            id: "blog.draft",
            sitemap: false,
            publicPath: "drafts",
          }),
          contentType({
            delivery: false,
            id: "blog.note",
            publicPath: "notes",
          }),
          contentType({ delivery: false, id: "blog.private" }),
        ),
      ],
      locales: ["en"],
    });

    expect(sources).toEqual([
      {
        contentTypeId: "blog.post",
        file: "blog",
        localized: false,
        module: "content/blog",
        path: "/delivery/sitemap",
        pluginId: "@vitnode/blog",
      },
    ]);
  });

  it("names the file after the public path and marks localized types", () => {
    const [source] = contentSitemapSourcesFrom({
      contentUrls: [
        plugin(
          "@vitnode/docs",
          contentType({
            id: "docs.page",
            localized: true,
            publicPath: "docs-pages",
          }),
        ),
      ],
      locales: ["en", "pl"],
    });

    expect(source).toMatchObject({
      file: "docs-pages",
      localized: true,
      module: "content/docs-pages",
    });
  });

  it("prefixes the plugin when two plugins share a public path", () => {
    const sources = contentSitemapSourcesFrom({
      contentUrls: [
        plugin(
          "@acme/news",
          contentType({ id: "news.post", publicPath: "posts" }),
        ),
        plugin(
          "@vitnode/blog",
          contentType({ id: "blog.post", publicPath: "posts" }),
        ),
        plugin(
          "@vitnode/wiki",
          contentType({ id: "wiki.page", publicPath: "wiki" }),
        ),
      ],
      locales: ["en"],
    });

    expect(sources.map(source => source.file)).toEqual([
      "acme-news-posts",
      "vitnode-blog-posts",
      "wiki",
    ]);
  });

  it("prefixes the plugin for a reserved file name", () => {
    const [source] = contentSitemapSourcesFrom({
      contentUrls: [
        plugin(
          "@vitnode/cms",
          contentType({ id: "cms.page", publicPath: "pages" }),
        ),
      ],
      locales: ["en"],
    });

    expect(source.file).toBe("vitnode-cms-pages");
  });

  it("throws when a locale file would collide with another type's file", () => {
    expect(() =>
      contentSitemapSourcesFrom({
        contentUrls: [
          plugin(
            "@vitnode/blog",
            contentType({ id: "blog.post", localized: true, publicPath: "x" }),
            contentType({ id: "blog.polish", publicPath: "x-pl" }),
          ),
        ],
        locales: ["en", "pl"],
      }),
    ).toThrow(SitemapSourcesError);
  });

  it("sorts by plugin and content type, whatever the input order", () => {
    const blog = plugin(
      "@vitnode/blog",
      contentType({ id: "blog.z", publicPath: "z" }),
      contentType({ id: "blog.a", publicPath: "a" }),
    );
    const docs = plugin(
      "@vitnode/docs",
      contentType({ id: "docs.page", publicPath: "docs" }),
    );

    const ids = (contentUrls: ContentUrlSource[]) =>
      contentSitemapSourcesFrom({ contentUrls, locales: ["en"] }).map(
        source => source.contentTypeId,
      );

    expect(ids([docs, blog])).toEqual(["blog.a", "blog.z", "docs.page"]);
    expect(ids([blog, docs])).toEqual(ids([docs, blog]));
  });
});
