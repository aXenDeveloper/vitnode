import type { ColumnBaseConfig, Placeholder, SQL } from "drizzle-orm";
import type {
  PgColumn,
  PgTable,
  PgTableWithColumns,
  TableConfig,
} from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type { PaginationCursor } from "./pagination-cursor";

import {
  cursorValueForColumn,
  cursorValueIsCanonicalText,
  cursorValueOf,
  decodePaginationCursor,
  encodePaginationCursor,
  isCursorSortableColumn,
} from "./pagination-cursor";

/** Nobody may ask for more than this in one page, whatever they send. */
const MAX_PAGE_SIZE = 100;

/**
 * Reads `first`, `last` and `cursor`, or refuses the request with a 400.
 *
 * Refusing rather than repairing is the change worth noting. `first=0` used to
 * clamp its way into a one-row page that reported `hasNextPage: true`, and
 * `first=abc` became `NaN` and fell through to the default page size - both of
 * them a request nobody made, answered as if they had. Every one of these is now
 * a stable 400, and the route schema rejects most of them a step earlier.
 */
function parsePaginationParams(params: {
  query: { cursor?: string; first?: string; last?: string };
}): { cursor?: string; first?: number; last?: number } {
  const size = (raw: string | undefined, name: string): number | undefined => {
    if (raw === undefined || raw === "") return undefined;

    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
      throw new HTTPException(400, {
        message: `"${name}" must be a whole number greater than zero.`,
      });
    }

    return Math.min(parsed, MAX_PAGE_SIZE);
  };

  const first = size(params.query.first, "first");
  const last = size(params.query.last, "last");

  if (first !== undefined && last !== undefined) {
    throw new HTTPException(400, {
      message: 'Use either "first" or "last", not both.',
    });
  }

  const cursor = params.query.cursor?.trim();

  return { cursor: cursor === "" ? undefined : cursor, first, last };
}

/**
 * Which way the rows really come back.
 *
 * Backward pagination runs the query in reverse and flips the page afterwards,
 * so the *effective* SQL direction is not the one the caller asked for - and
 * the cursor predicate has to describe the effective one, or it would be reading
 * a sequence the `ORDER BY` is not producing.
 */
function effectiveDirection(
  isForward: boolean,
  order: "asc" | "desc",
): "asc" | "desc" {
  if (isForward) return order;

  return order === "asc" ? "desc" : "asc";
}

/**
 * `and`/`or` given at least one defined condition always produce SQL.
 *
 * Stated as a check rather than a non-null assertion: the assertion would be a
 * claim about code somewhere else, and this is a claim about the two lines above
 * it - which is the kind that stays true.
 */
function required(value: SQL | undefined): SQL {
  if (!value) throw new Error("Expected a pagination condition.");

  return value;
}

/**
 * "Strictly after this position, in this direction."
 *
 * The whole keyset, written out. `(column, id)` is the ordered tuple, so the
 * predicate is the tuple comparison - not a comparison of one half of it:
 *
 * ```sql
 * column > :value OR (column = :value AND id > :id)   -- ascending
 * column < :value OR (column = :value AND id < :id)   -- descending
 * ```
 *
 * `:value` comes from the **cursor** and nowhere else. That is the invariant a
 * cursor exists to provide: it is the position as it stood when the page was
 * generated, so editing the row that happened to sit on the boundary must not
 * move it. Reading the row's current value instead would mean one edit silently
 * skips every row the ordering used to have between the old position and the
 * new one - and deleting it would leave no position at all.
 *
 * The `NULL` branches are the part that is easy to get wrong. Postgres sorts
 * `NULLS LAST` for `ASC` and `NULLS FIRST` for `DESC`, and `column > NULL` is
 * `NULL` rather than true - so a nullable order column needs the null block
 * named explicitly, or a page boundary landing on it would end the walk early
 * and silently.
 */
function buildCursorCondition({
  column,
  cursor,
  direction,
  isPrimaryOrder,
  primary,
}: {
  column: PgColumn;
  cursor: PaginationCursor;
  direction: "asc" | "desc";
  isPrimaryOrder: boolean;
  primary: PgColumn;
}): SQL {
  const after = direction === "asc" ? gt : lt;

  // The identifier is the whole tuple when the list is ordered by it, so there
  // is no second half to compare and no null block to worry about.
  if (isPrimaryOrder) return after(primary, cursor.id);

  const boundary = boundaryValue(column, cursor);

  if (direction === "asc") {
    // NULLS LAST: a null cursor is inside the trailing block, and everything
    // that is not null is already behind us.
    if (cursor.value === null) {
      return required(and(isNull(column), gt(primary, cursor.id)));
    }

    return required(
      or(
        gt(column, boundary),
        and(eq(column, boundary), gt(primary, cursor.id)),
        isNull(column),
      ),
    );
  }

  // NULLS FIRST: a null cursor is inside the *leading* block, so the rest of
  // that block comes first and every non-null row follows it.
  if (cursor.value === null) {
    return required(
      or(and(isNull(column), lt(primary, cursor.id)), isNotNull(column)),
    );
  }

  return required(
    or(lt(column, boundary), and(eq(column, boundary), lt(primary, cursor.id))),
  );
}

