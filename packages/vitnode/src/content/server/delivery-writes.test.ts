import { describe, expect, it } from "vitest";

import type { AnyContentTypeDefinition } from "../types";
import type { ContentDatabase } from "./service";
import type {
  ContentSlugHistoryModel,
  ContentSlugHistoryTarget,
} from "./slug-history-model";

import { defineContentType } from "../define";
import { ContentDeliverySlugReserved } from "../errors";
import { field } from "../fields";
import { applyContentDeliveryWrite } from "./delivery-writes";

/**
 * When slug history is written, and when it deliberately is not.
 *
 * The rule this file exists to pin down is the one in §10 of the Stage 8 brief: a
 * slug becomes redirectable only if it was **previously used by an addressable
 * public version**. That is what separates "a live URL moved and needs a redirect"
 * from "somebody fixed a typo in a draft three times before publishing" - and
 * getting it wrong means either a pile of redirects nobody asked for, or a moved
 * page that 404s.
 */

const articleType = defineContentType({
  admin: { label: { plural: "Articles", singular: "Article" } },
  id: "writes.article",
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
  tableName: "writes_articles",
});

const localizedType = defineContentType({
  admin: { label: { plural: "Articles", singular: "Article" } },
  id: "writes.localized",
  editorial: { enabled: true },
  delivery: { enabled: true, redirects: { enabled: true } },
  fields: {
    slug: field.slug({ localized: true, source: "title" }),
    title: field.text({ localized: true, required: true }),
  },
  localization: { defaultLocale: "en", enabled: true },
  publication: { enabled: true },
  publicApi: {
    enabled: true,
    fields: ["id", "title", "slug"],
    path: "articles",
  },
  tableName: "writes_localized",
});

interface Call {
  args: ContentSlugHistoryTarget | Omit<ContentSlugHistoryTarget, "locale">;
  kind: "assertAvailable" | "reserve" | "retire";
}

/**
 * A history model that records what it was asked to do.
 *
 * `retired` is the interesting knob: it is the answer to "was that URL ever live",
 * and the whole redirect decision hangs off it.
 */
const recorder = ({
  reserved = null,
  retired = true,
}: { reserved?: null | string; retired?: boolean } = {}) => {
  const calls: Call[] = [];

  const model: ContentSlugHistoryModel = {
    assertAvailable: async (_tx, args) => {
      calls.push({ args, kind: "assertAvailable" });
      if (reserved !== null && args.slug === reserved) {
        throw new ContentDeliverySlugReserved({
          contentTypeId: "writes.article",
          locale: args.locale,
          slug: args.slug,
        });
      }

      return await Promise.resolve();
    },
    list: async () => await Promise.resolve([]),
    owner: async () => await Promise.resolve(null),
    reserve: async (_tx, args) => {
      calls.push({ args, kind: "reserve" });
      if (reserved !== null && args.slug === reserved) {
        throw new ContentDeliverySlugReserved({
          contentTypeId: "writes.article",
          locale: args.locale,
          slug: args.slug,
        });
      }

      return await Promise.resolve({ created: true });
    },
    retire: async (_tx, args) => {
      calls.push({ args, kind: "retire" });

      return await Promise.resolve({ retired });
    },
  };

  return { calls, model };
};

const tx = {} as ContentDatabase;

const apply = async (
  definition: AnyContentTypeDefinition,
  transition: Parameters<typeof applyContentDeliveryWrite>[0]["transition"],
  options?: { reserved?: null | string; retired?: boolean },
) => {
  const { calls, model } = recorder(options);
  const outcome = await applyContentDeliveryWrite({
    definition,
    slugHistory: model,
    transition,
    tx,
  });

  return { calls, outcome };
};

describe("a draft", () => {
  it("checks its slug but reserves nothing", async () => {
    const { calls, outcome } = await apply(articleType, {
      isPublic: false,
      itemId: 1,
      languageId: null,
      locale: null,
      previousSlug: null,
      slug: "hello",
      wasPublic: false,
    });

    // Checked, because "that address belongs to an article that moved" is far
    // better heard at save time. Not reserved, because a draft has no public URL
    // and claiming one would refuse a live address to somebody who wants it.
    expect(calls.map(call => call.kind)).toStrictEqual(["assertAvailable"]);
    expect(outcome).toMatchObject({
      canonicalPath: "/articles/hello",
      redirectCreated: false,
      // Neither public before nor after, so no sitemap file lists it either way.
      sitemap: { contentChanged: false, indexChanged: false },
      slugChanged: false,
    });
  });

  it("creates no redirect when its slug is corrected before publication", async () => {
    const { calls, outcome } = await apply(
      articleType,
      {
        isPublic: false,
        itemId: 1,
        languageId: null,
        locale: null,
        previousSlug: "typo",
        slug: "fixed",
        wasPublic: false,
      },
      // Nothing to retire: the old slug was never publicly addressable, so no row
      // exists for it.
      { retired: false },
    );

    expect(calls.map(call => call.kind)).toStrictEqual([
      "retire",
      "assertAvailable",
    ]);
    expect(outcome).toMatchObject({
      previousPath: "/articles/typo",
      redirectCreated: false,
      slugChanged: true,
    });
  });
});

