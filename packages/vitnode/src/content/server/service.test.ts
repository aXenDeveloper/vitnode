// @vitest-environment node
import type { Context } from "hono";

import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import {
  testArticleContentType,
  testCategoryContentType,
} from "@/tests/content-fixtures";

import type { ContentCreateInput, ContentUpdateInput } from "../types";

import { ContentEngineError } from "../errors";
import { createContentModel } from "./model";

type ArticleType = typeof testArticleContentType;

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
      // The declared defaults come from `schemas.create`, and match the column
      // defaults exactly - both are generated from the same descriptor.
      expect(opsOf(calls, "values")[0]).toEqual({
        category: 2,
        featured: false,
        status: "draft",
        title: "Hello",
        views: 0,
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

  // The generated routes validate too, but the service is a public API: a
  // plugin can call it straight from its own route, and the Content Engine's
  // invariants have to survive that.
  describe("create validation", () => {
    const create = (values: Record<string, unknown>) => {
      const { c, calls } = createDbMock([[{ id: 1 }]]);
      // Deliberately ill-typed input: these tests exist to prove the *runtime*
      // guard holds for callers that reached the service some other way.
      const run = articles
        .service(c)
        .create(values as unknown as ContentCreateInput<ArticleType>);

      return { calls, run };
    };

    const rejects = async (values: Record<string, unknown>) => {
      const { calls, run } = create(values);

      await expect(run).rejects.toBeInstanceOf(ZodError);

      return calls;
    };

    it("rejects text shorter than minLength", async () => {
      await rejects({ category: 1, title: "no" });
    });

    it("rejects text longer than maxLength", async () => {
      await rejects({ category: 1, title: "x".repeat(201) });
    });

    it("rejects a value outside the enum", async () => {
      await rejects({ category: 1, status: "sideways", title: "Hello" });
    });

    it("rejects a number below min", async () => {
      await rejects({ category: 1, title: "Hello", views: -1 });
    });

    it("rejects an unknown field", async () => {
      await rejects({ category: 1, smuggled: true, title: "Hello" });
    });

    it("rejects a system field", async () => {
      await rejects({ category: 1, id: 99, title: "Hello" });
    });

    it("rejects a relation id that is not a positive integer", async () => {
      await rejects({ category: 0, title: "Hello" });
      await rejects({ category: 1.5, title: "Hello" });
    });

    it("rejects a malformed ISO date", async () => {
      await rejects({
        category: 1,
        publishedAt: "the day before yesterday",
        title: "Hello",
      });
    });

    it("never touches the database after a validation failure", async () => {
      const calls = await rejects({ category: 1, title: "no" });

      expect(calls).toHaveLength(0);
    });

    it("accepts a valid ISO date and stores it as a Date", async () => {
      const { calls, run } = create({
        category: 1,
        publishedAt: "2026-08-02T10:00:00.000Z",
        title: "Hello",
      });

      await run;

      const values = opsOf(calls, "values")[0] as { publishedAt: Date };
      expect(values.publishedAt).toBeInstanceOf(Date);
    });
  });

  describe("update validation", () => {
    const rejects = async (values: Record<string, unknown>) => {
      const { c, calls } = createDbMock([[{ id: 7, title: "Hello" }]]);

      await expect(
        articles
          .service(c)
          .update(7, values as unknown as ContentUpdateInput<ArticleType>),
      ).rejects.toBeInstanceOf(ZodError);

      return calls;
    };

    it("rejects an empty patch", async () => {
      await rejects({});
    });

    it("rejects an unknown field", async () => {
      await rejects({ smuggled: true });
    });

    it("rejects an invalid value", async () => {
      await rejects({ status: "sideways" });
    });

    it("validates before it reads the row", async () => {
      const calls = await rejects({ title: "no" });

      expect(calls).toHaveLength(0);
    });

    it("does not re-apply create defaults", async () => {
      const { c, calls } = createDbMock([
        [{ id: 7, status: "published", title: "Hello", views: 12 }],
        [{ id: 7, title: "Changed" }],
      ]);

      await articles.service(c).update(7, { title: "Changed" });

      expect(opsOf(calls, "set")[0]).toEqual({ title: "Changed" });
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
        articles.service(c).findMany({
          // @ts-expect-error - the typed filter map has no `nope`; the runtime
          // allowlist is what catches it when the keys come off a query string.
          filters: { nope: 1 },
        }),
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

      await expect(
        // @ts-expect-error - `title` has no picker; the runtime guard backs the
        // type up for the route, which reads the field name out of the URL.
        articles.service(c).options("title"),
      ).rejects.toThrow(/not a relation or user field/);
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
