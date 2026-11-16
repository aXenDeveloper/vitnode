import { describe, expect, it } from "vitest";

import {
  AUDIT_ARRAY_MAX_ITEMS,
  AUDIT_CHANGES_MAX_FIELDS,
  AUDIT_MAX_DEPTH,
  AUDIT_OBJECT_MAX_KEYS,
  AUDIT_REDACTED,
  AUDIT_RICH_TEXT,
  AUDIT_STRING_MAX_LENGTH,
  AUDIT_TRUNCATED,
} from "./const";
import {
  isSensitiveAuditKey,
  sanitizeAuditChanges,
  sanitizeAuditMetadata,
  sanitizeAuditValue,
} from "./sanitize";

const nested = (depth: number): unknown =>
  depth === 0 ? "leaf" : { child: nested(depth - 1) };

describe("isSensitiveAuditKey", () => {
  it.each([
    ["accessToken", true],
    ["client_secret", true],
    ["passwordHash", true],
    ["apiKey", true],
    ["recoveryCodes", true],
    ["REFRESH-TOKEN", true],
    ["sessionId", true],
    ["Authorization", true],
    ["maxTokens", false],
    ["keyboard", false],
    ["name", false],
    ["sessionCount", false],
    ["apiVersion", false],
  ])("%s -> %s", (key, sensitive) => {
    expect(isSensitiveAuditKey(key)).toBe(sensitive);
  });
});

describe("sanitizeAuditValue", () => {
  it("cuts a long string", () => {
    const value = sanitizeAuditValue("x".repeat(AUDIT_STRING_MAX_LENGTH + 10));

    expect(value).toBe(`${"x".repeat(AUDIT_STRING_MAX_LENGTH)}…`);
  });

  it("summarises a value nested past the depth limit", () => {
    let value = sanitizeAuditValue(nested(AUDIT_MAX_DEPTH + 2));
    for (let depth = 0; depth < AUDIT_MAX_DEPTH; depth++) {
      value = (value as { child: unknown }).child;
    }

    expect(value).toBe(AUDIT_TRUNCATED);
  });

  it("keeps only an error's name", () => {
    const error = new TypeError("postgres://user:hunter2@db/prod");

    expect(sanitizeAuditValue(error)).toEqual({ error: "TypeError" });
  });

  it("stores a rich-text document as a marker", () => {
    expect(
      sanitizeAuditValue({ content: [{ type: "paragraph" }], type: "doc" }),
    ).toBe(AUDIT_RICH_TEXT);
  });

  it("drops class instances, functions and symbols", () => {
    class Connection {
      password = "hunter2";
    }

    expect(
      sanitizeAuditValue({
        connection: new Connection(),
        fn: () => 1,
        kept: 1,
        symbol: Symbol("x"),
      }),
    ).toEqual({ kept: 1 });
  });

  it("redacts sensitive keys at any depth", () => {
    expect(
      sanitizeAuditValue({
        name: "Ann",
        provider: { clientSecret: "abc", id: "github" },
      }),
    ).toEqual({
      name: "Ann",
      provider: { clientSecret: AUDIT_REDACTED, id: "github" },
    });
  });

  it.each([
    [Number.NaN, null],
    [Number.POSITIVE_INFINITY, null],
    [10n, "10"],
    [new Date("2026-01-02T03:04:05.000Z"), "2026-01-02T03:04:05.000Z"],
    [new Date("not a date"), null],
  ])("turns %s into %s", (input, output) => {
    expect(sanitizeAuditValue(input)).toEqual(output);
  });

  it("cuts long arrays and wide objects with a marker", () => {
    const array = sanitizeAuditValue(
      Array.from({ length: AUDIT_ARRAY_MAX_ITEMS + 5 }, (_, index) => index),
    ) as unknown[];
    const object = sanitizeAuditValue(
      Object.fromEntries(
        Array.from({ length: AUDIT_OBJECT_MAX_KEYS + 5 }, (_, index) => [
          `k${index}`,
          index,
        ]),
      ),
    ) as Record<string, unknown>;

    expect(array).toHaveLength(AUDIT_ARRAY_MAX_ITEMS + 1);
    expect(array.at(-1)).toBe(AUDIT_TRUNCATED);
    expect(Object.keys(object)).toHaveLength(AUDIT_OBJECT_MAX_KEYS + 1);
    expect(object[AUDIT_TRUNCATED]).toBe(true);
  });
});

describe("sanitizeAuditMetadata", () => {
  it("replaces metadata over the size budget with a marker", () => {
    const metadata = Object.fromEntries(
      Array.from({ length: 40 }, (_, index) => [
        `field${index}`,
        "x".repeat(AUDIT_STRING_MAX_LENGTH),
      ]),
    );

    expect(sanitizeAuditMetadata(metadata)).toEqual({
      [AUDIT_TRUNCATED]: true,
    });
  });

  it.each([null, undefined])("is empty for %s", metadata => {
    expect(sanitizeAuditMetadata(metadata)).toEqual({});
  });
});

describe("sanitizeAuditChanges", () => {
  it("keeps only the fact that a sensitive or flagged field changed", () => {
    expect(
      sanitizeAuditChanges({
        name: { from: "a", to: "b" },
        password: { from: "old", to: "new" },
        webhook: { from: "x", redacted: true, to: "y" },
      }),
    ).toEqual({
      name: { from: "a", to: "b" },
      password: { redacted: true },
      webhook: { redacted: true },
    });
  });

  it("keeps at most the field limit", () => {
    const changes = Object.fromEntries(
      Array.from({ length: AUDIT_CHANGES_MAX_FIELDS + 5 }, (_, index) => [
        `f${index}`,
        { from: index, to: index + 1 },
      ]),
    );

    expect(Object.keys(sanitizeAuditChanges(changes) ?? {})).toHaveLength(
      AUDIT_CHANGES_MAX_FIELDS,
    );
  });

  it("drops the values but keeps the field names over the size budget", () => {
    const long = "x".repeat(AUDIT_STRING_MAX_LENGTH);
    const changes = Object.fromEntries(
      Array.from({ length: 20 }, (_, index) => [
        `f${index}`,
        { from: long, to: long },
      ]),
    );

    const result = sanitizeAuditChanges({
      ...changes,
      token: { from: "a", to: "b" },
    });

    expect(result?.f0).toEqual({ from: AUDIT_TRUNCATED, to: AUDIT_TRUNCATED });
    expect(result?.token).toEqual({ redacted: true });
    expect(Object.keys(result ?? {})).toHaveLength(21);
  });

  it.each([null, undefined, {}])("is null for %s", changes => {
    expect(sanitizeAuditChanges(changes)).toBeNull();
  });
});
