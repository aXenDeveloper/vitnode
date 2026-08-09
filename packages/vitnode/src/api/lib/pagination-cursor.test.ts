import { bigint, date, pgTable, time, timestamp } from "drizzle-orm/pg-core";
// @vitest-environment node
import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";

import { core_users } from "@/database/users";

import {
  cursorValueForColumn,
  cursorValueIsCanonicalText,
  cursorValueOf,
  decodePaginationCursor,
  encodePaginationCursor,
  isCursorSortableColumn,
} from "./pagination-cursor";

/** The column shapes core itself has no example of, but a plugin may. */
const probes = pgTable("cursor_probes", {
  big: bigint({ mode: "bigint" }),
  clock: time(),
  clockTz: time({ withTimezone: true }),
  day: date(),
  moment: timestamp(),
});

/**
 * The cursor is the ordered tuple, or it is nothing.
 *
 * An identifier on its own only describes a position when the list is ordered
 * by the identifier. For any other column it names a row whose place in the
 * sequence nobody knows - which is how a list ordered by `updatedAt` used to
 * skip every row whose id happened to fall on the wrong side of it.
 */

const statusOf = (error: unknown): number =>
  error instanceof HTTPException ? error.status : 0;

describe("encoding", () => {
  it("round-trips a cursor", () => {
    const cursor = {
      column: "updatedAt",
      id: 42,
      value: "2026-08-08T12:00:00.000Z",
    };

    expect(
      decodePaginationCursor(encodePaginationCursor(cursor), {
        column: "updatedAt",
        primaryKey: "id",
      }),
    ).toEqual(cursor);
  });

  it("is opaque, so nothing downstream starts parsing it", () => {
    const encoded = encodePaginationCursor({
      column: "updatedAt",
      id: 42,
      value: "2026-08-08T12:00:00.000Z",
    });

    // base64url: URL-safe, and not a number somebody will be tempted to read.
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Number.isNaN(Number(encoded))).toBe(true);
  });

  it("round-trips a null order value, which is a real position", () => {
    const cursor = { column: "publishedAt", id: 9, value: null };

    expect(
      decodePaginationCursor(encodePaginationCursor(cursor), {
        column: "publishedAt",
        primaryKey: "id",
      }),
    ).toEqual(cursor);
  });

  it.each([
    ["a string", "Zebra"],
    ["a number", 12],
    ["a boolean", true],
  ])("round-trips %s value", (_why, value) => {
    const cursor = { column: "name", id: 3, value };

    expect(
      decodePaginationCursor(encodePaginationCursor(cursor), {
        column: "name",
        primaryKey: "id",
      }).value,
    ).toEqual(value);
  });
});

describe("decoding refuses what it cannot trust", () => {
  const decode = (raw: string, column = "updatedAt") =>
    decodePaginationCursor(raw, { column, primaryKey: "id" });

  it.each([
    ["garbage", "not-a-cursor!!"],
    ["an empty string", "   "],
    [
      "valid base64 that is not JSON",
      Buffer.from("hello").toString("base64url"),
    ],
    [
      "JSON that is not an object",
      Buffer.from("[1,2,3]").toString("base64url"),
    ],
    [
      "an object with no id",
      Buffer.from(JSON.stringify({ column: "updatedAt", value: 1 })).toString(
        "base64url",
      ),
    ],
    [
      "a non-integer id",
      Buffer.from(
        JSON.stringify({ column: "updatedAt", id: 1.5, value: 1 }),
      ).toString("base64url"),
    ],
    [
      "a zero id",
      Buffer.from(
        JSON.stringify({ column: "updatedAt", id: 0, value: 1 }),
      ).toString("base64url"),
    ],
    [
      "an object value",
      Buffer.from(
        JSON.stringify({ column: "updatedAt", id: 1, value: { a: 1 } }),
      ).toString("base64url"),
    ],
  ])("answers 400 for %s", (_why, raw) => {
    expect(() => decode(raw)).toThrow(HTTPException);
    try {
      decode(raw);
    } catch (error) {
      expect(statusOf(error)).toBe(400);
    }
  });

  it("refuses a cursor minted for another ordering", () => {
    // The two describe different sequences, so the position means nothing -
    // and using it anyway is exactly how rows get skipped.
    const encoded = encodePaginationCursor({
      column: "updatedAt",
      id: 42,
      value: "2026-08-08T12:00:00.000Z",
    });

    expect(() => decode(encoded, "title")).toThrow(/different ordering/);
  });
});

