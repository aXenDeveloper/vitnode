// @vitest-environment node
import type { Context } from "hono";

import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  testCategoryContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import { ContentEngineError } from "../errors";
import { createContentModel } from "./model";

const categories = createContentModel(testCategoryContentType);
const posts = createContentModel(testPostContentType, {
  references: { category: () => categories.table.id },
});

const dialect = new PgDialect();

interface RecordedCall {
  arg: unknown;
  op: string;
}

/** The same chainable Drizzle stand-in `service.test.ts` uses. */
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
      then: async <TResult>(resolve: (rows: unknown[]) => TResult) =>
        Promise.resolve(rows).then(resolve),
      where: (value: unknown) => record("where", value),
    };

    return builder;
  };

  const c = {
    get: (key: string) =>
      key === "db"
        ? {
            select: (arg: unknown) => {
              calls.push({ arg, op: "select" });

              return chain(queue.shift() ?? []);
            },
          }
        : undefined,
  } as Context;

  return { c, calls };
};

const opsOf = (calls: RecordedCall[], op: string) =>
  calls.filter(call => call.op === op).map(call => call.arg);

/** The compiled SQL of the last `where` the service handed Drizzle. */
const lastWhere = (calls: RecordedCall[]) => {
  const wheres = opsOf(calls, "where");
  const condition = wheres.at(-1);
  if (!condition) throw new Error("Expected a where clause.");

  return dialect.sqlToQuery(condition as never);
};

const publicService = (results: unknown[][]) => {
  const { c, calls } = createDbMock(results);
  const service = posts.publicService?.(c);
  if (!service) throw new Error("Expected a public service.");

  return { calls, service };
};

const storedRow = {
  category: 3,
  excerpt: "Prose",
  id: 12,
  publishedAt: new Date("2026-08-01T09:00:00.000Z"),
  slug: "hello-world",
  title: "Hello world",
};

describe("model.publicService", () => {
  it("exists only for a content type with a public API", () => {
    expect(posts.publicService).toBeDefined();
    expect(categories.publicService).toBeUndefined();
  });

  it("has no write methods at all", () => {
    const { service } = publicService([]);

    // Not "omitted from a filtered view" - there is nothing to omit, because
    // this is a different object from `model.service`.
    for (const method of [
      "create",
      "update",
      "delete",
      "publish",
      "unpublish",
      "options",
    ]) {
      expect(service).not.toHaveProperty(method);
    }

    expect(Object.keys(service).sort()).toEqual([
      "findById",
      "findBySlug",
      "findMany",
    ]);
  });
});

describe("the published invariant", () => {
  const PREDICATE =
    '(("test_posts"."status" = $1) and (("test_posts"."publishedAt" is not null)) and ("test_posts"."publishedAt" <= now()))';

  it("is applied by findBySlug", async () => {
    const { calls, service } = publicService([[storedRow]]);

    await service.findBySlug("hello-world");

    const { params, sql } = lastWhere(calls);
    expect(sql).toContain(PREDICATE);
    expect(sql).toContain('"test_posts"."slug" = ');
    expect(params).toEqual(["published", "hello-world"]);
  });

  it("is applied by findById", async () => {
    const { calls, service } = publicService([[storedRow]]);

    await service.findById(12);

    expect(lastWhere(calls).sql).toContain(PREDICATE);
    expect(lastWhere(calls).sql).toContain('"test_posts"."id" = ');
  });

  it("is applied by findMany", async () => {
    // A count query, then the page itself.
    const { calls, service } = publicService([[{ count: 0 }], []]);

    await service.findMany();

    expect(opsOf(calls, "where").length).toBeGreaterThan(0);
    expect(
      opsOf(calls, "where").some(condition =>
        dialect.sqlToQuery(condition as never).sql.includes(PREDICATE),
      ),
    ).toBe(true);
  });

  it("cannot be turned off by a caller", async () => {
    const { calls, service } = publicService([[{ count: 0 }], []]);

    // There is no `where` argument and no `includeDrafts` flag on
    // `ContentPublicFindManyArgs` - the predicate is not a parameter.
    await service.findMany({ filters: { category: 3 } });

    const combined = opsOf(calls, "where")
      .map(condition => dialect.sqlToQuery(condition as never).sql)
      .join(" ");
    expect(combined).toContain(PREDICATE);
  });
});

