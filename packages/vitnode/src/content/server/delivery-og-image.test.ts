import type { Context, MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTestCache } from "@/tests/cache";
import { testContentLocaleRouting } from "@/tests/content-fixtures";

import type { AnyContentTypeDefinition } from "../types";
import type { ContentModel } from "./model";

import { core_languages } from "../../database/languages";
import { resolveOgImagesConfig } from "../../og-image/config";
import { prepareOgImage } from "../../og-image/render.server";
import { defineContentType } from "../define";
import { field } from "../fields";
import {
  contentOgImageIdentity,
  contentOgImageInput,
} from "./delivery-og-image";
import { createContentModel } from "./model";
import { buildContentPublicRoutes } from "./public-routes";

const PLUGIN_ID = "@vitnode/example";
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

const ogPosts = createContentModel(
  defineContentType({
    id: "test.og-post",
    tableName: "test_og_posts",
    fields: {
      excerpt: field.textarea({ maxLength: 500, nullable: true }),
      slug: field.slug({ source: "title" }),
      title: field.text({ maxLength: 200, required: true }),
    },
    publication: true,
    publicApi: {
      fields: ["id", "title", "slug", "excerpt", "publishedAt"],
      path: "og-posts",
    },
    delivery: {
      seo: { descriptionField: "excerpt", ogImage: true, titleField: "title" },
    },
  }),
);

const ogPages = createContentModel(
  defineContentType({
    id: "test.og-page",
    tableName: "test_og_pages",
    localization: { defaultLocale: "en", fallback: "default" },
    fields: {
      slug: field.slug({ localized: true, source: "title" }),
      title: field.text({ localized: true, maxLength: 200, required: true }),
    },
    publication: true,
    publicApi: { fields: ["id", "title", "slug"], path: "og-pages" },
    delivery: { seo: { ogImage: true, titleField: "title" } },
  }),
);

const routing = testContentLocaleRouting();

const CORE = {
  i18n: {
    localeRouting: routing,
    locales: [
      { code: "en", name: "English" },
      { code: "pl", name: "Polski" },
    ],
  },
  metadata: { title: "VitNode" },
  ogImages: resolveOgImagesConfig({}),
};

const languageDatabase = {
  select: () => ({
    from: async (table: unknown) => {
      if (table !== core_languages) {
        throw new Error("Only core_languages is read directly by this route.");
      }

      return await Promise.resolve([
        { code: "en", id: 1, isDefault: true },
        { code: "pl", id: 2, isDefault: false },
      ]);
    },
  }),
};