describe("legacy numeric cursors", () => {
  it("still works when the list is ordered by its identifier", () => {
    // There the identifier really is the whole ordered tuple, so an old
    // bookmark keeps working.
    expect(
      decodePaginationCursor("42", { column: "id", primaryKey: "id" }),
    ).toEqual({ column: "id", id: 42, value: 42 });
  });

  it("is refused for any other ordering rather than guessed at", () => {
    // The regression this whole change exists for: a bare number says nothing
    // about where `updatedAt` was, so interpreting it as one would silently
    // skip rows.
    expect(() =>
      decodePaginationCursor("42", { column: "updatedAt", primaryKey: "id" }),
    ).toThrow(/cannot be used with the "updatedAt" ordering/);
  });
});

describe("column values", () => {
  it("keeps a timestamp as text on both sides", () => {
    // Deliberately *not* a `Date` round trip. A `Date` holds milliseconds and
    // Postgres holds microseconds, so turning the text back into one would
    // truncate the value the next comparison is parsed from - and exclude the
    // whole millisecond the cursor came from. The predicate casts this text
    // back to the column's type instead, and lets Postgres do the parsing.
    const flattened = cursorValueOf(
      core_users.createdAt,
      "2026-08-08 12:00:00.123456",
    );

    expect(flattened).toBe("2026-08-08 12:00:00.123456");
    expect(cursorValueForColumn(core_users.createdAt, flattened)).toBe(
      "2026-08-08 12:00:00.123456",
    );
  });

  it("keeps a string a string", () => {
    expect(cursorValueOf(core_users.name, "Ada")).toBe("Ada");
    expect(cursorValueForColumn(core_users.name, "Ada")).toBe("Ada");
  });

  it("keeps a number a number", () => {
    expect(cursorValueOf(core_users.id, 7)).toBe(7);
    expect(cursorValueForColumn(core_users.id, 7)).toBe(7);
  });

  it("treats null as null on both sides", () => {
    expect(cursorValueOf(core_users.createdAt, null)).toBeNull();
    expect(cursorValueForColumn(core_users.createdAt, null)).toBeNull();
  });

  it("refuses an unparseable date rather than letting Postgres fail the cast", () => {
    expect(() =>
      cursorValueForColumn(core_users.createdAt, "not-a-date"),
    ).toThrow(HTTPException);
  });

  it("accepts the sortable column kinds", () => {
    expect(isCursorSortableColumn(core_users.id)).toBe(true);
    expect(isCursorSortableColumn(core_users.name)).toBe(true);
    expect(isCursorSortableColumn(core_users.createdAt)).toBe(true);
    expect(isCursorSortableColumn(core_users.newsletter)).toBe(true);
    expect(isCursorSortableColumn(probes.big)).toBe(true);
  });
});

/**
 * A cursor is opaque, not signed. A client can edit it.
 *
 * So every field is hostile input, checked against the column it claims to
 * describe. Coercion is the failure mode to avoid, not just an inelegance:
 * `Boolean("false")` is `true`, `Number("")` is `0`, and `BigInt("nonsense")`
 * throws a `SyntaxError` that would leave the route as a 500. Each of those is
 * a wrong page or a wrong status code handed to somebody who asked for neither.
 */
