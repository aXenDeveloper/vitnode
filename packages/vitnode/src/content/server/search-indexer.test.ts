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

const PUBLISHED_AT = new Date("2026-02-01T10:00:00.000Z");

const dbRow = (id: number, slug: string) => ({
  body: "Body copy.",
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
    expect(createContentSearchIndexer(searchable).itemType).toBe(
      "test.searchable",
    );
  });

  describe("count", () => {
    it("counts only published rows", async () => {
      const { c, calls } = createDbMock([[{ value: 12 }]]);

      const total = await createContentSearchIndexer(searchable).count?.(c);

      expect(total).toBe(12);
      // The published predicate is not optional, so there is always a `where`.
      expect(calls.some(call => call.op === "where" && call.arg)).toBe(true);
    });

    it("reports zero for an empty table", async () => {
      const { c } = createDbMock([[]]);

      await expect(
        createContentSearchIndexer(searchable).count?.(c),
      ).resolves.toBe(0);
    });
  });

  describe("load", () => {
    it("projects only the columns the document needs", async () => {
      const { c, calls } = createDbMock([[]]);

      await createContentSearchIndexer(searchable).load(c, 0, 200);

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

      await createContentSearchIndexer(searchable).load(c, 400, 200);

      expect(opOf(calls, "orderBy")).toBeDefined();
      expect(opOf(calls, "limit")).toBe(200);
      expect(opOf(calls, "offset")).toBe(400);
    });

    it("maps every row into a document", async () => {
      const { c } = createDbMock([[dbRow(1, "one"), dbRow(2, "two")]]);

      const docs = await createContentSearchIndexer(searchable).load(c, 0, 200);

      expect(docs).toHaveLength(2);
      expect(docs[0]).toMatchObject({
        itemId: 1,
        itemType: "test.searchable",
        title: "Post 1",
        url: "/searchable/one",
      });
      expect(docs[1]?.url).toBe("/searchable/two");
    });

    it("returns an empty page past the end", async () => {
      const { c } = createDbMock([[]]);

      await expect(
        createContentSearchIndexer(searchable).load(c, 1000, 200),
      ).resolves.toEqual([]);
    });

    it("drops a row the mapper rejects", async () => {
      const { c } = createDbMock([
        [dbRow(1, "one"), { ...dbRow(2, "two"), title: "  " }],
      ]);

      const docs = await createContentSearchIndexer(searchable).load(c, 0, 200);

      expect(docs).toHaveLength(1);
      expect(docs[0]?.itemId).toBe(1);
    });
  });

  it("refuses a content type without publication", () => {
    expect(() => createContentSearchIndexer(categories)).toThrow(
      /publication/i,
    );
  });

  it("builds for a content type with search off, but yields no documents", async () => {
    const { c } = createDbMock([[dbRow(1, "one")]]);

    // `buildContentAdminModule` filters these out; the mapper is the backstop.
    await expect(
      createContentSearchIndexer(plain).load(c, 0, 200),
    ).resolves.toEqual([]);
  });
});
