// @vitest-environment node
import type { Context } from "hono";

import { describe, expect, it } from "vitest";

import {
  testArticleContentType,
  testCategoryContentType,
} from "@/tests/content-fixtures";

import { ContentEngineError } from "../errors";
import { createContentModel } from "./model";

const categories = createContentModel(testCategoryContentType);
const articles = createContentModel(testArticleContentType, {
  references: { category: () => categories.table.id },
});

interface RecordedCall {
  arg: unknown;
  op: string;
}

/**
 * A chainable stand-in for the Drizzle client. Each top-level `select`,
 * `insert`, `update` or `delete` shifts the next queued result, and every
 * builder call is recorded so tests can assert on the shape of the query.
 */
const createDbMock = (results: unknown[][]) => {
  const calls: RecordedCall[] = [];
  const queue = [...results];

  const chain = (rows: unknown[]) => {
    const record = (op: string, arg: unknown) => {
      calls.push({ arg, op });

      return builder;
    };

    const builder = {
      $dynamic: () => builder,
      from: (value: unknown) => record("from", value),
      leftJoin: (value: unknown) => record("leftJoin", value),
      limit: (value: unknown) => record("limit", value),
      orderBy: (value: unknown) => record("orderBy", value),
      returning: (value: unknown) => record("returning", value),
      set: (value: unknown) => record("set", value),
      then: async <TResult>(resolve: (rows: unknown[]) => TResult) =>
        Promise.resolve(rows).then(resolve),
      values: (value: unknown) => record("values", value),
      where: (value: unknown) => record("where", value),
    };

    return builder;
  };

  const start = (op: string) => (arg: unknown) => {
    calls.push({ arg, op });

    return chain(queue.shift() ?? []);
  };

  const db = {
    delete: start("delete"),
    insert: start("insert"),
    select: start("select"),
    update: start("update"),
  };

  const c = {
    get: (key: string) => (key === "db" ? db : undefined),
  } as Context;

  return { c, calls };
};

const opsOf = (calls: RecordedCall[], op: string) =>
  calls.filter(call => call.op === op).map(call => call.arg);

