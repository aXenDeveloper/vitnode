import type {
  ColumnDataBigIntConstraint,
  ColumnDataNumberConstraint,
  Placeholder,
  SQL,
} from "drizzle-orm";
import type {
  PgColumn,
  PgColumnBaseConfig,
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
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type { PaginationCursor } from "./pagination-cursor";

import {
  cursorIdentifierForColumn,
  cursorIdentifierOf,
  cursorValueForColumn,
  cursorValueIsCanonicalText,
  cursorValueOf,
  decodePaginationCursor,
  encodePaginationCursor,
  isCursorSortableColumn,
  isPaginationIdentifierColumn,
} from "./pagination-cursor";

/** Nobody may ask for more than this in one page, whatever they send. */
const MAX_PAGE_SIZE = 100;

/**
 * The column a page query carries purely so its rows can be turned into cursors.
 *
 * Selected by the **same statement** that returns the rows, and removed again
 * before anything leaves this module. It exists because a cursor has to describe
 * the position the returned row actually occupied, and the only way to be
 * certain of that is to read the two out of one snapshot.
 *
 * Prefixed so it cannot collide with a column name, and stripped rather than
 * documented, because it is pagination's business and nobody else's.
 */
export const PAGINATION_CURSOR_FIELD = "__cursorValue";

/** What a page query must spread into its projection. */
export type PaginationCursorSelection = Record<
  typeof PAGINATION_CURSOR_FIELD,
  PgColumn | SQL<string>
>;

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
  const identifier = sql`${sql.param(
    cursorIdentifierForColumn(primary, cursor.id),
    primary,
  )}`;

  // The identifier is the whole tuple when the list is ordered by it, so there
  // is no second half to compare and no null block to worry about.
  if (isPrimaryOrder) return after(primary, identifier);

  const boundary = boundaryValue(column, cursor);

  if (direction === "asc") {
    // NULLS LAST: a null cursor is inside the trailing block, and everything
    // that is not null is already behind us.
    if (cursor.value === null) {
      return required(and(isNull(column), gt(primary, identifier)));
    }

    return required(
      or(
        gt(column, boundary),
        and(eq(column, boundary), gt(primary, identifier)),
        isNull(column),
      ),
    );
  }

  // NULLS FIRST: a null cursor is inside the *leading* block, so the rest of
  // that block comes first and every non-null row follows it.
  if (cursor.value === null) {
    return required(
      or(and(isNull(column), lt(primary, identifier)), isNotNull(column)),
    );
  }

  return required(
    or(
      lt(column, boundary),
      and(eq(column, boundary), lt(primary, identifier)),
    ),
  );
}

/**
 * The cursor's own value, bound so Postgres compares it at full precision.
 *
 * Two shapes, because two kinds of value survive a round trip differently:
 *
 * - a **temporal** value travels as the database's own `::text` and is bound
 *   back with an explicit cast, so Postgres parses the microseconds it wrote.
 *   Binding a JavaScript `Date` here would silently truncate to milliseconds and
 *   exclude the whole millisecond the cursor came from.
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

/**
 * A stable row identifier: an integer, bigint or UUID column.
 *
 * Drizzle refines these types (`serial` is `number int32`, bigint is
 * `bigint int64`, UUID is `string uuid`), so the bound includes their refined
 * forms. The first generic stays broad because built `PgColumn`s expose it that
 * way, as Drizzle's own `AnyPgColumn` does.
 */
type PaginationIdentifierDataType =
  | "bigint"
  | "number"
  | "string uuid"
  | `bigint ${ColumnDataBigIntConstraint}`
  | `number ${ColumnDataNumberConstraint}`;

export type PaginationCursorColumn = PgColumn<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  PgColumnBaseConfig<PaginationIdentifierDataType>
>;

