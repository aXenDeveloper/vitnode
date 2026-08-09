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
  editorial: { enabled: true },
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
  // A slug change on a published record: the file's bytes moved, the index did not.
  sitemap: { contentChanged: true, indexChanged: false },
  slug: "new",
  slugChanged: true,
  ...overrides,
});

/** One dead listener, as `EventsModel.emit` reports it rather than throws it. */
const DEAD_LISTENER = {
  error: "Service unavailable",
  listener: "warm-edge-cache",
  module: "cdn",
  pluginId: "@vitnode/edge",
};

const buildContext = ({ failing = false }: { failing?: boolean } = {}) => {
  const emitted: { name: string; payload: Record<string, unknown> }[] = [];
  const logged: string[] = [];

  const c = {
    get: (key: string) => {
      if (key === "events") {
        return {
          emit: async (name: string, payload: Record<string, unknown>) => {
            emitted.push({ name, payload });

            return await Promise.resolve({
              delivered: failing ? 0 : 1,
              eventId: `event-${emitted.length}`,
              failures: failing ? [DEAD_LISTENER] : [],
              status: "delivered",
            });
          },
        };
      }

      if (key === "log") {
        return {
          error: async (message: string) => {
            logged.push(message);

            return await Promise.resolve();
          },
        };
      }

      return undefined;
    },
  } as unknown as Context;

  return { c, emitted, logged };
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

  /**
   * The same post-commit rule the base and translation effects follow.
   *
   * `EventsModel.emit` reports rather than throws, so `failures` is the only place
   * a dead listener is visible - and a missed `delivery_slug_changed` is the most
   * expensive one to miss: the listener that purges a CDN or writes an edge
   * redirect table never hears the URL moved, so the old address keeps 404ing at
   * the edge while the origin is entirely correct.
   */
  describe("reporting a delivery failure", () => {
    it("logs the failed listener behind the effects prefix", async () => {
      const { c, logged } = buildContext({ failing: true });

      await contentDeliveryEffects(c, articleType, outcome(), {
        pluginId: "@vitnode/test",
      });

      // One line per event, and both events fired for this outcome.
      expect(logged).toHaveLength(2);
      expect(logged[0]).toContain("[content-effects]");
      expect(logged[0]).toContain("effects.article");
      expect(logged[0]).toContain('"itemId":42');
      expect(logged[0]).toContain("warm-edge-cache");
      expect(logged[0]).toContain("Service unavailable");
    });

    it("names the delivery action, so it is not read as a failed edit", async () => {
      const { c, logged } = buildContext({ failing: true });

      await contentDeliveryEffects(c, articleType, outcome(), {
        pluginId: "@vitnode/test",
      });

      expect(logged[0]).toContain("delivery_slug_changed");
      expect(logged[1]).toContain("delivery_redirect_created");
    });

    it("carries the locale, so a Polish URL is a distinct incident", async () => {
      const { c, logged } = buildContext({ failing: true });

      await contentDeliveryEffects(
        c,
        articleType,
        outcome({
          canonicalPath: "/pl/articles/nowy",
          locale: "pl",
          previousPath: "/pl/articles/stary",
          previousSlug: "stary",
          redirectCreated: false,
          slug: "nowy",
        }),
        { pluginId: "@vitnode/test" },
      );

      expect(logged).toHaveLength(1);
      expect(logged[0]).toContain('"locale":"pl"');
    });

    it("still returns normally, because the write has already committed", async () => {
      const { c, logged } = buildContext({ failing: true });

      const result = await contentDeliveryEffects(c, articleType, outcome(), {
        pluginId: "@vitnode/test",
      });

      // The events are still reported back to the caller, failures and all.
      expect(result.events).toHaveLength(2);
      expect(logged).toHaveLength(2);
    });

    it("writes nothing when every listener heard it", async () => {
      const { c, logged } = buildContext();

      await contentDeliveryEffects(c, articleType, outcome(), {
        pluginId: "@vitnode/test",
      });

      // An expected success is not an error, and a log full of them is a log
      // nobody reads.
      expect(logged).toStrictEqual([]);
    });
  });
});

describe("contentDeliveryInvalidation", () => {
  it("is undefined for a content type without delivery", () => {
    expect(contentDeliveryInvalidation(plainType, outcome())).toBeUndefined();
  });

  it("passes the sitemap change through unchanged", () => {
    expect(contentDeliveryInvalidation(articleType, outcome())).toStrictEqual({
      sitemap: { contentChanged: true, indexChanged: false },
    });
    expect(
      contentDeliveryInvalidation(
        articleType,
        outcome({ sitemap: { contentChanged: true, indexChanged: true } }),
      ),
    ).toStrictEqual({ sitemap: { contentChanged: true, indexChanged: true } });
  });

  it("expires no sitemap for a mutation that reported no delivery outcome", () => {
    // The delivery metadata tag still goes out - a shared SEO field moving changes
    // what every locale's `<head>` renders - but a mutation that touched no
    // slug-bearing path has nothing to say about the sitemap.
    expect(contentDeliveryInvalidation(articleType, undefined)).toStrictEqual({
      sitemap: { contentChanged: false, indexChanged: false },
    });
  });
});