describe("content service", () => {
  describe("create", () => {
    it("inserts the values and returns the created row", async () => {
      const { c, calls } = createDbMock([[{ id: 1, title: "Hello" }]]);

      const row = await articles.service(c).create({
        category: 2,
        title: "Hello",
      });

      expect(row).toEqual({ id: 1, title: "Hello" });
      expect(opsOf(calls, "values")[0]).toEqual({
        category: 2,
        title: "Hello",
      });
    });

    it("converts an ISO dateTime string into a Date column value", async () => {
      const { c, calls } = createDbMock([[{ id: 1 }]]);

      await articles.service(c).create({
        category: 2,
        publishedAt: "2026-08-02T10:00:00.000Z",
        title: "Hello",
      });

      const values = opsOf(calls, "values")[0] as { publishedAt: Date };
      expect(values.publishedAt).toBeInstanceOf(Date);
      expect(values.publishedAt.toISOString()).toBe("2026-08-02T10:00:00.000Z");
    });
  });

  describe("findById", () => {
    it("returns the row when it exists", async () => {
      const { c } = createDbMock([[{ id: 7, title: "Hello" }]]);

      await expect(articles.service(c).findById(7)).resolves.toEqual({
        id: 7,
        title: "Hello",
      });
    });

    it("returns null rather than throwing when it does not", async () => {
      const { c } = createDbMock([[]]);

      await expect(articles.service(c).findById(7)).resolves.toBeNull();
    });
  });

  describe("update", () => {
    it("returns null for a row that does not exist", async () => {
      const { c, calls } = createDbMock([[]]);

      await expect(
        articles.service(c).update(7, { title: "Changed" }),
      ).resolves.toBeNull();
      expect(opsOf(calls, "update")).toHaveLength(0);
    });

    it("reports only the fields that actually changed", async () => {
      const { c, calls } = createDbMock([
        [{ id: 7, status: "draft", title: "Hello" }],
        [{ id: 7, status: "draft", title: "Changed" }],
      ]);

      const result = await articles
        .service(c)
        .update(7, { status: "draft", title: "Changed" });

      expect(result?.changedFields).toEqual(["title"]);
      expect(opsOf(calls, "set")[0]).toEqual({ title: "Changed" });
    });

    it("skips the write entirely when nothing moved", async () => {
      const { c, calls } = createDbMock([[{ id: 7, title: "Hello" }]]);

      const result = await articles.service(c).update(7, { title: "Hello" });

      expect(result?.changedFields).toEqual([]);
      expect(opsOf(calls, "update")).toHaveLength(0);
    });
  });

  describe("delete", () => {
    it("returns the deleted row", async () => {
      const { c } = createDbMock([[{ id: 7, title: "Hello" }]]);

      await expect(articles.service(c).delete(7)).resolves.toEqual({
        id: 7,
        title: "Hello",
      });
    });

    it("returns null when nothing was deleted", async () => {
      const { c } = createDbMock([[]]);

      await expect(articles.service(c).delete(7)).resolves.toBeNull();
    });
  });

  describe("findMany", () => {
    const page = (rows: unknown[]) => [[{ count: rows.length }], rows];

    it("joins once per reference field instead of querying per row", async () => {
      const { c, calls } = createDbMock(
        page([
          { id: 1, label__author: "Ada", label__category: "News" },
          { id: 2, label__author: null, label__category: "News" },
        ]),
      );

      await articles.service(c).findMany();

      // `author` and `category` - one join each, and no extra round trips.
      expect(opsOf(calls, "leftJoin")).toHaveLength(2);
      expect(opsOf(calls, "select")).toHaveLength(2); // count + page
    });

    it("splits the joined labels out of the row", async () => {
      const { c } = createDbMock(
        page([{ id: 1, label__author: "Ada", label__category: "News" }]),
      );

      const { edges } = await articles.service(c).findMany();

      expect(edges[0]).toEqual({
        id: 1,
        labels: { author: "Ada", category: "News" },
      });
    });

    it("reports a missing label as null", async () => {
      const { c } = createDbMock(
        page([{ id: 1, label__author: null, label__category: "News" }]),
      );

      const { edges } = await articles.service(c).findMany();

      expect(edges[0].labels.author).toBeNull();
    });

    it("rejects an order column outside the allowlist", async () => {
      const { c } = createDbMock(page([]));

      await expect(
        articles.service(c).findMany({ orderBy: { column: "views" } }),
      ).rejects.toThrow(ContentEngineError);
    });

    it("rejects an unknown filter", async () => {
      const { c } = createDbMock(page([]));

      await expect(
        articles.service(c).findMany({ filters: { nope: 1 } }),
      ).rejects.toThrow(ContentEngineError);
    });
  });

  describe("options", () => {
    it("returns picker options for a reference field", async () => {
      const { c } = createDbMock([[{ label: "News", value: 3 }]]);

      await expect(articles.service(c).options("category")).resolves.toEqual([
        { label: "News", value: 3 },
      ]);
    });

    it("falls back to the identifier when the label is null", async () => {
      const { c } = createDbMock([[{ label: null, value: 3 }]]);

      await expect(articles.service(c).options("category")).resolves.toEqual([
        { label: "3", value: 3 },
      ]);
    });

    it("rejects a field that is not a relation or user", async () => {
      const { c } = createDbMock([[]]);

      await expect(articles.service(c).options("title")).rejects.toThrow(
        /not a relation or user field/,
      );
    });
  });

  describe("transactions", () => {
    it("uses the supplied transaction handle", async () => {
      const { c } = createDbMock([]);
      const outer = createDbMock([[{ id: 1 }]]);
      const tx = outer.c.get("db");

      await articles.service(c).create({ category: 1, title: "Hello" }, { tx });

      expect(opsOf(outer.calls, "insert")).toHaveLength(1);
    });
  });
});
