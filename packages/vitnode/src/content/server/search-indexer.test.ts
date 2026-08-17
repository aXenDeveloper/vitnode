// @vitest-environment node
import type { Context } from "hono";

import { describe, expect, it } from "vitest";

import {
  testCategoryContentType,
  testPostContentType,
  testSearchablePostContentType,
} from "@/tests/content-fixtures";

import { createContentModel } from "./model";
import { createContentSearchIndexer } from "./search-indexer";

interface RecordedCall {
  arg: unknown;
  op: string;
}

/** The same chainable Drizzle stand-in `service.test.ts` uses, plus `offset`. */
const createDbMock = (results: unknown[][]) => {
  const calls: RecordedCall[] = [];
  const queue = [...results];

  const chain = (rows: unknown[]) => {
    const record = (op: string, arg: unknown) => {
      calls.push({ arg, op });

      return builder;
    };

    const builder = {
      from: (value: unknown) => record("from", value),
      limit: (value: unknown) => record("limit", value),
      offset: (value: unknown) => record("offset", value),
      orderBy: (value: unknown) => record("orderBy", value),
      then: async <TResult>(resolve: (rows: unknown[]) => TResult) =>
        Promise.resolve(rows).then(resolve),
      where: (value: unknown) => record("where", value),
    };

    return builder;
  };

  const db = {
    select: (arg: unknown) => {
      calls.push({ arg, op: "select" });

      return chain(queue.shift() ?? []);
    },
  };

  const c = {
    get: (key: string) => (key === "db" ? db : undefined),
  } as Context;

  return { c, calls };
};

const opOf = (calls: RecordedCall[], op: string) =>
  calls.find(call => call.op === op)?.arg;

const categories = createContentModel(testCategoryContentType);
const searchable = createContentModel(testSearchablePostContentType);
const plain = createContentModel(testPostContentType, {
  references: { category: () => categories.table.id },
});

const PLUGIN_ID = "@vitnode/example";

const indexerFor = (model: typeof plain | typeof searchable) =>
  createContentSearchIndexer(model as typeof searchable, {
    pluginId: PLUGIN_ID,
  });

const PUBLISHED_AT = new Date("2026-02-01T10:00:00.000Z");

const dbRow = (id: number, slug: string) => ({
  body: "Body copy.",
  code: "SECRET",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  excerpt: "Excerpt.",
  id,
  publishedAt: PUBLISHED_AT,
  slug,
  status: "published",
  title: `Post ${id}`,
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
});

describe("generated content search indexer", () => {
  it("uses the content type id as the item type", () => {
    expect(indexerFor(searchable).itemType).toBe("test.searchable");
  });

  describe("count", () => {
    it("counts only published rows", async () => {
      const { c, calls } = createDbMock([[{ value: 12 }]]);

      const total = await indexerFor(searchable).count?.(c);

      expect(total).toBe(12);
      // The published predicate is not optional, so there is always a `where`.
      expect(calls.some(call => call.op === "where" && call.arg)).toBe(true);
    });

    it("reports zero for an empty table", async () => {
      const { c } = createDbMock([[]]);

      await expect(indexerFor(searchable).count?.(c)).resolves.toBe(0);
    });
  });

  describe("load", () => {
    it("projects only the columns the document needs", async () => {
      const { c, calls } = createDbMock([[]]);

      await indexerFor(searchable).load(c, 0, 200);

      const selection = opOf(calls, "select") as Record<string, unknown>;

      expect(Object.keys(selection).sort()).toEqual([
        "body",
        "createdAt",
        "excerpt",
        "id",
        "publishedAt",
        "slug",
        "status",
        "title",
        "updatedAt",
      ]);
      // The private columns are never even fetched.
      expect(selection).not.toHaveProperty("code");
      expect(selection).not.toHaveProperty("views");
      expect(selection).not.toHaveProperty("author");
    });

    it("orders deterministically and honours the page window", async () => {
      const { c, calls } = createDbMock([[]]);

      await indexerFor(searchable).load(c, 400, 200);

      expect(opOf(calls, "orderBy")).toBeDefined();
      expect(opOf(calls, "limit")).toBe(200);
    });

    it("never issues a SQL OFFSET, however deep the rebuild has gone", async () => {
      // `OFFSET` re-reads and discards every earlier row, and counts rows in a
      // set that moves underneath it - a record unpublished after an earlier
      // page shifts the rest forward and the next page steps over one. The
      // walk is a keyset seek on the primary key instead.
      const { c, calls } = createDbMock([[]]);

      await indexerFor(searchable).load(c, 400, 200);

      expect(opOf(calls, "offset")).toBeUndefined();
    });

    it("maps every row into a document, and stamps the owning plugin", async () => {
      const { c } = createDbMock([[dbRow(1, "one"), dbRow(2, "two")]]);

      const page = await indexerFor(searchable).load(c, 0, 200);

      expect(page.itemsRead).toBe(2);
      expect(page.documents).toHaveLength(2);
      expect(page.documents[0]).toMatchObject({
        itemId: 1,
        itemType: "test.searchable",
        pluginId: PLUGIN_ID,
        title: "Post 1",
        url: "/searchable/one",
      });
      expect(page.documents[1]).toMatchObject({
        pluginId: PLUGIN_ID,
        url: "/searchable/two",
      });
    });

    it("reports zero items read past the end of the source", async () => {
      const { c } = createDbMock([[]]);

      await expect(indexerFor(searchable).load(c, 1000, 200)).resolves.toEqual({
        documents: [],
        itemsRead: 0,
      });
    });

    it("counts rows the mapper rejected as items read", async () => {
      // The regression this contract exists for: a page can read rows and
      // project none of them, and reporting that as "no items" would end the
      // rebuild before the valid rows behind it.
      const { c } = createDbMock([
        [
          { ...dbRow(1, "one"), title: "  " },
          { ...dbRow(2, "two"), title: null },
        ],
      ]);

      const page = await indexerFor(searchable).load(c, 0, 200);

      expect(page.itemsRead).toBe(2);
      expect(page.documents).toEqual([]);
    });

    it("separates valid from invalid rows on a mixed page", async () => {
      const { c, calls } = createDbMock([
        [
          dbRow(1, "one"),
          { ...dbRow(2, "two"), title: "   " },
          dbRow(3, "three"),
        ],
      ]);

      const page = await indexerFor(searchable).load(c, 0, 200);

      // `itemsRead` is the row count; only the valid rows became documents.
      expect(page.itemsRead).toBe(3);
      expect(page.documents.map(document => document.itemId)).toEqual([1, 3]);

      const selection = opOf(calls, "select") as Record<string, unknown>;
      expect(selection).not.toHaveProperty("code");
      expect(JSON.stringify(page.documents)).not.toContain("SECRET");
    });
  });

  it("refuses a content type without publication", () => {
    expect(() =>
      indexerFor(categories as unknown as typeof searchable),
    ).toThrow(/publication/i);
  });

  it("builds for a content type with search off, but yields no documents", async () => {
    const { c } = createDbMock([[dbRow(1, "one")]]);

    // `buildContentAdminModule` filters these out; the mapper is the backstop.
    // The row is still read, so `itemsRead` reflects it.
    await expect(indexerFor(plain).load(c, 0, 200)).resolves.toEqual({
      documents: [],
      itemsRead: 1,
    });
  });
});
