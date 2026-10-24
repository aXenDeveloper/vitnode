import type { MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ResolvedOgImagesConfig } from "../../og-image/server/config";
import type { OgImageTemplateInput } from "../../og-image/server/types";

import { core_languages } from "../../database/languages";
import { ogImageLocalCache } from "../../og-image/server/cache";
import { resolveOgImagesConfig } from "../../og-image/server/config";
import { defaultOgImageTemplate } from "../../og-image/server/default-template";
import { defineContentType } from "../define";
import { field } from "../fields";
import { createContentModel } from "./model";
import { buildContentPublicRoutes } from "./public-routes";

const PLUGIN_ID = "@vitnode/example";

const articles = createContentModel(
  defineContentType({
    id: "test.og-article",
    delivery: {
      seo: {
        descriptionField: "excerpt",
        openGraph: { image: true, titleField: "title" },
        titleField: "title",
      },
    },
    fields: {
      excerpt: field.textarea({ localized: true, nullable: true }),
      slug: field.slug({ localized: true, source: "title" }),
      title: field.text({ localized: true, required: true }),
    },
    localization: { defaultLocale: "en", fallback: "default" },
    publication: true,
    publicApi: {
      fields: ["id", "title", "slug", "excerpt"],
      path: "og-articles",
    },
    tableName: "test_og_articles",
  }),
);

const LANGUAGE_ROWS = [
  { code: "en", id: 1, isDefault: true },
  { code: "pl", id: 2, isDefault: false },
];

const languageDatabase = {
  select: () => ({
    from: async (table: unknown) => {
      if (table !== core_languages) {
        throw new Error("Only core_languages is read directly by this route.");
      }

      return await Promise.resolve(LANGUAGE_ROWS);
    },
  }),
};

/** The English row a Polish request falls back to. */
const ENGLISH_ROW = {
  excerpt: "Prose",
  id: 42,
  locale: "en",
  slug: "hello-world",
  title: "Hello world",
};

const harness = ({ ogImages = "on" }: { ogImages?: "off" | "on" } = {}) => {
  const rendered: OgImageTemplateInput[] = [];
  const config: null | ResolvedOgImagesConfig =
    ogImages === "on"
      ? resolveOgImagesConfig(
          {
            templates: {
              default: {
                render: input => {
                  rendered.push(input);

                  return defaultOgImageTemplate(input);
                },
                version: "1",
              },
            },
          },
          { title: "VitNode" },
        )
      : null;

  const publicRead = {
    findById: vi.fn(),
    findBySlug: vi.fn(),
    findMany: vi.fn(),
  };
  vi.spyOn(articles, "publicService", "get").mockReturnValue(() => publicRead);

  const app = new OpenAPIHono();
  const context: MiddlewareHandler = async (c, next) => {
    c.set("core", {
      i18n: {
        defaultLocale: "en",
        locales: [
          { code: "en", name: "English" },
          { code: "pl", name: "Polski" },
        ],
      },
      ogImages: config,
    } as never);
    c.set("db", languageDatabase as never);
    await next();
  };
  app.use("*", context);
  for (const { handler, route } of buildContentPublicRoutes(articles, {
    pluginId: PLUGIN_ID,
  })) {
    app.openapi(route, handler);
  }

  return { app, publicRead, rendered };
};

beforeEach(() => {
  ogImageLocalCache.clear();
});

describe("GET /delivery/og-image/{id}", () => {
  it("serves a public record's card to anyone, cacheable for five minutes", async () => {
    const { app, publicRead } = harness();
    publicRead.findById.mockResolvedValue(ENGLISH_ROW);

    const response = await app.request("/delivery/og-image/42");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(response.headers.get("ETag")).toMatch(/^"og-/);
  });

  it("answers 304 to a client that already holds the card", async () => {
    const { app, publicRead } = harness();
    publicRead.findById.mockResolvedValue(ENGLISH_ROW);

    const first = await app.request("/delivery/og-image/42");
    const etag = first.headers.get("ETag") ?? "";
    const second = await app.request("/delivery/og-image/42", {
      headers: { "If-None-Match": etag },
    });

    expect(second.status).toBe(304);
    expect(second.headers.get("ETag")).toBe(etag);
  });

  it("renders in the language actually served, not the one requested", async () => {
    const { app, publicRead, rendered } = harness();
    publicRead.findById.mockResolvedValue(ENGLISH_ROW);

    const response = await app.request("/delivery/og-image/42?locale=pl");

    expect(response.status).toBe(200);
    expect(publicRead.findById).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ locale: "pl" }),
    );
    expect(rendered.map(input => input.locale)).toStrictEqual(["en"]);
  });

  it("refuses a card that was served and cached once the record stops being public", async () => {
    const { app, publicRead } = harness();
    publicRead.findById.mockResolvedValueOnce(ENGLISH_ROW);
    expect((await app.request("/delivery/og-image/42")).status).toBe(200);

    publicRead.findById.mockResolvedValueOnce(null);
    const response = await app.request("/delivery/og-image/42");

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("is a 404 while the install has Open Graph images off", async () => {
    const { app, publicRead } = harness({ ogImages: "off" });
    publicRead.findById.mockResolvedValue(ENGLISH_ROW);

    const response = await app.request("/delivery/og-image/42");

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(publicRead.findById).not.toHaveBeenCalled();
  });
});