const harness = <TDefinition extends AnyContentTypeDefinition>(
  model: ContentModel<TDefinition>,
  core: Record<string, unknown> = CORE,
) => {
  const findById = vi.fn();
  vi.spyOn(model, "publicService", "get").mockReturnValue(() => ({
    findById,
    findBySlug: vi.fn(),
    findMany: vi.fn(),
  }));

  const cache = createTestCache();
  const app = new OpenAPIHono();
  const context: MiddlewareHandler = async (c, next) => {
    c.set("cache", cache);
    c.set("core", core as never);
    c.set("db", languageDatabase as never);
    await next();
  };
  app.use("*", context);
  for (const { handler, route } of buildContentPublicRoutes(model, {
    pluginId: PLUGIN_ID,
  })) {
    app.openapi(route, handler);
  }

  return { app, findById };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("og-image route", () => {
  it("is added only to a type with delivery.seo.ogImage", () => {
    const pathsOf = <TDefinition extends AnyContentTypeDefinition>(
      model: ContentModel<TDefinition>,
    ) =>
      buildContentPublicRoutes(model, { pluginId: PLUGIN_ID }).map(
        entry => entry.route.path,
      );

    expect(pathsOf(ogPosts)).toContain("/delivery/og-image/{id}");
    expect(
      pathsOf(
        createContentModel(
          defineContentType({
            id: "test.og-less",
            tableName: "test_og_less",
            fields: {
              slug: field.slug({ source: "title" }),
              title: field.text({ maxLength: 200, required: true }),
            },
            publication: true,
            publicApi: { fields: ["id", "title", "slug"], path: "og-less" },
            delivery: { seo: { titleField: "title" } },
          }),
        ),
      ),
    ).not.toContain("/delivery/og-image/{id}");
  });

  it("checks public access on every request, cache hit or not", async () => {
    const { app, findById } = harness(ogPosts);
    const row = { excerpt: "Prose", id: 42, slug: "hello", title: "Hello" };

    findById.mockResolvedValueOnce(row);
    const first = await app.request("/delivery/og-image/42?v=abc");
    const etag = first.headers.get("etag") ?? "";

    expect(first.status).toBe(200);
    expect(first.headers.get("content-type")).toBe("image/png");
    expect(first.headers.get("cache-control")).toMatch(/^public/);
    expect(first.headers.get("x-vitnode-og-cache")).toBe("miss");
    expect([
      ...new Uint8Array(await first.arrayBuffer()).subarray(0, 4),
    ]).toStrictEqual(PNG_SIGNATURE);
    expect(findById).toHaveBeenLastCalledWith(42, {
      locale: undefined,
      select: ["id", "slug", "title", "excerpt"],
    });

    // Unpublished, hidden or deleted: the public read finds nothing, and
    // neither the cached bytes nor a matching ETag are served.
    const retries: Record<string, string>[] = [{}, { "If-None-Match": etag }];
    for (const headers of retries) {
      findById.mockResolvedValueOnce(null);
      const gone = await app.request("/delivery/og-image/42?v=abc", {
        headers,
      });

      expect(gone.status).toBe(404);
      expect(gone.headers.get("cache-control")).toBe("private, no-store");
      expect(gone.headers.get("content-type")).not.toBe("image/png");
    }

    // Public again: the image was cached all along.
    findById.mockResolvedValueOnce(row);
    const back = await app.request("/delivery/og-image/42");

    expect(back.status).toBe(200);
    expect(back.headers.get("x-vitnode-og-cache")).toBe("hit");
    expect(findById).toHaveBeenCalledTimes(4);
  });

  it("is a no-store 404 without reading anything when ogImages is off", async () => {
    const { app, findById } = harness(ogPosts, { ...CORE, ogImages: null });

    const response = await app.request("/delivery/og-image/42");

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(findById).not.toHaveBeenCalled();
  });

  it("draws the language the record was served in, not the one asked for", async () => {
    const { app, findById } = harness(ogPages);
    const served = { id: 7, locale: "en", slug: "hello", title: "Hello" };
    findById.mockResolvedValue(served);

    const etagFor = (row: Record<string, unknown>) => {
      const c = {
        get: (key: string) =>
          key === "core"
            ? CORE
            : key === "plugin"
              ? { id: PLUGIN_ID }
              : undefined,
      } as unknown as Context;
      const { definition } = ogPages;
      const { key } = prepareOgImage(
        c,
        contentOgImageInput({ definition, routing, row }),
        { identity: contentOgImageIdentity(definition, 7) },
      );

      return `"og-${key.slice(0, 32)}"`;
    };

    const english = etagFor(served);
    expect(english).not.toBe(etagFor({ ...served, locale: "pl" }));

    const response = await app.request("/delivery/og-image/7?locale=pl", {
      headers: { "If-None-Match": english },
    });

    expect(findById).toHaveBeenCalledWith(7, {
      locale: "pl",
      select: ["id", "slug", "title"],
    });
    expect(response.status).toBe(304);
  });
});

describe("contentOgImageInput", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("draws a fallback row in its own language with its canonical URL", () => {
    vi.stubEnv("VITNODE_WEB_URL", "https://site.example");

    expect(
      contentOgImageInput({
        definition: ogPages.definition,
        routing,
        row: { id: 7, locale: "en", slug: "hello", title: "Hello" },
      }),
    ).toStrictEqual({
      cover: null,
      description: null,
      locale: "en",
      template: null,
      title: "Hello",
      url: "https://site.example/og-pages/hello",
    });
  });

  it("uses the routing's default locale for a type without localization", () => {
    expect(
      contentOgImageInput({
        definition: ogPosts.definition,
        routing: testContentLocaleRouting({ defaultLocale: "pl" }),
        row: { excerpt: "Prose", id: 42, slug: "hello", title: "Hello" },
      }),
    ).toMatchObject({ description: "Prose", locale: "pl", title: "Hello" });
  });
});