/**
 * The cursor's own value, bound so Postgres compares it at full precision.
 *
 * Two shapes, because two kinds of value survive a round trip differently:
 *
 * - a **date** travels as the database's own `::text` and is bound back with an
 *   explicit cast, so Postgres parses the microseconds it wrote. Binding a
 *   JavaScript `Date` here would silently truncate to milliseconds and exclude
 *   the whole millisecond the cursor came from.
 * - **everything else** - a number, a string, a boolean, a bigint - is exact in
 *   JavaScript already, so it goes through the column's own encoder.
 *
 * `getSQLType()` is derived from the schema rather than from the request, which
 * is what makes `sql.raw` safe here; the value itself is always a bound
 * parameter.
 */
function boundaryValue(column: PgColumn, cursor: PaginationCursor): SQL {
  const value = cursorValueForColumn(column, cursor.value);

  if (cursorValueIsCanonicalText(column)) {
    return sql`${String(value)}::${sql.raw(column.getSQLType())}`;
  }

  return sql`${sql.param(value, column)}`;
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
    /** An opaque cursor. Hand it back as `cursor`; never parse it. */
    endCursor: null | string;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: null | string;
    totalCount: number;
  };
}> {
  const { cursor: rawCursor, first, last } = parsePaginationParams(params);

  const isForward = last === undefined;
  const direction = effectiveDirection(isForward, orderByFromParams.order);
  const orderFn = direction === "asc" ? asc : desc;

  const primary = table[primaryCursor.name];
  const orderName = orderByFromParams.column.name;
  const orderColumn = table[orderName] as PgColumn;
  const isPrimaryOrder = orderName === primaryCursor.name;

  // A column with no total order Postgres and JavaScript agree on cannot be
  // paged at all, so it is refused rather than served for one page and then
  // quietly wrong on the next.
  if (!isCursorSortableColumn(orderColumn)) {
    throw new HTTPException(400, {
      message: `Results cannot be ordered by "${orderName}".`,
    });
  }

  /**
   * The ordered tuple, `(requested column, identifier)`.
   *
   * The tiebreaker is not decoration: without it the ordering is partial, so
   * every row sharing an `updatedAt` sits wherever Postgres feels like putting
   * it, and a page boundary landing inside a tie skips or repeats rows. With it
   * the ordering is total - and the cursor predicate below compares the *same*
   * tuple, which is the invariant this whole module rests on.
   */
  const orderBy: SQL = isPrimaryOrder
    ? orderFn(primary)
    : sql`${orderFn(orderColumn)}, ${orderFn(primary)}`;

  const cursor =
    rawCursor === undefined
      ? undefined
      : decodePaginationCursor(rawCursor, {
          column: orderName,
          primaryKey: primaryCursor.name,
        });

  const searchWhere = buildSearchWhere(search, params.query.search);
  const baseWhere =
    whereFromParams && searchWhere
      ? and(whereFromParams, searchWhere)
      : (whereFromParams ?? searchWhere);

  const cursorWhere = cursor
    ? buildCursorCondition({
        column: orderColumn,
        cursor,
        direction,
        isPrimaryOrder,
        primary,
      })
    : undefined;
  const where =
    baseWhere && cursorWhere
      ? and(baseWhere, cursorWhere)
      : (baseWhere ?? cursorWhere);

  const totalCount = await fetchTotalCount(c, table, baseWhere);

  const limit = (first ?? last ?? 50) + 1;
  const edges = await query({ limit, where, orderBy });

  const requested = first ?? last ?? edges.length;
  const hasMore = edges.length > requested;
  const slicedEdges = edges.slice(0, requested);
  const finalEdges = isForward ? slicedEdges : slicedEdges.reverse();

  const boundaries = await cursorsFor({
    c,
    edges: finalEdges,
    orderColumn,
    orderName,
    primary,
    primaryName: primaryCursor.name,
    table,
  });

  return {
    pageInfo: {
      totalCount,
      count: finalEdges.length,
      // An empty page has nothing to page from, so it never advertises a
      // neighbour it cannot hand out a cursor for.
      hasNextPage:
        finalEdges.length === 0 ? false : isForward ? hasMore : Boolean(cursor),
      hasPreviousPage:
        finalEdges.length === 0 ? false : isForward ? Boolean(cursor) : hasMore,
      ...boundaries,
    },
    edges: finalEdges,
  };
}

