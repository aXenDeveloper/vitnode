import { bigint, pgTable, timestamp } from "drizzle-orm/pg-core";
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

/** A bigint order column, which core has only on a table without one. */
const probes = pgTable("cursor_probes", {
  big: bigint({ mode: "bigint" }),
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

  it("falls back to an ISO string only when handed a Date", () => {
    expect(
      cursorValueOf(core_users.createdAt, new Date("2026-08-09T10:00:00.123Z")),
    ).toBe("2026-08-09T10:00:00.123Z");
  });

  it("carries a bigint as a decimal string, which JSON can hold", () => {
    expect(cursorValueOf(probes.big, 9007199254740993n)).toBe(
      "9007199254740993",
    );
  });
});