describe("a tampered cursor value is refused, never coerced", () => {
  const refuses = (
    column: Parameters<typeof cursorValueForColumn>[0],
    value: unknown,
  ) => {
    expect(() => cursorValueForColumn(column, value as never)).toThrow(
      HTTPException,
    );
    try {
      cursorValueForColumn(column, value as never);
    } catch (error) {
      expect(statusOf(error)).toBe(400);
    }
  };

  describe("boolean", () => {
    it('refuses the string "false", which coercion would read as true', () => {
      refuses(core_users.newsletter, "false");
    });

    it.each([
      ["a number", 0],
      ["a string", "true"],
      ["an empty string", ""],
    ])("refuses %s", (_why, value) => {
      refuses(core_users.newsletter, value);
    });

    it("accepts a real boolean, and null", () => {
      expect(cursorValueForColumn(core_users.newsletter, false)).toBe(false);
      expect(cursorValueForColumn(core_users.newsletter, true)).toBe(true);
      expect(cursorValueForColumn(core_users.newsletter, null)).toBeNull();
    });
  });

  describe("number", () => {
    it.each([
      ["a numeric string", "42"],
      ["an empty string", ""],
      ["a boolean", true],
      ["nonsense", "not-a-number"],
    ])("refuses %s", (_why, value) => {
      refuses(core_users.id, value);
    });

    it("accepts a finite number, and null", () => {
      expect(cursorValueForColumn(core_users.id, 42)).toBe(42);
      expect(cursorValueForColumn(core_users.id, null)).toBeNull();
    });
  });

  describe("bigint", () => {
    it("refuses a value that would make BigInt() throw", () => {
      // The one that used to escape as a native `SyntaxError`, and therefore
      // as a 500.
      refuses(probes.big, "not-a-bigint");
    });

    it.each([
      ["a fractional string", "1.5"],
      ["an empty string", ""],
      ["a number", 12],
      ["a boolean", false],
      ["whitespace", " 12 "],
    ])("refuses %s", (_why, value) => {
      refuses(probes.big, value);
    });

    it("accepts a decimal integer string, signed or not, and null", () => {
      expect(cursorValueForColumn(probes.big, "9007199254740993")).toBe(
        9007199254740993n,
      );
      expect(cursorValueForColumn(probes.big, "-4")).toBe(-4n);
      expect(cursorValueForColumn(probes.big, null)).toBeNull();
    });
  });

  describe("timestamp", () => {
    it.each([
      ["nonsense", "not-a-date"],
      ["a number", 1_700_000_000],
      ["a boolean", true],
      ["a half-written date", "2026-08"],
      ["an injection attempt", "2026-08-09'; DROP TABLE users; --"],
    ])("refuses %s", (_why, value) => {
      // Reaching Postgres with any of these would be an invalid-cast 500
      // rather than a 400 - and the last one has no business getting near a
      // cast at all.
      refuses(core_users.createdAt, value);
    });

    it.each([
      ["a Postgres timestamp", "2026-08-09 10:00:00.123456"],
      ["a Postgres timestamptz", "2026-08-09 10:00:00.123456+00"],
      ["a plain date", "2026-08-09"],
      ["an ISO string", "2026-08-09T10:00:00.123Z"],
    ])("accepts %s, unchanged", (_why, value) => {
      // Unchanged is the point: the predicate casts this text back to the
      // column's type, so Postgres parses it at the precision it stored.
      expect(cursorValueForColumn(core_users.createdAt, value)).toBe(value);
    });

    it("is the one kind bound as text plus a cast", () => {
      expect(cursorValueIsCanonicalText(core_users.createdAt)).toBe(true);
      expect(cursorValueIsCanonicalText(core_users.id)).toBe(false);
      expect(cursorValueIsCanonicalText(core_users.name)).toBe(false);
    });

    /**
     * The gap a pattern alone leaves open.
     *
     * Every one of these has the shape of a timestamp and is not a moment, so a
     * shape check waves it through and Postgres answers the cast with
     * `invalid input syntax` - a 500 produced by a query string, on a route
     * whose whole promise is that it does not do that.
     */
    describe("impossible values that still look like timestamps", () => {
      it.each([
        ["month 13", "2026-13-01"],
        ["month 0", "2026-00-01"],
        ["a day past the end of the month", "2026-02-30"],
        ["a day past the end of a short month", "2026-04-31"],
        ["29 February in a common year", "2025-02-29"],
        ["29 February in a century that is not a leap year", "1900-02-29"],
        ["day 0", "2026-08-00"],
        ["day 32", "2026-01-32"],
        ["hour 24", "2026-08-09 24:00:00"],
        ["hour 99", "2026-08-09 99:00:00"],
        ["minute 60", "2026-08-09 23:60:00"],
        ["second 61", "2026-08-09 23:59:61"],
        ["year 0", "0000-01-01"],
      ])("refuses %s", (_why, value) => {
        refuses(core_users.createdAt, value);
      });

      it.each([
        ["an offset past the maximum", "2026-08-09 10:00:00+25:00"],
        ["an offset with 99 minutes", "2026-08-09 10:00:00+12:99"],
        ["an offset that is not a number", "2026-08-09 10:00:00+ab"],
        ["a seven-digit fraction", "2026-08-09 10:00:00.1234567"],
        ["trailing rubbish", "2026-08-09 10:00:00 OR 1=1"],
        [
          "an era suffix, which is outside the supported domain",
          "2026-08-09 BC",
        ],
      ])("refuses %s", (_why, value) => {
        refuses(core_users.createdAt, value);
      });

      it.each([
        ["29 February in a leap year", "2024-02-29"],
        ["29 February in a leap century", "2000-02-29"],
        ["the last second of a day", "2026-08-09 23:59:59"],
        ["the first second of a day", "2026-08-09 00:00:00"],
        ["31 December", "2026-12-31"],
        ["microseconds", "2026-08-09 10:00:00.123456"],
        ["a whole-hour offset", "2026-08-09 10:00:00+02"],
        ["a half-hour offset", "2026-08-09 10:00:00+05:30"],
        ["a compact offset", "2026-08-09 10:00:00-0400"],
        ["a negative offset", "2026-08-09 10:00:00-04"],
      ])("accepts %s", (_why, value) => {
        expect(cursorValueForColumn(core_users.createdAt, value)).toBe(value);
      });

      it("preserves microseconds through validation, digit for digit", () => {
        // The reason the value is kept as text at all. Anything that reformats
        // it here is a truncation the next comparison inherits.
        const value = "2026-08-09 10:00:00.000001";

        expect(cursorValueForColumn(core_users.createdAt, value)).toBe(value);
      });
    });
  });

  /**
   * A `date` and a `time` column look like strings to Drizzle - `dataType` says
   * `"string"` - but Postgres still has to parse them. Classifying from the SQL
   * type is what stops `'nonsense'::date` being a 500.
   */
  describe("other temporal columns", () => {
    it("holds a date column to a date, and nothing more", () => {
      expect(cursorValueForColumn(probes.day, "2026-08-09")).toBe("2026-08-09");
      refuses(probes.day, "2026-08-09 10:00:00");
      refuses(probes.day, "2026-02-30");
      refuses(probes.day, "not-a-date");
    });

    it("holds a time column to a time, and refuses a zone it has not got", () => {
      expect(cursorValueForColumn(probes.clock, "10:00:00")).toBe("10:00:00");
      expect(cursorValueForColumn(probes.clock, "10:00:00.123456")).toBe(
        "10:00:00.123456",
      );
      refuses(probes.clock, "10:00:00+02");
      refuses(probes.clock, "24:00:00");
      refuses(probes.clock, "2026-08-09");
    });

    it("lets a time-with-zone column carry its zone", () => {
      expect(cursorValueForColumn(probes.clockTz, "10:00:00+02")).toBe(
        "10:00:00+02",
      );
      refuses(probes.clockTz, "10:00:00+25");
    });

    it("binds every temporal column as text plus a cast", () => {
      for (const column of [probes.day, probes.clock, probes.clockTz]) {
        expect(cursorValueIsCanonicalText(column)).toBe(true);
        expect(isCursorSortableColumn(column)).toBe(true);
      }
    });
  });

  describe("string", () => {
    it.each([
      ["a number", 12],
      ["a boolean", true],
    ])("refuses %s", (_why, value) => {
      refuses(core_users.name, value);
    });

    it("accepts a string, and null", () => {
      expect(cursorValueForColumn(core_users.name, "Ada")).toBe("Ada");
      expect(cursorValueForColumn(core_users.name, null)).toBeNull();
    });
  });

  it("never lets a native parser error escape", () => {
    // Whatever is thrown, it is an `HTTPException` - not a `SyntaxError`, a
    // `RangeError`, or anything else that would surface as a 500.
    const hostile = [
      [probes.big, "nope"],
      [core_users.createdAt, "nope"],
      [core_users.newsletter, "nope"],
      [core_users.id, "nope"],
    ] as const;

    for (const [column, value] of hostile) {
      try {
        cursorValueForColumn(column, value);
        throw new Error(`Expected ${column.name} to refuse ${value}.`);
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
      }
    }
  });
});

