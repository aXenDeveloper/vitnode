import type { Context } from "hono";

import { describe, expect, it } from "vitest";

import type { ContentDeliveryOutcome } from "./delivery-writes";

import { defineContentType } from "../define";
import { field } from "../fields";
import {
  contentDeliveryEffects,
  contentDeliveryInvalidation,
} from "./delivery-effects";

/**
 * Which delivery events one mutation emits, and which it deliberately does not.
 *
 * Both events are gated on a *fact* rather than on an operation: the URL moved, and
 * the old address had been live. A listener that warms a CDN or writes an edge
 * redirect table acts on the second one, so emitting it for a corrected draft would
 * make it act on a URL nobody ever visited.
 */

const articleType = defineContentType({
  admin: { label: { plural: "Articles", singular: "Article" } },
  id: "effects.article",
  delivery: { enabled: true, redirects: { enabled: true } },
  fields: {
    slug: field.slug({ source: "title" }),
    title: field.text({ required: true }),
  },
  publication: { enabled: true },
  publicApi: {
    enabled: true,
    fields: ["id", "title", "slug"],
    path: "articles",
  },
  tableName: "effects_articles",
});

const plainType = defineContentType({
  admin: { label: { plural: "Articles", singular: "Article" } },
  id: "effects.plain",
  fields: {
    slug: field.slug({ source: "title" }),
    title: field.text({ required: true }),
  },
  publication: { enabled: true },
  publicApi: {
    enabled: true,
    fields: ["id", "title", "slug"],
    path: "articles",
  },
  tableName: "effects_plain",
});

const outcome = (
  overrides: Partial<ContentDeliveryOutcome> = {},
): ContentDeliveryOutcome => ({
  canonicalPath: "/articles/new",
  itemId: 42,
  locale: null,
  previousPath: "/articles/old",
  previousSlug: "old",
  redirectCreated: true,
  sitemapChanged: true,
  slug: "new",
  slugChanged: true,
  ...overrides,
});

const buildContext = () => {
  const emitted: { name: string; payload: Record<string, unknown> }[] = [];

  const c = {
    get: (key: string) => {
      if (key === "events") {
        return {
          emit: async (name: string, payload: Record<string, unknown>) => {
            emitted.push({ name, payload });

            return await Promise.resolve({ failures: [] });
          },
        };
      }

      return undefined;
    },
  } as unknown as Context;

  return { c, emitted };
};

describe("contentDeliveryEffects", () => {
  it("emits both events when a live URL moves", async () => {
    const { c, emitted } = buildContext();

    const result = await contentDeliveryEffects(c, articleType, outcome(), {
      pluginId: "@vitnode/test",
    });

    expect(emitted.map(entry => entry.name)).toStrictEqual([
      "content.effects.article.delivery_slug_changed",
      "content.effects.article.delivery_redirect_created",
    ]);
    expect(emitted[0].payload).toStrictEqual({
      canonicalPath: "/articles/new",
      contentId: 42,
      locale: null,
      previousPath: "/articles/old",
      previousSlug: "old",
      slug: "new",
    });
    expect(emitted[1].payload).toStrictEqual({
      canonicalPath: "/articles/new",
      contentId: 42,
      locale: null,
      previousPath: "/articles/old",
      previousSlug: "old",
    });
    expect(result.events).toHaveLength(2);
  });

  it("emits only the slug event when the old address was never live", async () => {
    const { c, emitted } = buildContext();

    await contentDeliveryEffects(
      c,
      articleType,
      outcome({ redirectCreated: false }),
      { pluginId: "@vitnode/test" },
    );

    expect(emitted.map(entry => entry.name)).toStrictEqual([
      "content.effects.article.delivery_slug_changed",
    ]);
  });

  it("emits nothing when no URL moved", async () => {
    const { c, emitted } = buildContext();

    await contentDeliveryEffects(
      c,
      articleType,
      outcome({
        previousPath: null,
        previousSlug: null,
        redirectCreated: false,
        slugChanged: false,
      }),
      { pluginId: "@vitnode/test" },
    );

    expect(emitted).toStrictEqual([]);
  });

  it("emits nothing for a mutation that reported no delivery outcome", async () => {
    const { c, emitted } = buildContext();

    await contentDeliveryEffects(c, articleType, undefined, {
      pluginId: "@vitnode/test",
    });

    expect(emitted).toStrictEqual([]);
  });

  it("emits nothing when the canonical path cannot be built", async () => {
    const { c, emitted } = buildContext();

    // A slug written straight into the database, or a localized content type with a
    // shared slug: no single canonical path, so no delivery fact to announce.
    await contentDeliveryEffects(
      c,
      articleType,
      outcome({ canonicalPath: null }),
      { pluginId: "@vitnode/test" },
    );

    expect(emitted).toStrictEqual([]);
  });

  it("carries the locale on a localized move", async () => {
    const { c, emitted } = buildContext();

    await contentDeliveryEffects(
      c,
      articleType,
      outcome({
        canonicalPath: "/pl/articles/nowy",
        locale: "pl",
        previousPath: "/pl/articles/stary",
        previousSlug: "stary",
        slug: "nowy",
      }),
      { pluginId: "@vitnode/test" },
    );

    expect(emitted[0].payload).toMatchObject({ locale: "pl" });
  });
});

describe("contentDeliveryInvalidation", () => {
  it("is undefined for a content type without delivery", () => {
    expect(contentDeliveryInvalidation(plainType, outcome())).toBeUndefined();
  });

  it("reports the sitemap only when the set of listed URLs changed", () => {
    expect(contentDeliveryInvalidation(articleType, outcome())).toStrictEqual({
      sitemap: true,
    });
    expect(
      contentDeliveryInvalidation(
        articleType,
        outcome({ sitemapChanged: false }),
      ),
    ).toStrictEqual({ sitemap: false });
  });

  it("still expires the delivery metadata when no URL moved", () => {
    // A shared SEO field moving changes what every locale's `<head>` renders even
    // though nothing was added to or removed from the sitemap.
    expect(contentDeliveryInvalidation(articleType, undefined)).toStrictEqual({
      sitemap: false,
    });
  });
});
