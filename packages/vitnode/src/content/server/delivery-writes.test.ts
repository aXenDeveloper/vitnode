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
  kind: "assertAvailable" | "ensureCurrent" | "reserve" | "retire";
}

/**
 * A history model that records what it was asked to do.
 *
 * Two knobs, and they answer different questions:
 *
 * - **`retired`** is the oracle for "was that URL ever live" when the rows on file
 *   are not being modelled. The whole redirect decision hangs off it.
 * - **`existing`** models them instead: the set of slugs already in the table.
 *   Pass it and `retire` answers from the recorder's own rows rather than from
 *   the knob, which is what lets a test watch the bootstrap turn an address that
 *   *could not* be retired into one that can. `[]` is the state a record
 *   published before Stage 8 existed is actually in.
 */
const recorder = ({
  existing = null,
  reserved = null,
  retired = true,
}: {
  existing?: null | string[];
  reserved?: null | string;
  retired?: boolean;
} = {}) => {
  const calls: Call[] = [];
  const rows = new Set<string>(existing ?? []);

  const refuse = (args: ContentSlugHistoryTarget) => {
    if (reserved !== null && args.slug === reserved) {
      throw new ContentDeliverySlugReserved({
        contentTypeId: "writes.article",
        locale: args.locale,
        slug: args.slug,
      });
    }
  };

  const model: ContentSlugHistoryModel = {
    assertAvailable: async (_tx, args) => {
      calls.push({ args, kind: "assertAvailable" });
      refuse(args);

      return await Promise.resolve();
    },
    ensureCurrent: async (_tx, args) => {
      calls.push({ args, kind: "ensureCurrent" });
      refuse(args);
      const created = !rows.has(args.slug);
      rows.add(args.slug);

      return await Promise.resolve({ created });
    },
    list: async () => await Promise.resolve([]),
    owner: async () => await Promise.resolve(null),
    reserve: async (_tx, args) => {
      calls.push({ args, kind: "reserve" });
      refuse(args);
      const created = !rows.has(args.slug);
      rows.add(args.slug);

      return await Promise.resolve({ created });
    },
    retire: async (_tx, args) => {
      calls.push({ args, kind: "retire" });

      return await Promise.resolve({
        retired: existing === null ? retired : rows.has(args.slug),
      });
    },
  };

  return { calls, model };
};

const tx = {} as ContentDatabase;