describe("minting keeps the database's own representation", () => {
  it("keeps a Postgres timestamp string exactly as it was read", () => {
    // Microseconds and all: this is the value the next comparison is parsed
    // from, so anything lost here is lost from the ordering.
    expect(
      cursorValueOf(core_users.createdAt, "2026-08-09 10:00:00.123456"),
    ).toBe("2026-08-09 10:00:00.123456");
  });

  it("rewrites a Date into the form the column would have been read in", () => {
    // A `Date` only arrives when a caller mints from a value it is holding -
    // the paginated path reads `::text`. Writing it the way Postgres writes a
    // `timestamp` keeps minting and validation speaking one grammar, so a
    // cursor this module produced can never be one it later refuses.
    expect(
      cursorValueOf(core_users.createdAt, new Date("2026-08-09T10:00:00.123Z")),
    ).toBe("2026-08-09 10:00:00.123");
  });

  it("refuses a Date that is not a moment, rather than minting nonsense", () => {
    expect(() =>
      cursorValueOf(core_users.createdAt, new Date("not-a-date")),
    ).toThrow(/invalid date/i);
  });

  it("carries a bigint as a decimal string, which JSON can hold", () => {
    expect(cursorValueOf(probes.big, 9007199254740993n)).toBe(
      "9007199254740993",
    );
  });
});
