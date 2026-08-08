// @vitest-environment node
import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";

import { core_users } from "@/database/users";

import {
  cursorValueForColumn,
  cursorValueOf,
  decodePaginationCursor,
  encodePaginationCursor,
  isCursorSortableColumn,
} from "./pagination-cursor";

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
  it("flattens a Date to an ISO string and back", () => {
    const date = new Date("2026-08-08T12:00:00.000Z");
    const flattened = cursorValueOf(core_users.createdAt, date);

    expect(flattened).toBe("2026-08-08T12:00:00.000Z");
    // Back as a `Date`, because that is what the column compares against -
    // handing Postgres the string would compare a timestamp with text.
    expect(cursorValueForColumn(core_users.createdAt, flattened)).toEqual(date);
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

  it("refuses an unparseable date rather than comparing against Invalid Date", () => {
    expect(() =>
      cursorValueForColumn(core_users.createdAt, "not-a-date"),
    ).toThrow(HTTPException);
  });

  it("accepts the sortable column kinds", () => {
    expect(isCursorSortableColumn(core_users.id)).toBe(true);
    expect(isCursorSortableColumn(core_users.name)).toBe(true);
    expect(isCursorSortableColumn(core_users.createdAt)).toBe(true);
    expect(isCursorSortableColumn(core_users.newsletter)).toBe(true);
  });
});