const apply = async (
  definition: AnyContentTypeDefinition,
  transition: Parameters<typeof applyContentDeliveryWrite>[0]["transition"],
  options?: Parameters<typeof recorder>[0],
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

    // Establish, retire, reserve - and the order is the whole correctness
    // argument. The old address has to be on file before it can be retired (that
    // is the bootstrap), it has to be retired before the new one is reserved (or a
    // move from `a` to `b` and back to `a` would hit its own live reservation),
    // and only then does the new address become current.
    expect(calls.map(call => call.kind)).toStrictEqual([
      "ensureCurrent",
      "retire",
      "reserve",
    ]);
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
  it("keeps the address on file when a record stops being public", async () => {
    const { calls, outcome } = await apply(articleType, {
      isPublic: false,
      itemId: 1,
      languageId: null,
      locale: null,
      previousSlug: "hello",
      slug: "hello",
      wasPublic: true,
    });

    // No retire (the slug did not move) and no reserve (it is not public) - but the
    // address is established, because an unpublish is a public URL leaving service
    // and the reservation is what stops an unrelated record inheriting it. The
    // resolver stops answering because it reads the live publication state, not
    // because the row went away.
    expect(calls.map(call => call.kind)).toStrictEqual(["ensureCurrent"]);
    expect(outcome).toMatchObject({
      sitemap: { contentChanged: true, indexChanged: true },
      slugChanged: false,
    });
  });

  it("keeps the address on file after a delete, and reports the lost line", async () => {
    const { calls, outcome } = await apply(articleType, {
      isPublic: false,
      itemId: 1,
      languageId: null,
      locale: null,
      previousSlug: "hello",
      slug: null,
      wasPublic: true,
    });

    // Deliberately left **current** rather than retired: the record is gone, so
    // there is nothing to redirect to, and a retired row would advertise a
    // destination that does not exist. Keeping it current keeps the address
    // reserved, which is the whole point - somebody's incoming link must not start
    // resolving to unrelated content.
    expect(calls.map(call => call.kind)).toStrictEqual(["ensureCurrent"]);
    expect(outcome).toMatchObject({
      canonicalPath: null,
      sitemap: { contentChanged: true, indexChanged: true },
      slug: null,
      slugChanged: false,
    });
  });

  it("writes nothing when a draft is deleted", async () => {
    const { calls } = await apply(articleType, {
      isPublic: false,
      itemId: 1,
      languageId: null,
      locale: null,
      previousSlug: "never-live",
      slug: null,
      wasPublic: false,
    });

    // `wasPublic: false` is the whole difference. A draft's slug was never an
    // address, so there is nothing to reserve and nobody to keep it from.
    expect(calls).toStrictEqual([]);
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
      {
        args: {
          itemId: 7,
          languageId: 2,
          locale: "pl",
          // The path the old address served, recorded as the historical fact it
          // is - locale prefix and all, so a Polish redirect never points at an
          // English URL.
          path: "/pl/articles/stary",
          slug: "stary",
        },
        kind: "ensureCurrent",
      },
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

/**
 * A record that was published before this table existed.
 *
 * Stage 8 ships no backfill migration, on purpose: the database keeps one slug per
 * row and no record of which historical values were ever public, so a global scan
 * would have to choose between missing live URLs and inventing redirects for slugs
 * that only ever existed on a draft. The mutation does not have to choose - it is
 * holding the row on both sides of its own write - so the address is established
 * lazily, at the moment it leaves service, on the evidence the mutation already has.
 *
 * `existing: []` is that record: publicly reachable, and with nothing on file.
 * Every test here failed before the bootstrap existed.
 */
describe("a record that predates slug history", () => {
  it("redirects its first slug change instead of losing the URL", async () => {
    const { calls, outcome } = await apply(
      articleType,
      {
        isPublic: true,
        itemId: 1,
        languageId: null,
        locale: null,
        previousSlug: "hello",
        slug: "world",
        wasPublic: true,
      },
      { existing: [] },
    );

    // The bootstrap puts `hello` on file, so the retire that follows has something
    // to retire - which is what makes `/articles/hello` answer 308 rather than 404.
    // Without it `retire` reported `false` and the first previous address of every
    // pre-Stage-8 record was lost permanently.
    expect(calls.map(call => call.kind)).toStrictEqual([
      "ensureCurrent",
      "retire",
      "reserve",
    ]);
    expect(calls[0].args).toMatchObject({
      path: "/articles/hello",
      slug: "hello",
    });
    expect(outcome).toMatchObject({
      previousPath: "/articles/hello",
      previousSlug: "hello",
      redirectCreated: true,
    });
  });

  it("reserves the address it is deleted from, so nobody inherits it", async () => {
    const { calls } = await apply(
      articleType,
      {
        isPublic: false,
        itemId: 1,
        languageId: null,
        locale: null,
        previousSlug: "hello",
        slug: null,
        wasPublic: true,
      },
      { existing: [] },
    );

    expect(calls.map(call => call.kind)).toStrictEqual(["ensureCurrent"]);
    expect(calls[0].args).toMatchObject({ slug: "hello" });
  });

  it("reserves the address it is unpublished from", async () => {
    const { calls } = await apply(
      articleType,
      {
        isPublic: false,
        itemId: 1,
        languageId: null,
        locale: null,
        previousSlug: "hello",
        slug: "hello",
        wasPublic: true,
      },
      { existing: [] },
    );

    expect(calls.map(call => call.kind)).toStrictEqual(["ensureCurrent"]);
  });

  it("invents no history for a draft whose slug is corrected", async () => {
    const { calls, outcome } = await apply(
      articleType,
      {
        isPublic: false,
        itemId: 1,
        languageId: null,
        locale: null,
        previousSlug: "draft-old",
        slug: "draft-new",
        wasPublic: false,
      },
      { existing: [] },
    );

    // `wasPublic: false` withholds the evidence, and without evidence nothing is
    // written. A redirect from an address nobody could ever visit is worse than no
    // redirect: it permanently reserves a URL against the next record that wants it.
    expect(calls.map(call => call.kind)).toStrictEqual([
      "retire",
      "assertAvailable",
    ]);
    expect(outcome.redirectCreated).toBe(false);
  });

  it("bootstraps nothing when it stays published at the same address", async () => {
    const { calls } = await apply(
      articleType,
      {
        isPublic: true,
        itemId: 1,
        languageId: null,
        locale: null,
        previousSlug: "hello",
        slug: "hello",
        wasPublic: true,
      },
      { existing: [] },
    );

    // An ordinary title edit. Nothing is leaving service, so `reserve` alone
    // establishes the current address - the bootstrap is for addresses being given
    // up, not for every write.
    expect(calls.map(call => call.kind)).toStrictEqual(["reserve"]);
  });

  it("stays idempotent when the address is already on file", async () => {
    const { calls, outcome } = await apply(
      articleType,
      {
        isPublic: true,
        itemId: 1,
        languageId: null,
        locale: null,
        previousSlug: "hello",
        slug: "world",
        wasPublic: true,
      },
      { existing: ["hello"] },
    );

    // Same call sequence as the pre-Stage-8 case; the difference is invisible from
    // out here, which is the point. `ensureCurrent` established nothing because the
    // row was already there, and it left it exactly as it found it.
    expect(calls.map(call => call.kind)).toStrictEqual([
      "ensureCurrent",
      "retire",
      "reserve",
    ]);
    expect(outcome.redirectCreated).toBe(true);
  });

  it("keeps a move away and back idempotent", async () => {
    // `a -> b`, on a record whose history predates Stage 8.
    const away = await apply(
      articleType,
      {
        isPublic: true,
        itemId: 1,
        languageId: null,
        locale: null,
        previousSlug: "a",
        slug: "b",
        wasPublic: true,
      },
      { existing: [] },
    );
    expect(away.outcome.redirectCreated).toBe(true);

    // `b -> a`, now that both addresses are on file. `b` retires and `a` comes back
    // into service through `reserve`, which is the one call allowed to un-retire.
    const back = await apply(
      articleType,
      {
        isPublic: true,
        itemId: 1,
        languageId: null,
        locale: null,
        previousSlug: "b",
        slug: "a",
        wasPublic: true,
      },
      { existing: ["a", "b"] },
    );

    expect(back.calls.map(call => call.kind)).toStrictEqual([
      "ensureCurrent",
      "retire",
      "reserve",
    ]);
    expect(back.outcome).toMatchObject({
      canonicalPath: "/articles/a",
      previousSlug: "b",
      redirectCreated: true,
    });
  });

  it("skips an address the engine cannot build a path for", async () => {
    const { calls } = await apply(
      articleType,
      {
        isPublic: true,
        itemId: 1,
        languageId: null,
        locale: null,
        // A row written straight into the database. It has no buildable URL, so it
        // was never addressable and there is nothing to preserve.
        previousSlug: "   ",
        slug: "world",
        wasPublic: true,
      },
      { existing: [] },
    );

    expect(calls.map(call => call.kind)).toStrictEqual(["retire", "reserve"]);
  });
});

describe("delivery without redirects", () => {
  it("reports the paths and writes no history at all", async () => {
    const withoutRedirects = defineContentType({
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
