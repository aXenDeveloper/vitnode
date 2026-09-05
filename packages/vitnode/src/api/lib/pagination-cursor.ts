import type { PgColumn } from "drizzle-orm/pg-core";

import { HTTPException } from "hono/http-exception";

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

type CursorKind = "bigint" | "boolean" | "number" | "string" | "temporal";

const KIND_BY_DATA_TYPE: Record<string, CursorKind> = {
  bigint: "bigint",
  boolean: "boolean",
  date: "temporal",
  number: "number",
  string: "string",
};

const baseDataTypeOf = (column: PgColumn): string =>
  column.dataType.split(" ")[0];

const isArrayColumn = (column: PgColumn): boolean => column.dimensions > 0;

const badRequest = (message: string): HTTPException =>
  new HTTPException(400, { message });

/** The one message a tampered or stale cursor ever produces. */
const INVALID_CURSOR = "Invalid pagination cursor.";

type TemporalType = "date" | "time" | "timestamp";

const temporalTypeOf = (column: PgColumn): null | TemporalType => {
  const sqlType = column.getSQLType().toLowerCase();

  // Order matters: "timestamp with time zone" also starts with "time".
  if (sqlType.startsWith("timestamp")) return "timestamp";
  if (sqlType.startsWith("time")) return "time";
  if (sqlType.startsWith("date")) return "date";

  return null;
};

const hasTimeZone = (column: PgColumn): boolean =>
  column.getSQLType().toLowerCase().includes("with time zone");

export const isCursorSortableColumn = (column: PgColumn): boolean =>
  !isArrayColumn(column) &&
  (temporalTypeOf(column) !== null ||
    baseDataTypeOf(column) in KIND_BY_DATA_TYPE);

const kindOf = (column: PgColumn): CursorKind => {
  if (!isArrayColumn(column) && temporalTypeOf(column)) return "temporal";

  const kind = isArrayColumn(column)
    ? undefined
    : KIND_BY_DATA_TYPE[baseDataTypeOf(column)];
  if (!kind) {
    throw badRequest(
      `The "${column.name}" column cannot be used as a pagination cursor.`,
    );
  }

  return kind;
};

const TEMPORAL_GRAMMAR: Record<TemporalType, RegExp> = {
  date: /^(?<year>\d{4,6})-(?<month>\d{2})-(?<day>\d{2})$/,
  time: /^(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})(?:\.\d{1,6})?(?<zone>.*)$/,
  timestamp:
    /^(?<year>\d{4,6})-(?<month>\d{2})-(?<day>\d{2})(?:[ T](?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})(?:\.\d{1,6})?(?<zone>.*))?$/,
};

type TemporalParts = Partial<
  Record<
    "day" | "hour" | "minute" | "month" | "second" | "year" | "zone",
    string
  >
>;

/** `Z`, or `±HH`, `±HH:MM`, `±HHMM`, `±HH:MM:SS` - the forms Postgres writes. */
const ZONE = /^([+-])(\d{2})(?::?(\d{2}))?(?::?(\d{2}))?$/;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const isRealZone = (raw: string, allowed: boolean): boolean => {
  if (raw === "") return true;
  if (!allowed) return false;
  if (raw === "Z") return true;

  const match = ZONE.exec(raw);
  if (!match) return false;

  const [, , hours, minutes = "0", seconds = "0"] = match;

  // Postgres refuses anything past ±15:59:59, and so does this.
  return Number(hours) <= 15 && Number(minutes) <= 59 && Number(seconds) <= 59;
};

