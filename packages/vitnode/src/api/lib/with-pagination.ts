import type { ColumnBaseConfig, Placeholder, SQL } from "drizzle-orm";
import type {
  PgColumn,
  PgTable,
  PgTableWithColumns,
  TableConfig,
} from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { and, asc, count, desc, gt, ilike, lt, or, sql } from "drizzle-orm";

function parsePaginationParams(params: {
  query: { cursor?: string; first?: string; last?: string };
}): { cursor?: number; first?: number; last?: number } {
  const cursor = params.query.cursor
    ? parseInt(params.query.cursor, 10)
    : undefined;
  const first = params.query.first
    ? Math.min(parseInt(params.query.first, 10), 100)
    : undefined;
  const last = params.query.last
    ? Math.min(parseInt(params.query.last, 10), 100)
    : undefined;

  if (first !== undefined && last !== undefined) {
    throw new Error("Cannot specify both first and last");
  }
  if (first !== undefined && first < 0) {
    throw new Error("first must be positive");
  }
  if (last !== undefined && last < 0) {
    throw new Error("last must be positive");
  }

  return { cursor, first, last };
}

function getOrderFn(
  isForward: boolean,
  order: "asc" | "desc",
): typeof asc | typeof desc {
  if (isForward) {
    return order === "asc" ? asc : desc;
  }

  return order === "asc" ? desc : asc;
}

function buildWhereWithCursor<
  Primary extends ColumnBaseConfig<"number", string>,
>(
  baseWhere: SQL | undefined,
  cursor: number | undefined,
  isForward: boolean,
  order: "asc" | "desc",
  table: PgTable,
  primaryCursor: PgColumn<Primary>,
): SQL | undefined {
  if (!cursor) return baseWhere;

  const cursorFilter =
    (isForward && order === "asc") || (!isForward && order === "desc")
      ? gt
      : lt;

  const cursorWhere = cursorFilter(table[primaryCursor.name], cursor);

  return baseWhere ? and(baseWhere, cursorWhere) : cursorWhere;
}

function buildSearchWhere(
  search: PgColumn[] | undefined,
  term: string | undefined,
): SQL | undefined {
  const trimmed = term?.trim();
  if (!search?.length || !trimmed) return undefined;

  return or(...search.map(column => ilike(column, `%${trimmed}%`)));
}

async function fetchTotalCount(
  c: Context,
  table: PgTable,
  where: SQL | undefined,
): Promise<number> {
  const [{ count: totalCount }] = await c
    .get("db")
    .select({ count: count() })
    .from(table)
    .where(where);

  return totalCount;
}

export async function withPagination<
  QueryMin extends Record<string, unknown>,
  T extends TableConfig,
  Primary extends ColumnBaseConfig<"number", string>,
>({
  query,
  table,
  params,
  search,
  where: whereFromParams,
  primaryCursor,
  orderBy: orderByFromParams,
  c,
}: {
  c: Context;
  orderBy: {
    column: PgColumn;
    order: "asc" | "desc";
  };
  params: {
    query: {
      cursor?: string;
      first?: string;
      last?: string;
      search?: string;
    };
  };
  primaryCursor: PgColumn<Primary>;
  query: (args: {
    limit: number | Placeholder<string, unknown>;
    orderBy: SQL;
    where: SQL | undefined;
  }) => Promise<QueryMin[]>;
  search?: T["columns"][keyof T["columns"]][];
  table: Omit<PgTableWithColumns<T>, "enableRLS">;
  where?: SQL;
}): Promise<{
  edges: QueryMin[];
  pageInfo: {
    count: number;
    endCursor: null | number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: null | number;
    totalCount: number;
  };
}> {
  const { cursor, first, last } = parsePaginationParams(params);

  const isForward = last === undefined;
  const orderFn = getOrderFn(isForward, orderByFromParams.order);
  const primary = table[primaryCursor.name];
  const ordered = orderFn(table[orderByFromParams.column.name]);
  /**
   * The primary key, appended as a tiebreaker.
   *
   * Without it the ordering is only a partial one: every row that shares an
   * `updatedAt` - a bulk import, a migration backfill, a batch publish - sits in
   * an arbitrary position that Postgres is free to change between the two
   * queries a page turn issues. The cursor is the identifier, so an arbitrary
   * position means a row can be skipped or returned twice for no reason except
   * that the page boundary fell inside a tie.
   *
   * Appending the identifier makes the ordering total, in the same direction the
   * cursor compares in, so the two agree. It costs nothing when the order column
   * is already unique.
   *
   * What it does **not** fix, and what the pagination docs state plainly: the
   * cursor is the identifier, so ordering by a column with no relationship to it
   * - a title, say - still cannot page exactly. Ordering by the identifier, or
   * by a timestamp that moves with it, is exact.
   */
  const orderBy: SQL =
    orderByFromParams.column.name === primaryCursor.name
      ? ordered
      : sql`${ordered}, ${orderFn(primary)}`;

  const searchWhere = buildSearchWhere(search, params.query.search);
  const baseWhere =
    whereFromParams && searchWhere
      ? and(whereFromParams, searchWhere)
      : (whereFromParams ?? searchWhere);

  const where = buildWhereWithCursor(
    baseWhere,
    cursor,
    isForward,
    orderByFromParams.order,
    table,
    primaryCursor,
  );

  const totalCount = await fetchTotalCount(c, table, baseWhere);

  const limit = (first ?? last ?? 50) + 1;
  const edges = await query({ limit, where, orderBy });

  const requested = first ?? last ?? edges.length;
  const hasMore = edges.length > requested;
  const slicedEdges = edges.slice(0, requested);
  const finalEdges = isForward ? slicedEdges : slicedEdges.reverse();

  const startCursor: null | number =
    (finalEdges[0]?.[primaryCursor.name] as number) ?? null;
  const endCursor: null | number =
    (finalEdges.at(-1)?.[primaryCursor.name] as number) ?? null;

  return {
    pageInfo: {
      totalCount,
      count: finalEdges.length,
      hasNextPage: isForward ? hasMore : !!cursor,
      hasPreviousPage: isForward ? !!cursor : hasMore,
      startCursor,
      endCursor,
    },
    edges: finalEdges,
  };
}

export const zodPaginationPageInfo = z.object({
  totalCount: z.number(),
  count: z.number(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
  startCursor: z.number().nullable(),
  endCursor: z.number().nullable(),
});

export const zodPaginationQuery = z.object({
  cursor: z.string().optional(),
  first: z.string().optional(),
  last: z.string().optional(),
});