describe("publishing", () => {
  it("reserves the current address", async () => {
    const { calls, outcome } = await apply(articleType, {
      isPublic: true,
      itemId: 1,
      languageId: null,
      locale: null,
      previousSlug: "hello",
      slug: "hello",
      wasPublic: false,
    });

    expect(calls).toStrictEqual([
      {
        args: {
          itemId: 1,
          languageId: null,
          locale: null,
          path: "/articles/hello",
          slug: "hello",
        },
        kind: "reserve",
      },
    ]);
    // A publish adds a sitemap line even though no URL moved, and changes how many
    // URLs the index counts.
    expect(outcome).toMatchObject({
      sitemap: { contentChanged: true, indexChanged: true },
      slugChanged: false,
    });
  });

  it("refuses an address another record's history owns", async () => {
    await expect(
      apply(
        articleType,
        {
          isPublic: true,
          itemId: 2,
          languageId: null,
          locale: null,
          previousSlug: "hello",
          slug: "hello",
          wasPublic: false,
        },
        { reserved: "hello" },
      ),
    ).rejects.toThrow(ContentDeliverySlugReserved);
  });
});

describe("moving a published URL", () => {
  it("retires the old address and reserves the new one, in that order", async () => {
    const { calls, outcome } = await apply(articleType, {
      isPublic: true,
      itemId: 1,
      languageId: null,
      locale: null,
      previousSlug: "old",
      slug: "new",
      wasPublic: true,
    });

    // Retire first: a move from `a` to `b` and back to `a` would otherwise hit its
    // own live reservation.
    expect(calls.map(call => call.kind)).toStrictEqual(["retire", "reserve"]);
    expect(outcome).toMatchObject({
      canonicalPath: "/articles/new",
      previousPath: "/articles/old",
      previousSlug: "old",
      redirectCreated: true,
      // The file's bytes moved - one line now reads a different URL - but the number
      // of files an index lists did not.
      sitemap: { contentChanged: true, indexChanged: false },
      slugChanged: true,
    });
  });

  it("reports no redirect when the old slug had never been live", async () => {
    const { outcome } = await apply(
      articleType,
      {
        isPublic: true,
        itemId: 1,
        languageId: null,
        locale: null,
        previousSlug: "old",
        slug: "new",
        wasPublic: true,
      },
      { retired: false },
    );

    expect(outcome).toMatchObject({
      redirectCreated: false,
      slugChanged: true,
    });
  });
});

describe("unpublishing and deleting", () => {
  it("writes nothing on an unpublish, and keeps the history", async () => {
    const { calls, outcome } = await apply(articleType, {
      isPublic: false,
      itemId: 1,
      languageId: null,
      locale: null,
      previousSlug: "hello",
      slug: "hello",
      wasPublic: true,
    });

    // No retire (the slug did not move) and no reserve (it is not public). The
    // resolver stops redirecting because it reads the live publication state.
    expect(calls).toStrictEqual([]);
    expect(outcome).toMatchObject({
      sitemap: { contentChanged: true, indexChanged: true },
      slugChanged: false,
    });
  });

  it("writes nothing on a delete, and reports the lost sitemap line", async () => {
    const { calls, outcome } = await apply(articleType, {
      isPublic: false,
      itemId: 1,
      languageId: null,
      locale: null,
      previousSlug: "hello",
      slug: null,
      wasPublic: true,
    });

    expect(calls).toStrictEqual([]);
    expect(outcome).toMatchObject({
      canonicalPath: null,
      sitemap: { contentChanged: true, indexChanged: true },
      slug: null,
      slugChanged: false,
    });
  });
});

describe("a localized slug", () => {
  it("carries the language on every write, so histories stay isolated", async () => {
    const { calls } = await apply(localizedType, {
      isPublic: true,
      itemId: 7,
      languageId: 2,
      locale: "pl",
      previousSlug: "stary",
      slug: "nowy",
      wasPublic: true,
    });

    expect(calls).toStrictEqual([
      { args: { itemId: 7, languageId: 2, slug: "stary" }, kind: "retire" },
      {
        args: {
          itemId: 7,
          languageId: 2,
          locale: "pl",
          path: "/pl/articles/nowy",
          slug: "nowy",
        },
        kind: "reserve",
      },
    ]);
  });

  it("builds locale-prefixed paths on both sides of the move", async () => {
    const { outcome } = await apply(localizedType, {
      isPublic: true,
      itemId: 7,
      languageId: 2,
      locale: "pl",
      previousSlug: "stary",
      slug: "nowy",
      wasPublic: true,
    });

    expect(outcome).toMatchObject({
      canonicalPath: "/pl/articles/nowy",
      locale: "pl",
      previousPath: "/pl/articles/stary",
    });
  });
});

describe("delivery without redirects", () => {
  it("reports the paths and writes no history at all", async () => {
    const withoutRedirects = defineContentType({
      admin: { label: { plural: "A", singular: "A" } },
      id: "writes.no-redirects",
      delivery: { enabled: true, sitemap: { enabled: true } },
      fields: {
        slug: field.slug({ source: "title" }),
        title: field.text({ required: true }),
      },
      publication: { enabled: true },
      publicApi: { enabled: true, fields: ["id", "title", "slug"], path: "a" },
      tableName: "writes_no_redirects",
    });

    const outcome = await applyContentDeliveryWrite({
      definition: withoutRedirects,
      // `null` is how the caller says "this content type keeps no history".
      slugHistory: null,
      transition: {
        isPublic: true,
        itemId: 1,
        languageId: null,
        locale: null,
        previousSlug: "old",
        slug: "new",
        wasPublic: true,
      },
      tx,
    });

    expect(outcome).toMatchObject({
      canonicalPath: "/a/new",
      previousPath: "/a/old",
      // The URL moved and the file changed - the engine simply cannot redirect the
      // old address, because nothing recorded it.
      redirectCreated: false,
      sitemap: { contentChanged: true, indexChanged: false },
      slugChanged: true,
    });
  });
});