const isRealTemporal = (
  column: PgColumn,
  temporal: TemporalType,
  value: string,
): boolean => {
  const match = TEMPORAL_GRAMMAR[temporal].exec(value);
  if (!match) return false;

  const { day, hour, minute, month, second, year, zone } =
    (match.groups as TemporalParts | undefined) ?? {};

  if (year !== undefined) {
    const [y, m, d] = [Number(year), Number(month), Number(day)];
    if (y < 1 || y > 294276 || m < 1 || m > 12) return false;

    const limit = m === 2 && isLeapYear(y) ? 29 : DAYS_IN_MONTH[m - 1];
    if (d < 1 || d > limit) return false;
  }

  // A bare `date`, or a `timestamp` written as one: no time to check.
  if (hour === undefined) return true;

  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) {
    return false;
  }

  // A `timestamp` takes an offset and throws it away, which is what lets a
  // `Date`-minted value carry `+00`. A `time` without a zone does not.
  return isRealZone(
    zone ?? "",
    temporal === "timestamp" || hasTimeZone(column),
  );
};

const DECIMAL_INTEGER = /^-?\d+$/;

const pad = (value: number, width = 2): string =>
  String(value).padStart(width, "0");

const canonicalFromDate = (column: PgColumn, value: Date): string => {
  const time = value.getTime();
  if (!Number.isFinite(time)) {
    throw new Error(
      `Cannot build a pagination cursor from an invalid date on "${column.name}".`,
    );
  }

  const zone = hasTimeZone(column) ? "+00" : "";
  const date = `${pad(value.getUTCFullYear(), 4)}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  const clock = `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}.${pad(value.getUTCMilliseconds(), 3)}`;

  switch (temporalTypeOf(column)) {
    case "date":
      return date;
    case "time":
      return `${clock}${zone}`;
    default:
      return `${date} ${clock}${zone}`;
  }
};

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
 * | temporal  | the database's own `::text`, microseconds and all |
 * | null      | `null`                                        |
 *
 * The temporal row is the one worth reading twice. A Postgres `timestamp` keeps
 * microseconds and a JavaScript `Date` keeps milliseconds, so a value that has
 * been through a `Date` is *strictly smaller* than the one still in the table -
 * and comparing against it would exclude the entire millisecond it came from.
 * Since `now()` stamps every row in one statement identically, that is not an
 * edge case: it would end a bulk-imported collection's walk after page one. So
 * the page query selects `column::text` and this function keeps it exactly as
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
    case "number": {
      if (typeof value === "number") return value;
      break;
    }
    case "temporal": {
      // Already `::text` from the database on the paginated path. A `Date` only
      // reaches here when a caller mints from a value it is holding, and it is
      // rewritten into the form Postgres would have written.
      if (value instanceof Date) return canonicalFromDate(column, value);
      if (typeof value === "string") return value;
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
 * `number` or `bigint` for those kinds, and for a temporal column the
 * **canonical text**, which the predicate binds with an explicit cast so
 * Postgres parses it at full precision.
 *
 * A temporal value is checked for more than shape. `2026-02-30` and
 * `2026-08-09 23:60:00` look like timestamps and are not moments, and Postgres
 * answers a cast of either with `invalid input syntax` - a 500 produced by a
 * query string. Both are refused here, so nothing impossible is ever bound.
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
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw badRequest(INVALID_CURSOR);
      }

      return value;
    }
    case "temporal": {
      const temporal = temporalTypeOf(column);
      if (
        typeof value !== "string" ||
        !temporal ||
        !isRealTemporal(column, temporal, value)
      ) {
        throw badRequest(INVALID_CURSOR);
      }

      // Kept as text. The predicate casts it back to the column's own type, so
      // Postgres does the parsing - at the precision it stored.
      return value;
    }
    default: {
      if (typeof value !== "string") throw badRequest(INVALID_CURSOR);

      return value;
    }
  }
};

/**
 * Whether this column's value travels as canonical text plus a cast.
 *
 * True for every temporal type, and it decides two things at once: the page
 * query selects `column::text` rather than the column, and the predicate binds
 * the cursor back with an explicit cast. Both halves exist so the microseconds
 * Postgres stored survive a round trip that JavaScript's millisecond `Date`
 * would otherwise truncate.
 */
export const cursorValueIsCanonicalText = (column: PgColumn): boolean =>
  kindOf(column) === "temporal";

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
