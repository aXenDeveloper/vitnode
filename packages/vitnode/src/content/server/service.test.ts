// @vitest-environment node
import type { PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { getTableName, SQL } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import {
  testArticleContentType,
  testCategoryContentType,
  testLocalizedCategoryContentType,
  testLocalizedRelationArticleContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import type {
  ContentCreateInput,
  ContentFilterInput,
  ContentUpdateInput,
} from "../types";

import { defineContentType } from "../define";
import { ContentEngineError, ContentInputError } from "../errors";
import { field } from "../fields";
import { createContentModel } from "./model";

type ArticleType = typeof testArticleContentType;

const categories = createContentModel(testCategoryContentType);
const articles = createContentModel(testArticleContentType, {
  references: { category: () => categories.table.id },
});
const posts = createContentModel(testPostContentType, {
  references: { category: () => categories.table.id },
});
const localizedCategories = createContentModel(
  testLocalizedCategoryContentType,
);
const localizedRelationArticles = createContentModel(
  testLocalizedRelationArticleContentType,
  { references: { category: () => localizedCategories.table.id } },
);

interface RecordedCall {
  arg: unknown;
  op: string;
}

/**
 * A chainable stand-in for the Drizzle client. Each top-level `select`,
 * `insert`, `update` or `delete` shifts the next queued result, and every
 * builder call is recorded so tests can assert on the shape of the query.
 */
const createDbMock = (
  results: unknown[][],
  /**
   * Anything else the service reads off the context - `i18n`, for the locale a
   * relation label is resolved in. Everything the Stage 1-8 suites drive needs
   * only `db`, so the default keeps them byte-identical.
   */
  variables: Record<string, unknown> = {},
) => {
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
    get: (key: string) => (key === "db" ? db : variables[key]),
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
          {
            __cursorValue: "2026-01-02 00:00:00",
            id: 1,
            label__author: "Ada",
            label__category: "News",
          },
          {
            __cursorValue: "2026-01-01 00:00:00",
            id: 2,
            label__author: null,
            label__category: "News",
          },
        ]),
      );

      await articles.service(c).findMany();

      // `author` and `category` - one join each, and no per-row lookup.
      expect(opsOf(calls, "leftJoin")).toHaveLength(2);
      // Two, and both constant: the count and the page. There is no third
      // read to mint the cursors, because the page query already selected the
      // value they are made of - which is also what makes a cursor describe
      // where the row was rather than where it has since moved.
      expect(opsOf(calls, "select")).toHaveLength(2);
    });

    it("splits the joined labels out of the row", async () => {
      const { c } = createDbMock(
        page([
          {
            __cursorValue: "2026-01-02 00:00:00",
            id: 1,
            label__author: "Ada",
            label__category: "News",
          },
        ]),
      );

      const { edges } = await articles.service(c).findMany();

      // No `__cursorValue`: pagination takes its own column back before the
      // row reaches anybody.
      expect(edges[0]).toEqual({
        id: 1,
        labels: { author: "Ada", category: "News" },
      });
    });

    it("reports a missing label as null", async () => {
      const { c } = createDbMock(
        page([
          {
            __cursorValue: "2026-01-02 00:00:00",
            id: 1,
            label__author: null,
            label__category: "News",
          },
        ]),
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

    it.each([
      ["textarea", { excerpt: "prose" }],
      ["dateTime", { publishedAt: "2026-08-03T10:00:00.000Z" }],
    ])("rejects a %s filter forced past the type check", async (_kind, raw) => {
      const { c, calls } = createDbMock(page([]));

      await expect(
        articles
          .service(c)
          .findMany({ filters: raw as ContentFilterInput<ArticleType> }),
      ).rejects.toThrow(/cannot be used as a generated equality filter/);
      expect(calls).toHaveLength(0);
    });

    it("filters a nullable field by null", async () => {
      const { c } = createDbMock(page([]));

      await expect(
        articles.service(c).findMany({ filters: { author: null } }),
      ).resolves.toMatchObject({ edges: [] });
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

    it("returns a face and a handle for a user field", async () => {
      // What lets the author picker show people rather than a list of names. A
      // `relation` gets neither, because its target has neither.
      const { c } = createDbMock([
        [{ avatarColor: "3b82f6", label: "Ada", nameCode: "ada", value: 4 }],
      ]);

      await expect(articles.service(c).options("author")).resolves.toEqual([
        { avatarColor: "3b82f6", label: "Ada", nameCode: "ada", value: 4 },
      ]);
    });

    it("leaves a relation's options as label and value alone", async () => {
      const { c } = createDbMock([[{ label: "News", value: 3 }]]);

      const options = await articles.service(c).options("category");

      expect(Object.keys(options[0]).sort()).toEqual(["label", "value"]);
    });
  });

  /**
   * A relation whose target names a **localized** field as its title.
   *
   * `test.localized-category` keeps its `name` on `test_localized_categories_translations`,
   * so the base table has nothing to join to and the id is all a plain label
   * resolver could produce. What is asserted here is the generic fix: two joins
   * onto the target's translation table - the reader's language and the
   * target's own default - and a `coalesce` between them.
   */
  describe("a localized relation label", () => {
    /** `core_languages`, as the registry query returns it. */
    const LANGUAGES = [
      { code: "en", id: 1, isDefault: true },
      { code: "pl", id: 2, isDefault: false },
    ];
    const readingIn = (locale: string) => ({
      i18n: { resolveLocale: () => locale },
    });

    /** The alias each `leftJoin` was given, in order. */
    const joinedAliases = (calls: RecordedCall[]) =>
      opsOf(calls, "leftJoin").map(value => getTableName(value as PgTable));

    it("joins the reader's language and the target's default", async () => {
      const { c, calls } = createDbMock(
        [LANGUAGES, [{ id: 1, label__category: "Aktualności" }]],
        readingIn("pl"),
      );

      const row = await localizedRelationArticles.service(c).findRowById(1);

      expect(joinedAliases(calls)).toEqual([
        "label__category",
        "label__category__locale",
        "label__category__default",
      ]);
      // Read off the same `label__` key the shared path uses, so nothing
      // downstream of the service has to know where the value came from.
      expect(row?.labels).toEqual({ category: "Aktualności" });
    });

    it("selects the label as an expression rather than a column", async () => {
      const { c, calls } = createDbMock(
        [LANGUAGES, [{ id: 1, label__category: "Aktualności" }]],
        readingIn("pl"),
      );

      await localizedRelationArticles.service(c).findRowById(1);

      const selection = opsOf(calls, "select")[1] as Record<string, unknown>;

      expect(selection.label__category).toBeInstanceOf(SQL);
    });

    it("joins once when the reader is already in the target's language", async () => {
      const { c, calls } = createDbMock(
        [LANGUAGES, [{ id: 1, label__category: "News" }]],
        // `en` *is* the category's `defaultLocale`, so the fallback would be the
        // same row twice.
        readingIn("en"),
      );

      await localizedRelationArticles.service(c).findRowById(1);

      expect(joinedAliases(calls)).toEqual([
        "label__category",
        "label__category__locale",
      ]);
    });

    it("falls back to the target's own language for a locale that has none", async () => {
      const { c, calls } = createDbMock(
        [LANGUAGES, [{ id: 1, label__category: "News" }]],
        // Not a row in `core_languages`: the reader gets the default language's
        // name rather than the numeric id.
        readingIn("de"),
      );

      const row = await localizedRelationArticles.service(c).findRowById(1);

      expect(joinedAliases(calls)).toEqual([
        "label__category",
        "label__category__default",
      ]);
      expect(row?.labels.category).toBe("News");
    });

    it("labels a list the same way, still without a per-row lookup", async () => {
      const { c, calls } = createDbMock(
        [
          LANGUAGES,
          [{ count: 2 }],
          [
            {
              __cursorValue: "2026-01-02 00:00:00",
              id: 1,
              label__category: "Aktualności",
            },
            {
              __cursorValue: "2026-01-01 00:00:00",
              id: 2,
              label__category: null,
            },
          ],
        ],
        readingIn("pl"),
      );

      const { edges } = await localizedRelationArticles.service(c).findMany();

      expect(edges.map(edge => edge.labels.category)).toEqual([
        "Aktualności",
        null,
      ]);
      // The registry, the count and the page. No fourth read, and nothing per
      // row.
      expect(opsOf(calls, "select")).toHaveLength(3);
      expect(joinedAliases(calls)).toEqual([
        "label__category",
        "label__category__locale",
        "label__category__default",
      ]);
    });

    it("resolves the picker's options in the reader's language", async () => {
      const { c, calls } = createDbMock(
        [LANGUAGES, [{ label: "Aktualności", value: 3 }]],
        readingIn("pl"),
      );

      await expect(
        localizedRelationArticles.service(c).options("category", "aktual"),
      ).resolves.toEqual([{ label: "Aktualności", value: 3 }]);

      // The picker reads *from* the category table and hangs both translation
      // joins off it, so the option it offers is the one the reader will see in
      // the table afterwards.
      expect(joinedAliases(calls)).toEqual([
        "label__category__locale",
        "label__category__default",
      ]);
    });

    it("still falls back to the identifier when no language has a name", async () => {
      const { c } = createDbMock(
        [LANGUAGES, [{ label: null, value: 3 }]],
        readingIn("pl"),
      );

      await expect(
        localizedRelationArticles.service(c).options("category"),
      ).resolves.toEqual([{ label: "3", value: 3 }]);
    });

    it("reads no language registry for a target with a shared title", async () => {
      const { c, calls } = createDbMock(
        [[{ id: 1, label__author: "Ada", label__category: "News" }]],
        readingIn("pl"),
      );

      await articles.service(c).findRowById(1);

      // One query, and two joins - exactly what a Stage 1 content type has
      // always produced.
      expect(opsOf(calls, "select")).toHaveLength(1);
      expect(joinedAliases(calls)).toEqual([
        "label__author",
        "label__category",
      ]);
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

  describe("publication", () => {
    const published = {
      id: 1,
      publishedAt: new Date("2026-08-01T09:00:00.000Z"),
      status: "published",
      title: "Hello",
    };
    const draft = { ...published, status: "draft" };

    it("is absent from a content type without publication", () => {
      const service = articles.service(createDbMock([]).c);

      expect(service.publish).toBeUndefined();
      expect(service.unpublish).toBeUndefined();
    });

    describe("publish", () => {
      it("writes the status and coalesces the publication date", async () => {
        const { c, calls } = createDbMock([[published]]);

        const result = await posts.service(c).publish?.(1);

        expect(result).toEqual({
          changed: true,
          publishedAt: published.publishedAt,
          row: published,
        });
        // COALESCE, so a republish keeps the original date - it is passed as
        // SQL rather than a JS value on purpose.
        expect(opsOf(calls, "set")).toHaveLength(1);
        expect(opsOf(calls, "set")[0]).toMatchObject({ status: "published" });
        // One statement in the happy path: no read-then-write race.
        expect(opsOf(calls, "select")).toHaveLength(0);
      });

      it("is a no-op when the row is already published", async () => {
        // The conditional UPDATE matches nothing, so the follow-up read is what
        // tells "already published" apart from "no such row".
        const { c, calls } = createDbMock([[], [published]]);

        const result = await posts.service(c).publish?.(1);

        expect(result).toEqual({
          changed: false,
          publishedAt: published.publishedAt,
          row: published,
        });
        expect(opsOf(calls, "select")).toHaveLength(1);
      });

      it("returns null when the row does not exist", async () => {
        const { c } = createDbMock([[], []]);

        await expect(posts.service(c).publish?.(1)).resolves.toBeNull();
      });

      it("joins a caller's transaction", async () => {
        const { c } = createDbMock([]);
        const outer = createDbMock([[published]]);

        await posts.service(c).publish?.(1, { tx: outer.c.get("db") });

        expect(opsOf(outer.calls, "update")).toHaveLength(1);
      });
    });

    describe("unpublish", () => {
      it("flips the status and leaves the publication date alone", async () => {
        const { c, calls } = createDbMock([[draft]]);

        const result = await posts.service(c).unpublish?.(1);

        expect(result).toEqual({
          changed: true,
          publishedAt: draft.publishedAt,
          row: draft,
        });
        // `publishedAt` means "first published at", so unpublishing must not
        // clear it - a republish would otherwise reorder the public feed.
        expect(opsOf(calls, "set")).toEqual([{ status: "draft" }]);
      });

      it("is a no-op when the row is already a draft", async () => {
        const { c } = createDbMock([[], [draft]]);

        await expect(posts.service(c).unpublish?.(1)).resolves.toMatchObject({
          changed: false,
        });
      });

      it("returns null when the row does not exist", async () => {
        const { c } = createDbMock([[], []]);

        await expect(posts.service(c).unpublish?.(1)).resolves.toBeNull();
      });
    });

    it("selects the generated columns on every read", async () => {
      const { c, calls } = createDbMock([[published]]);

      await posts.service(c).findById(1);

      expect(Object.keys(opsOf(calls, "select")[0] as object)).toEqual(
        expect.arrayContaining(["status", "publishedAt"]),
      );
    });
  });

  describe("slug", () => {
    const createPost = async (values: Record<string, unknown>) => {
      const { c, calls } = createDbMock([[{ id: 1 }]]);

      await posts
        .service(c)
        .create(values as ContentCreateInput<typeof testPostContentType>);

      return opsOf(calls, "values")[0] as Record<string, unknown>;
    };

    const updatePost = async (
      current: Record<string, unknown>,
      values: Record<string, unknown>,
    ) => {
      const { c, calls } = createDbMock([[current], [{ ...current }]]);

      await posts.service(c).update(1, values);

      return opsOf(calls, "set")[0] as Record<string, unknown> | undefined;
    };

    describe("create", () => {
      it("derives the slug from the source field", async () => {
        const values = await createPost({ category: 2, title: "Hello World" });

        expect(values.slug).toBe("hello-world");
      });

      it("normalises a slug the caller supplied", async () => {
        const values = await createPost({
          category: 2,
          slug: "  Hello   World! ",
          title: "Something else",
        });

        // Supplied, so the source is ignored - but it is still normalised,
        // because the same rules have to hold whoever wrote the value.
        expect(values.slug).toBe("hello-world");
      });

      it("transliterates the source", async () => {
        const values = await createPost({ category: 2, title: "Zażółć gęślą" });

        expect(values.slug).toBe("zazolc-gesla");
      });

      it("rejects a source that folds to nothing", async () => {
        // No random suffix and no numeric fallback: an unaddressable row is
        // refused, and the message says how to fix it.
        await expect(
          createPost({ category: 2, title: "日本語のタイトル" }),
        ).rejects.toThrow(/Could not derive "slug" from "title"/);
      });

      it("rejects a supplied slug that folds to nothing", async () => {
        await expect(
          createPost({ category: 2, slug: "!!!", title: "Fine title" }),
        ).rejects.toThrow(/normalises to an empty slug/);
      });

      it("reports the failure as a client error", async () => {
        // `ContentInputError` is what the generated routes turn into a 400;
        // every other engine error is a configuration bug and a 500.
        await expect(
          createPost({ category: 2, title: "🎉🎉🎉" }),
        ).rejects.toBeInstanceOf(ContentInputError);
      });

      it("truncates to the descriptor's maxLength", async () => {
        const short = createContentModel(
          defineContentType({
            id: "test.short-slug",
            tableName: "test_short_slugs",
            fields: {
              title: field.text({ required: true }),
              slug: field.slug({ maxLength: 8, source: "title" }),
            },
          }),
        );
        const { c, calls } = createDbMock([[{ id: 1 }]]);

        await short.service(c).create({ title: "Hello World" });

        expect((opsOf(calls, "values")[0] as { slug: string }).slug).toBe(
          "hello-wo",
        );
      });
    });

    describe("update", () => {
      const stored = { id: 1, slug: "hello-world", title: "Hello World" };

      it("leaves the slug alone when the source field changes", async () => {
        // The whole point of a slug: a published URL does not move because
        // somebody fixed a typo in the title.
        const set = await updatePost(stored, { title: "Goodbye World" });

        expect(set).toEqual({ title: "Goodbye World" });
        expect(set).not.toHaveProperty("slug");
      });

      it("changes the slug when it is sent explicitly", async () => {
        const set = await updatePost(stored, { slug: "Brand New Slug" });

        expect(set).toEqual({ slug: "brand-new-slug" });
      });

      it("treats a re-sent slug as no change", async () => {
        // Normalised before the diff, so "Hello World" and "hello-world" are
        // the same stored value and the write is skipped.
        const set = await updatePost(stored, { slug: "Hello World" });

        expect(set).toBeUndefined();
      });

      it("rejects a slug that folds to nothing", async () => {
        await expect(updatePost(stored, { slug: "???" })).rejects.toThrow(
          ContentInputError,
        );
      });

      it("never re-derives from the source", async () => {
        const set = await updatePost(stored, {
          slug: "explicit-one",
          title: "A Totally New Title",
        });

        expect(set).toEqual({
          slug: "explicit-one",
          title: "A Totally New Title",
        });
      });
    });
  });
});