export async function withPagination<
  QueryMin extends Record<string, unknown>,
  T extends TableConfig,
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
  primaryCursor: PaginationCursorColumn;
  query: (args: {
    /**
     * Spread this into the projection: `.select({ ...fields, ...cursorSelection })`.
     *
     * Not optional in practice. It is how the cursor value is read out of the
     * same statement as the row, and a query that omits it can only be paged by
     * a column it happens to have selected itself.
     */
    cursorSelection: PaginationCursorSelection;
    limit: number | Placeholder<string, unknown>;
    orderBy: SQL;
    where: SQL | undefined;
  }) => Promise<QueryMin[]>;
  search?: T["columns"][keyof T["columns"]][];
  table: Omit<PgTableWithColumns<T>, "enableRLS">;
  where?: SQL;
}): Promise<{
  edges: Omit<QueryMin, typeof PAGINATION_CURSOR_FIELD>[];
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

  if (!isPaginationIdentifierColumn(primary)) {
    throw new HTTPException(400, {
      message: `The "${primaryCursor.name}" primary cursor must be an integer, bigint or UUID column.`,
    });
  }

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
          primary,
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

  /**
   * The cursor value, projected by the page query itself.
   *
   * A temporal column goes through `::text` so no microsecond is lost on the way
   * out; everything else is exact in JavaScript already and is selected as it
   * is. Either way it rides along with the row, which is the point: a cursor
   * minted from a *second* read would describe wherever the boundary row had got
   * to by then, not where it was when it was chosen for this page.
   */
  const cursorSelection: PaginationCursorSelection = {
    [PAGINATION_CURSOR_FIELD]: cursorValueIsCanonicalText(orderColumn)
      ? sql<string>`${orderColumn}::text`
      : orderColumn,
  };

  const limit = (first ?? last ?? 50) + 1;
  const edges = await query({ cursorSelection, limit, where, orderBy });

  const requested = first ?? last ?? edges.length;
  const hasMore = edges.length > requested;
  const slicedEdges = edges.slice(0, requested);
  const finalEdges = isForward ? slicedEdges : slicedEdges.reverse();

  const boundaries = cursorsFrom({
    edges: finalEdges,
    orderColumn,
    orderName,
    primaryColumn: primary,
    primaryName: primaryCursor.name,
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
    edges: finalEdges.map(withoutCursorField),
  };
}

/**
 * The row as the caller asked for it, with pagination's own column taken back.
 *
 * The internal value is projected for one purpose and has no business in an
 * admin response, a public response, an OpenAPI schema, a search document or a
 * revision snapshot - all of which are built from what this returns.
 */
function withoutCursorField<QueryMin extends Record<string, unknown>>(
  row: QueryMin,
): Omit<QueryMin, typeof PAGINATION_CURSOR_FIELD> {
  if (!(PAGINATION_CURSOR_FIELD in row)) return row;

  const rest: Partial<QueryMin> = { ...row };
  delete rest[PAGINATION_CURSOR_FIELD];

  return rest as Omit<QueryMin, typeof PAGINATION_CURSOR_FIELD>;
}

/**
 * The two cursors a page hands back, read off the page itself.
 *
 * No query. That is the entire design: the value and the row come out of one
 * `SELECT`, so the tuple a cursor names is the tuple that actually decided where
 * the row sat.
 *
 * It used to be a second `SELECT` of the boundary rows by id, which looked
 * harmless and was not. Between the page query and that lookup another writer
 * can move the boundary row - so a row chosen at `(10:00, 42)` would be handed
 * back as a cursor saying `(14:00, 42)`, and the next page would start after
 * 14:00 and skip everything in between. A `DELETE` in the same window was worse:
 * the lookup returned nothing, the value became `null`, and for a nullable
 * ordering `null` is a *real* position inside the null block - so the walk
 * jumped there and abandoned the rest of the collection. Both are gone by
 * construction rather than by locking.
 */
function cursorsFrom({
  edges,
  orderColumn,
  orderName,
  primaryColumn,
  primaryName,
}: {
  edges: readonly Record<string, unknown>[];
  orderColumn: PgColumn;
  orderName: string;
  primaryColumn: PgColumn;
  primaryName: string;
}): { endCursor: null | string; startCursor: null | string } {
  const first = edges[0];
  const last = edges.at(-1);
  if (!first || !last) return { endCursor: null, startCursor: null };

  /**
   * Where the boundary value comes from, in order of preference.
   *
   * The projected field is the answer for every query built through this module.
   * A query that omits it can still be paged by a column it selected itself -
   * exact for a number, a string or a boolean, and from the same statement, so
   * the invariant holds. A temporal column is the one case with no safe
   * fallback: the row carries a `Date` that has already dropped the microseconds
   * the next comparison needs, so minting from it would hand out a cursor that
   * silently re-reads part of the page it came from.
   */
  const valueOf = (row: Record<string, unknown>): unknown => {
    if (PAGINATION_CURSOR_FIELD in row) return row[PAGINATION_CURSOR_FIELD];
    if (!cursorValueIsCanonicalText(orderColumn) && orderName in row) {
      return row[orderName];
    }

    throw new Error(
      `The page query for "${orderName}" must spread \`cursorSelection\` into its projection, so the cursor value is read from the same statement as the row.`,
    );
  };

  const mint = (row: Record<string, unknown>): string =>
    encodePaginationCursor({
      column: orderName,
      id: cursorIdentifierOf(primaryColumn, row[primaryName]),
      value: cursorValueOf(orderColumn, valueOf(row)),
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
