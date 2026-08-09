import type { PgColumn } from "drizzle-orm/pg-core";

import { HTTPException } from "hono/http-exception";

/**
 * The opaque cursor a paginated list hands out, and takes back.
 *
 * Two properties, and both of them are load-bearing.
 *
 * **It is the ordered tuple.** A cursor has to describe a position in an
 * ordering, and an ordering is `(orderColumn, id)` - so the cursor is that pair.
 * An identifier on its own is only a position when the list is ordered by the
 * identifier; for any other column it names a row whose place in the sequence
 * nobody knows.
 *
 * **It is self-contained.** The value it carries *is* the boundary, and nothing
 * re-reads the row it came from. That is the difference between a cursor and a
 * pointer: a cursor is the position as it stood when the page was generated, and
 * editing or deleting the row that happened to sit on the boundary must not move
 * it. Re-reading would mean an edit to one row silently skips every row the
 * ordering used to have between the old position and the new one.
 *
 * The wire form is `base64url(JSON)`: opaque, so no client starts depending on
 * the shape, and self-describing, so a cursor minted for one order column is
 * refused by a request that has since changed to another.
 *
 * It is **not signed**, so every field is treated as hostile input and validated
 * against the column it claims to describe - see {@link cursorValueForColumn}.
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

/**
 * How one column's values travel in a cursor.
 *
 * Named per kind rather than inferred, because "how do I serialise this" and
 * "what am I willing to accept back" are the same question asked twice, and
 * answering it in one place is what stops the second answer being looser than
 * the first.
 */
type CursorKind = "bigint" | "boolean" | "date" | "number" | "string";

const KIND_BY_DATA_TYPE: Record<string, CursorKind> = {
  bigint: "bigint",
  boolean: "boolean",
  date: "date",
  number: "number",
  string: "string",
};

const badRequest = (message: string): HTTPException =>
  new HTTPException(400, { message });

/** The one message a tampered or stale cursor ever produces. */
const INVALID_CURSOR = "Invalid pagination cursor.";

/**
 * Whether a column can be paged through at all.
 *
 * A `json`, `array` or custom column has no total order Postgres and JavaScript
 * agree on, so a cursor over one would be a value the next page cannot compare
 * against. Refused rather than approximated.
 */
export const isCursorSortableColumn = (column: PgColumn): boolean =>
  column.dataType in KIND_BY_DATA_TYPE;

const kindOf = (column: PgColumn): CursorKind => {
  const kind = KIND_BY_DATA_TYPE[column.dataType];
  if (!kind) {
    throw badRequest(
      `The "${column.name}" column cannot be used as a pagination cursor.`,
    );
  }

  return kind;
};

/**
 * A Postgres timestamp, date or time as `::text` renders it.
 *
 * Anchored and permissive in the right places: `timestamp` gives
 * `2026-08-09 10:00:00.123456`, `timestamptz` appends `+00`, and a plain `date`
 * gives just the day. An ISO string with a `T` and a `Z` is accepted too,
 * because that is what a `Date` produces on the one path that has no database
 * text to offer.
 *
 * The regex is not decoration - it is what keeps a tampered cursor from reaching
 * Postgres as an invalid cast, which would be a 500 rather than a 400.
 */
const CANONICAL_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?((\+|-)\d{2}(:?\d{2})?|Z)?)?$/;

const DECIMAL_INTEGER = /^-?\d+$/;

/**
 * One column value, flattened into the cursor's canonical representation.
 *
 * Per kind, and deliberately not a generic coercion:
 *
 * | kind      | carried as                                    |
 * | --------- | --------------------------------------------- |
 * | number    | a JSON number                                 |
 * | boolean   | a JSON boolean                                |
 * | string    | a JSON string                                 |
 * | bigint    | a decimal string, because JSON has no bigint   |
 * | date      | the database's own `::text`, microseconds and all |
 * | null      | `null`                                        |
 *
 * The date row is the one worth reading twice. A Postgres `timestamp` keeps
 * microseconds and a JavaScript `Date` keeps milliseconds, so a value that has
 * been through a `Date` is *strictly smaller* than the one still in the table -
 * and comparing against it would exclude the entire millisecond it came from.
 * Since `now()` stamps every row in one statement identically, that is not an
 * edge case: it would end a bulk-imported collection's walk after page one. So
 * the mint path reads `column::text` and this function keeps it exactly as
 * Postgres wrote it.
 */