/**
 * The two cursors a page hands back.
 *
 * The order column's value normally comes straight off the row, because a list
 * almost always selects the column it sorts by. Two cases need one extra
 * primary-key lookup of at most two rows:
 *
 * 1. **a projection that does not include the order column** - a public read
 *    naming a subset of fields. Without the value there is no tuple to mint, and
 *    falling back to an identifier is the bug this module exists to remove;
 * 2. **a date column** - the row carries a JavaScript `Date`, which has already
 *    lost the microseconds Postgres stored. The canonical `::text` is fetched so
 *    the cursor carries the value the next comparison will be parsed from.
 *
 * The lookup reads the boundary rows *now*, while they are still the boundary -
 * it is part of minting the cursor, not part of using one. Nothing re-reads them
 * when the cursor comes back.
 */
async function cursorsFor({
  c,
  edges,
  orderColumn,
  orderName,
  primary,
  primaryName,
  table,
}: {
  c: Context;
  edges: readonly Record<string, unknown>[];
  orderColumn: PgColumn;
  orderName: string;
  primary: PgColumn;
  primaryName: string;
  table: PgTable;
}): Promise<{ endCursor: null | string; startCursor: null | string }> {
  const first = edges[0];
  const last = edges.at(-1);
  if (!first || !last) return { endCursor: null, startCursor: null };

  const idOf = (row: Record<string, unknown>): number =>
    Number(row[primaryName]);

  const canonical = cursorValueIsCanonicalText(orderColumn);
  const onTheRow = !canonical && orderName in first && orderName in last;

  const values = new Map<number, unknown>();
  if (onTheRow) {
    values.set(idOf(first), first[orderName]);
    values.set(idOf(last), last[orderName]);
  } else {
    const ids = [...new Set([idOf(first), idOf(last)])];
    const rows = await c
      .get("db")
      .select({
        id: primary,
        // `::text` for a date, so no precision is lost between the value the
        // cursor carries and the value the next page compares against.
        value: canonical ? sql<string>`${orderColumn}::text` : orderColumn,
      })
      .from(table)
      .where(inArray(primary, ids));

    for (const row of rows) values.set(Number(row.id), row.value);
  }

  const mint = (row: Record<string, unknown>): string =>
    encodePaginationCursor({
      column: orderName,
      id: idOf(row),
      value: cursorValueOf(orderColumn, values.get(idOf(row))),
    });

  return { endCursor: mint(last), startCursor: mint(first) };
}

/** A positive whole number, as a query string carries it. */
const zodPageSize = z
  .string()
  .regex(/^\d+$/, "Must be a whole number.")
  .refine(value => Number(value) >= 1, "Must be greater than zero.")
  .refine(value => Number.isSafeInteger(Number(value)), "Too large.");

export const zodPaginationPageInfo = z.object({
  totalCount: z.number(),
  count: z.number(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
  /**
   * Opaque. It encodes the ordered tuple the next page continues from, so it is
   * meaningless outside the ordering that produced it - hand it back unchanged.
   */
  startCursor: z.string().nullable(),
  endCursor: z.string().nullable(),
});

/**
 * The pagination half of a list route's query, validated at the edge.
 *
 * Every rule that can be stated here is stated here rather than left to the
 * internals, so a bad page size is a 400 from the route's own contract - and
 * appears in the OpenAPI document - instead of something the handler discovers
 * later. `parsePaginationParams` re-checks all of it, because a service can be
 * called directly and a plugin can build a route without this schema.
 *
 * The cursor is only shape-checked here: it is opaque, so "looks like a cursor"
 * is all a request schema can honestly say. Whether it decodes, and whether it
 * belongs to *this* ordering, is decided where the ordering is known.
 */
export const zodPaginationQuery = z
  .object({
    cursor: z
      .string()
      .min(1)
      .max(512)
      // base64url, or a legacy numeric cursor. Anything else cannot be one.
      .regex(/^[A-Za-z0-9_-]+$/, "Invalid cursor.")
      .optional(),
    first: zodPageSize.optional(),
    last: zodPageSize.optional(),
  })
  .refine(
    query => query.first === undefined || query.last === undefined,
    'Use either "first" or "last", not both.',
  );
