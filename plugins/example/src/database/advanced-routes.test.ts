// @vitest-environment node
import type { Context, MiddlewareHandler } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import {
  buildContentPublicRoutes,
  buildContentRoutes,
} from "@vitnode/core/content/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { CONFIG_PLUGIN } from "@/const";

import { advancedArticleContent } from "./advanced-articles";

/**
 * The generated routes for a content type with every advanced shape on it.
 *
 * Registration is the assertion: `OpenAPIHono` walks each route's request and
 * response schemas and converts them to JSON Schema when it mounts them, so a
 * nested group or a repeatable array that Zod could not describe would throw
 * here rather than at the first request. The form schema is checked the same
 * way, because `AutoForm` runs `z.toJSONSchema` on it in the browser - and Zod
 * v4 throws on a `z.date()` anywhere inside.
 */
describe("advanced article: generated routes", () => {
  const mount = (
    routes: readonly {
      handler: Parameters<OpenAPIHono["openapi"]>[1];
      route: Parameters<OpenAPIHono["openapi"]>[0];
    }[],
  ): OpenAPIHono => {
    const app = new OpenAPIHono();
    const context: MiddlewareHandler = async (c, next) => {
      c.set("admin", null);
      await next();
    };
    app.use("*", context);

    for (const { handler, route } of routes) app.openapi(route, handler);

    return app;
  };

  it("mounts the admin routes", () => {
    expect(() =>
      mount(
        buildContentRoutes(advancedArticleContent, {
          pluginId: CONFIG_PLUGIN.pluginId,
        }),
      ),
    ).not.toThrow();
  });

  it("mounts the public routes", () => {
    expect(() =>
      mount(
        buildContentPublicRoutes(advancedArticleContent, {
          pluginId: CONFIG_PLUGIN.pluginId,
        }),
      ),
    ).not.toThrow();
  });

  it("describes the whole OpenAPI document", () => {
    const app = mount(
      buildContentRoutes(advancedArticleContent, {
        pluginId: CONFIG_PLUGIN.pluginId,
      }),
    );

    const document = app.getOpenAPI31Document({
      info: { title: "test", version: "1" },
      openapi: "3.1.0",
    });

    expect(Object.keys(document.paths ?? {}).length).toBeGreaterThan(0);
  });

  it("converts the AutoForm schema to JSON Schema", () => {
    // A group is a nested object and a repeatable is an array of objects -
    // both have to survive the conversion `AutoForm` performs on every render.
    const json = z.toJSONSchema(advancedArticleContent.schemas.form) as {
      properties: Record<string, { items?: unknown; type?: string }>;
    };

    expect(json.properties.syndication.type).toBe("object");
    expect(json.properties.faq.type).toBe("array");
    expect(json.properties.faq.items).toBeTruthy();
    expect(json.properties.categories.type).toBe("array");
  });

  it("shapes the public response from the allowlist and nothing else", () => {
    // Read off the Zod object rather than a JSON Schema: a response schema
    // carries `z.date()` for `publishedAt`, which `z.toJSONSchema` refuses -
    // Hono serializes it, and the browser never sees this schema.
    const shape = advancedArticleContent.schemas.publicSelectObject.shape;

    expect(Object.keys(shape).sort()).toStrictEqual([
      "categories",
      "faq",
      "locale",
      "publishedAt",
      "seo",
      "slug",
      "syndication",
      "title",
    ]);
    // A private collection is absent from the contract as well as from the
    // response - and `syndication` carries only the leaf that was exposed.
    expect(shape.relatedArticles).toBeUndefined();
    expect(
      Object.keys(
        (shape.syndication as unknown as { shape: Record<string, unknown> })
          .shape,
      ),
    ).toStrictEqual(["priority"]);
  });
});
