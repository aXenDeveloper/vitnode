import type { PgColumn } from "drizzle-orm/pg-core";

import { HTTPException } from "hono/http-exception";

/**
 * The opaque cursor a paginated list hands out, and takes back.
 *
 * A cursor has to describe a **position in an ordering**, and an ordering is
 * `(orderColumn, id)` - so the cursor is that pair. An identifier on its own is
 * only a position when the list is ordered by the identifier; for any other
 * column it names a row whose place in the sequence nobody knows, which is how a
 * list ordered by `updatedAt` used to skip rows whose ids happened to fall on
 * the wrong side of it.
 *
 * The wire form is `base64url(JSON)`: opaque, so no client starts depending on
 * the shape, and self-describing, so a cursor minted for one order column is
 * refused by a request that has since changed to another rather than silently
 * producing nonsense.
 */

/** What an order column's value can be, once it has been through JSON. */
export type PaginationCursorValue = boolean | null | number | string;

export interface PaginationCursor {
  /** The order column this cursor was minted for. */
  column: string;
  /** The row's primary key - the tiebreaker half of the ordered tuple. */
  id: number;
  /** The order column's value on that row. `null` is a real position. */
  value: PaginationCursorValue;
}

/** Postgres types whose ordering a cursor can describe. */
const SORTABLE_DATA_TYPES = new Set([
  "bigint",
  "boolean",
  "date",
  "number",
  "string",
]);

const badRequest = (message: string): HTTPException =>
  new HTTPException(400, { message });

/**
 * Whether a column can be paged through at all.
 *
 * A `json`, `array` or custom column has no total order Postgres and JavaScript
 * agree on, so a cursor over one would be a value the next page cannot compare
 * against. Refused rather than approximated.
 */
export const isCursorSortableColumn = (column: PgColumn): boolean =>
  SORTABLE_DATA_TYPES.has(column.dataType);

/**
 * One column value, flattened to something JSON gives back unchanged.
 *
 * A `Date` becomes an ISO string and a `bigint` becomes a decimal string,
 * because neither survives `JSON.stringify` as itself.
 * {@link cursorValueForColumn} is the exact inverse.
 */
export const cursorValueOf = (
  column: PgColumn,
  value: unknown,
): PaginationCursorValue => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();

  const type = typeof value;
  if (type === "boolean" || type === "number" || type === "string") {
    return value as PaginationCursorValue;
  }

  throw badRequest(
    `The "${column.name}" column cannot be used as a pagination cursor.`,
  );
};

/**
 * The cursor value, back in the shape the **column** compares against.
 *
 * This is the step that keeps the predicate honest: Drizzle maps a parameter
 * through the column it is compared with, and a `timestamp` column expects a
 * `Date`. Handing it the ISO string the cursor carries would compare a timestamp
 * against text, which Postgres refuses - so the string is turned back into a
 * `Date` here rather than coerced somewhere further down.
 */
export const cursorValueForColumn = (
  column: PgColumn,
  value: PaginationCursorValue,
): unknown => {
  if (value === null) return null;

  switch (column.dataType) {
    case "bigint":
      return BigInt(String(value));
    case "boolean":
      return Boolean(value);
    case "date": {
      const date = new Date(String(value));
      if (Number.isNaN(date.getTime())) {
        throw badRequest("Invalid pagination cursor.");
      }

      return date;
    }
    case "number": {
      const parsed = Number(value);
      if (!Number.isFinite(parsed))
        throw badRequest("Invalid pagination cursor.");

      return parsed;
    }
    default:
      return String(value);
  }
};

export const encodePaginationCursor = (cursor: PaginationCursor): string =>
  Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");

/** A bare integer, which is what every cursor was before this. */
const LEGACY_CURSOR = /^[1-9]\d{0,14}$/;

const isCursorValue = (value: unknown): value is PaginationCursorValue =>
  value === null ||
  typeof value === "boolean" ||
  typeof value === "number" ||
  typeof value === "string";

/**
 * Reads a cursor, or refuses the request.
 *
 * Three ways this says no, and each of them is a `400` rather than a page of
 * wrong rows:
 *
 * 1. **garbage** - not base64url, not JSON, or not the shape;
 * 2. **the wrong column** - a cursor minted while the list was ordered by
 *    `updatedAt`, replayed against a list now ordered by `title`. The two
 *    describe different sequences, so the position means nothing;
 * 3. **a legacy numeric cursor on a non-primary-key ordering** - the exact case
 *    that used to skip rows. A bare number is still accepted when the list is
 *    ordered by its identifier, because there it really is the whole tuple.
 */
export const decodePaginationCursor = (
  raw: string,
  { column, primaryKey }: { column: string; primaryKey: string },
): PaginationCursor => {
  const trimmed = raw.trim();
  if (trimmed === "") throw badRequest("Invalid pagination cursor.");

  if (LEGACY_CURSOR.test(trimmed)) {
    if (column !== primaryKey) {
      throw badRequest(
        `This cursor cannot be used with the "${column}" ordering. Start from the first page.`,
      );
    }
    const id = Number(trimmed);

    return { column, id, value: id };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(
      Buffer.from(trimmed, "base64url").toString("utf8"),
    ) as unknown;
  } catch {
    throw badRequest("Invalid pagination cursor.");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw badRequest("Invalid pagination cursor.");
  }

  const candidate = parsed as Record<string, unknown>;
  const id = candidate.id;
  if (
    typeof candidate.column !== "string" ||
    typeof id !== "number" ||
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    !isCursorValue(candidate.value)
  ) {
    throw badRequest("Invalid pagination cursor.");
  }

  if (candidate.column !== column) {
    throw badRequest(
      `This cursor was issued for a different ordering. Start from the first page.`,
    );
  }

  return { column, id, value: candidate.value };
};