describe("projection", () => {
  it("selects only the allowlisted columns, plus id for the cursor", async () => {
    const { calls, service } = publicService([[storedRow]]);

    await service.findBySlug("hello-world");

    expect(Object.keys(opsOf(calls, "select")[0] as object).sort()).toEqual([
      "category",
      "excerpt",
      "id",
      "publishedAt",
      "slug",
      "title",
    ]);
  });

  it("never selects a private column", async () => {
    const { calls, service } = publicService([[storedRow]]);

    await service.findBySlug("hello-world");

    // `views`, `author` and `status` are not in `publicApi.fields`, so they do
    // not leave Postgres in the first place.
    const selected = Object.keys(opsOf(calls, "select")[0] as object);
    expect(selected).not.toContain("views");
    expect(selected).not.toContain("author");
    expect(selected).not.toContain("status");
  });

  it("returns exactly the allowlisted keys", async () => {
    const { service } = publicService([[storedRow]]);

    const row = await service.findBySlug("hello-world");

    expect(Object.keys(row ?? {}).sort()).toEqual([
      "category",
      "excerpt",
      "publishedAt",
      "slug",
      "title",
    ]);
  });

  it("drops the cursor id, which the allowlist does not name", async () => {
    // The one column fetched beyond the allowlist: `withPagination` reads the
    // cursor off the row. It is removed again here, and that is the whole
    // projection boundary.
    const { service } = publicService([[storedRow]]);

    expect(await service.findBySlug("hello-world")).not.toHaveProperty("id");
  });

  it("projects a relation down to an identifier", async () => {
    const { service } = publicService([[storedRow]]);

    expect(await service.findBySlug("hello-world")).toMatchObject({
      category: { id: 3 },
    });
  });

  it("puts no label on a relation", async () => {
    // The only label available is the target's `admin.titleField` - admin
    // metadata, from a row that may itself be a draft and may never have opted
    // into a public API at all.
    const row = await publicService([[storedRow]]).service.findBySlug("x");

    expect(row?.category).toEqual({ id: 3 });
    expect(row?.category).not.toHaveProperty("label");
  });

  it("joins nothing at all", async () => {
    const { calls, service } = publicService([[storedRow]]);

    await service.findBySlug("hello-world");

    // No target table is read, so no target column can be selected by mistake.
    expect(opsOf(calls, "leftJoin")).toHaveLength(0);
  });

  it("never selects the target's title column", async () => {
    const { calls, service } = publicService([[storedRow]]);

    await service.findBySlug("hello-world");

    // `test.category`'s `admin.titleField` is `title`, reached through the
    // `label__category` alias in the admin service. It is absent here.
    const selected = Object.keys(opsOf(calls, "select")[0] as object);
    expect(selected.some(name => name.startsWith("label__"))).toBe(false);
  });

  it("keeps a nullable relation null", async () => {
    const { service } = publicService([[{ ...storedRow, category: null }]]);

    expect((await service.findBySlug("hello-world"))?.category).toBeNull();
  });

  it("returns null for a missing row", async () => {
    const { service } = publicService([[]]);

    await expect(service.findBySlug("nope")).resolves.toBeNull();
  });
});

describe("filters", () => {
  it("accepts a configured filterable field", async () => {
    const { calls, service } = publicService([[{ count: 0 }], []]);

    await service.findMany({ filters: { category: 3 } });

    const combined = opsOf(calls, "where")
      .map(condition => dialect.sqlToQuery(condition as never))
      .find(query => query.sql.includes('"test_posts"."category" = '));
    expect(combined?.params).toContain(3);
  });

  it("rejects a field that is exposed but not filterable", async () => {
    const { service } = publicService([[{ count: 0 }], []]);

    // `title` is public, but `filterableFields` is `["category"]`. Being
    // readable does not make a column a query parameter.
    await expect(
      service.findMany({ filters: { title: "Hello" } }),
    ).rejects.toThrow(/Filter "title" is not in the allowlist/);
  });

  it("rejects a private field", async () => {
    const { service } = publicService([[{ count: 0 }], []]);

    await expect(
      service.findMany({
        filters: { views: 10 } as never,
      }),
    ).rejects.toBeInstanceOf(ContentEngineError);
  });

  it("rejects the publication status, so drafts cannot be asked for", async () => {
    const { service } = publicService([[{ count: 0 }], []]);

    await expect(
      service.findMany({ filters: { status: "draft" } as never }),
    ).rejects.toThrow(/not in the allowlist/);
  });
});

describe("search", () => {
  it("scans only the configured searchable columns", async () => {
    const { calls, service } = publicService([[{ count: 0 }], []]);

    await service.findMany({ query: { search: "hello" } });

    const combined = opsOf(calls, "where")
      .map(condition => dialect.sqlToQuery(condition as never).sql)
      .join(" ");
    expect(combined).toContain('"test_posts"."title" ilike');
    expect(combined).toContain('"test_posts"."excerpt" ilike');
    // A private column cannot be probed by searching for it either.
    expect(combined).not.toContain('"test_posts"."views"');
  });

  it("escapes the wildcards", async () => {
    const { calls, service } = publicService([[{ count: 0 }], []]);

    await service.findMany({ query: { search: "100%" } });

    const params = opsOf(calls, "where").flatMap(
      condition => dialect.sqlToQuery(condition as never).params,
    );
    expect(params).toContain("%100\\%%");
  });
});

describe("ordering", () => {
  it("accepts a column from the public allowlist", async () => {
    const { calls, service } = publicService([[{ count: 0 }], []]);

    await service.findMany({ orderBy: { column: "title", order: "asc" } });

    expect(opsOf(calls, "orderBy")).toHaveLength(1);
  });

  it("rejects a column the public allowlist does not name", async () => {
    const { service } = publicService([[{ count: 0 }], []]);

    // Orderable in the AdminCP, but the public list has its own, smaller list.
    await expect(
      service.findMany({ orderBy: { column: "createdAt" as never } }),
    ).rejects.toThrow(/Cannot order by "createdAt"/);
  });

  it("rejects a private column", async () => {
    const { service } = publicService([[{ count: 0 }], []]);

    await expect(
      service.findMany({ orderBy: { column: "views" as never } }),
    ).rejects.toThrow(/Cannot order by "views"/);
  });

  it("falls back to the configured default", async () => {
    const { calls, service } = publicService([[{ count: 0 }], []]);

    await service.findMany();

    expect(opsOf(calls, "orderBy")).toHaveLength(1);
  });
});

describe("pagination", () => {
  it("caps the page size below the admin limit", async () => {
    const { calls, service } = publicService([[{ count: 0 }], []]);

    await service.findMany({ query: { first: "500" } });

    // `withPagination` would otherwise clamp to 100 and ask for 101 rows.
    expect(opsOf(calls, "limit")[0]).toBe(51);
  });

  it("leaves a reasonable page size alone", async () => {
    const { calls, service } = publicService([[{ count: 0 }], []]);

    await service.findMany({ query: { first: "10" } });

    expect(opsOf(calls, "limit")[0]).toBe(11);
  });
});