export const cursorValueOf = (
  column: PgColumn,
  value: unknown,
): PaginationCursorValue => {
  if (value === null || value === undefined) return null;

  switch (kindOf(column)) {
    case "bigint": {
      if (typeof value === "bigint") return value.toString();
      if (typeof value === "number") return String(value);
      break;
    }
    case "boolean": {
      if (typeof value === "boolean") return value;
      break;
    }
    case "date": {
      // Already `::text` from the database on the normal path. A `Date` only
      // reaches here if a caller supplied one, and its ISO form is the best
      // that value can offer.
      if (value instanceof Date) return value.toISOString();
      if (typeof value === "string") return value;
      break;
    }
    case "number": {
      if (typeof value === "number") return value;
      break;
    }
    default: {
      if (typeof value === "string") return value;
      break;
    }
  }

  // The value came off a row of the very column it is being minted for, so
  // anything else is a wiring bug rather than bad input - and quietly writing
  // `"[object Object]"` into a cursor would hide it until somebody turned a
  // page.
  throw new Error(
    `Cannot build a pagination cursor from a ${typeof value} value of "${column.name}".`,
  );
};

/**
 * The cursor value, validated against the column it claims to describe.
 *
 * Validation rather than coercion, because the cursor is opaque but not signed:
 * a client can edit it. `Boolean("false")` is `true`, `Number("")` is `0`, and
 * `BigInt("nonsense")` throws a `SyntaxError` that would surface as a 500 - so
 * every kind checks the shape it expects and refuses anything else with a 400.
 *
 * Returns the value in the form the SQL comparison needs: a real `boolean`,
 * `number` or `bigint` for those kinds, and for a date the **canonical text**,
 * which the predicate binds with an explicit cast so Postgres parses it at full
 * precision.
 */
export const cursorValueForColumn = (
  column: PgColumn,
  value: PaginationCursorValue,
): unknown => {
  if (value === null) return null;

  switch (kindOf(column)) {
    case "bigint": {
      // A decimal string, and nothing else: `BigInt("1.5")` and `BigInt("")`
      // are a `SyntaxError` and a `0` respectively, and neither is an answer.
      if (typeof value !== "string" || !DECIMAL_INTEGER.test(value)) {
        throw badRequest(INVALID_CURSOR);
      }

      return BigInt(value);
    }
    case "boolean": {
      if (typeof value !== "boolean") throw badRequest(INVALID_CURSOR);

      return value;
    }
    case "date": {
      if (typeof value !== "string" || !CANONICAL_TIMESTAMP.test(value)) {
        throw badRequest(INVALID_CURSOR);
      }

      // Kept as text. The predicate casts it back to the column's own type, so
      // Postgres does the parsing - at the precision it stored.
      return value;
    }
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw badRequest(INVALID_CURSOR);
      }

      return value;
    }
    default: {
      if (typeof value !== "string") throw badRequest(INVALID_CURSOR);

      return value;
    }
  }
};

/** Whether the comparison binds this column's value as text plus a cast. */
export const cursorValueIsCanonicalText = (column: PgColumn): boolean =>
  kindOf(column) === "date";

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
 *
 * The *value* is checked separately, against the column - see
 * {@link cursorValueForColumn} - because only the caller knows which column this
 * request is ordered by.
 */
export const decodePaginationCursor = (
  raw: string,
  { column, primaryKey }: { column: string; primaryKey: string },
): PaginationCursor => {
  const trimmed = raw.trim();
  if (trimmed === "") throw badRequest(INVALID_CURSOR);

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
    throw badRequest(INVALID_CURSOR);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw badRequest(INVALID_CURSOR);
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
    throw badRequest(INVALID_CURSOR);
  }

  if (candidate.column !== column) {
    throw badRequest(
      `This cursor was issued for a different ordering. Start from the first page.`,
    );
  }

  return { column, id, value: candidate.value };
};
