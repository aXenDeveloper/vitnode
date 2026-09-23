// @vitest-environment node
import type { SQL } from "drizzle-orm";
import type { Context } from "hono";

import { PgDialect, pgTable } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import { encodePaginationCursor } from "./pagination-cursor";
import { withPagination } from "./with-pagination";

const rows = pgTable("bench_rows", t => ({
  id: t.serial().primaryKey(),
  name: t.varchar({ length: 255 }).notNull(),
  createdAt: t.timestamp().notNull(),
  archivedAt: t.timestamp(),
}));

const dialect = new PgDialect();

const sqlOf = (statement: SQL | undefined): string =>
  statement === undefined ? "" : dialect.sqlToQuery(statement).sql;

const contextWithCount = (totalCount: number): Context =>
  ({
    get: (key: string) =>
      key === "db"
        ? {
            select: () => ({
              from: () => ({
                where: async () =>
                  await Promise.resolve([{ count: totalCount }]),
              }),
            }),
          }
        : undefined,
  }) as unknown as Context;

const cursorFor = (column: "archivedAt" | "createdAt" | "name") =>
  encodePaginationCursor({
    column,
    id: 4242,
    value: column === "name" ? "user_500" : "2025-01-01 10:00:00",
  });

const nullCursorFor = (column: "archivedAt") =>
  encodePaginationCursor({ column, id: 4242, value: null });

interface PageQuery {
  cursor?: string;
  first?: string;
  last?: string;
  page?: string;
}

const pageRequest = async ({
  order = "desc",
  orderColumn = rows.createdAt,
  query,
  totalCount = 0,
}: {
  order?: "asc" | "desc";
  orderColumn?:
    | typeof rows.archivedAt
    | typeof rows.createdAt
    | typeof rows.id
    | typeof rows.name;
  query: PageQuery;
  totalCount?: number;
}) => {
  const seen = vi.fn<
    (args: { offset: number; where: SQL | undefined }) => Promise<[]>
  >(async () => await Promise.resolve([]));

  const { pageInfo } = await withPagination({
    c: contextWithCount(totalCount),
    orderBy: { column: orderColumn, order },
    params: { query },
    primaryCursor: rows.id,
    query: seen,
    table: rows,
  });

  return { ...seen.mock.calls[0][0], pageInfo };
};

const pageFor = async (args: {
  cursor: string;
  order?: "asc" | "desc";
  orderColumn?:
    | typeof rows.archivedAt
    | typeof rows.createdAt
    | typeof rows.id
    | typeof rows.name;
}) => {
  const { cursor, ...rest } = args;

  return sqlOf(
    (await pageRequest({ ...rest, query: { cursor, first: "10" } })).where,
  );
};

describe("cursor predicate", () => {
  it("compares the ordered tuple as a tuple, so an index can be navigated", async () => {
    expect(await pageFor({ cursor: cursorFor("createdAt") })).toContain(
      '("bench_rows"."createdAt", "bench_rows"."id") < ',
    );
  });

  it("never expands the tuple into an OR of its halves", async () => {
    const where = await pageFor({ cursor: cursorFor("createdAt") });

    expect(where).not.toContain(" or ");
    expect(where).not.toContain(" = $");
  });

  it("orders ascending with the tuple the other way round", async () => {
    const where = await pageFor({
      cursor: cursorFor("name"),
      order: "asc",
      orderColumn: rows.name,
    });

    expect(where).toContain('("bench_rows"."name", "bench_rows"."id") > ');
    expect(where).not.toContain(" or ");
  });

  it("asks for the trailing null block beside the tuple when the column is nullable", async () => {
    const where = await pageFor({
      cursor: cursorFor("archivedAt"),
      order: "asc",
      orderColumn: rows.archivedAt,
    });

    expect(where).toContain(
      '("bench_rows"."archivedAt", "bench_rows"."id") > ',
    );
    expect(where).toContain('"bench_rows"."archivedAt" is null');
  });

  it("leaves the null block alone when ordering descending, which starts inside it", async () => {
    const where = await pageFor({
      cursor: cursorFor("archivedAt"),
      orderColumn: rows.archivedAt,
    });

    expect(where).toContain(
      '("bench_rows"."archivedAt", "bench_rows"."id") < ',
    );
    expect(where).not.toContain("is null");
  });

  it("walks the null block itself when the cursor is inside it", async () => {
    const where = await pageFor({
      cursor: nullCursorFor("archivedAt"),
      order: "asc",
      orderColumn: rows.archivedAt,
    });

    expect(where).toContain('"bench_rows"."archivedAt" is null');
    expect(where).not.toContain(', "bench_rows"."id") > ');
  });

  it("asks for no cursor predicate at all when a page number was given", async () => {
    const seen = await pageRequest({
      query: { first: "10", page: "3" },
      totalCount: 100,
    });

    expect(sqlOf(seen.where)).toBe("");
    expect(seen.offset).toBe(20);
  });

  it("compares the identifier alone when the list is ordered by it", async () => {
    const where = await pageFor({
      cursor: encodePaginationCursor({ column: "id", id: 4242, value: 4242 }),
      orderColumn: rows.id,
    });

    expect(where).toBe('"bench_rows"."id" < $1');
  });
});

describe("numbered pages", () => {
  it("skips the pages before the one asked for", async () => {
    expect(
      (
        await pageRequest({
          query: { first: "20", page: "4" },
          totalCount: 500,
        })
      ).offset,
    ).toBe(60);
  });

  it("starts at the beginning when no page was asked for", async () => {
    const seen = await pageRequest({ query: { first: "20" } });

    expect(seen.offset).toBe(0);
    expect(seen.pageInfo.currentPage).toBeNull();
  });

  it("reports how many pages the total divides into", async () => {
    const { pageInfo } = await pageRequest({
      query: { first: "10", page: "2" },
      totalCount: 95,
    });

    expect(pageInfo.totalPages).toBe(10);
    expect(pageInfo.currentPage).toBe(2);
  });

  it("clamps a page past the end onto the last one", async () => {
    const seen = await pageRequest({
      query: { first: "10", page: "9999" },
      totalCount: 95,
    });

    expect(seen.pageInfo.currentPage).toBe(10);
    expect(seen.offset).toBe(90);
  });

  it("stays on the first page when there is nothing to show", async () => {
    const seen = await pageRequest({
      query: { first: "10", page: "7" },
      totalCount: 0,
    });

    expect(seen.pageInfo.currentPage).toBe(1);
    expect(seen.pageInfo.totalPages).toBe(0);
    expect(seen.offset).toBe(0);
  });

  it("refuses a page and a cursor together", async () => {
    await expect(
      pageRequest({ query: { cursor: cursorFor("createdAt"), page: "2" } }),
    ).rejects.toThrow(/either "page" or "cursor"/);
  });

  it("refuses a page and a backwards walk together", async () => {
    await expect(
      pageRequest({ query: { last: "10", page: "2" } }),
    ).rejects.toThrow(/either "page" or "last"/);
  });
});
