import type { SQL } from "drizzle-orm";

import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  emailAliases,
  matchesEmail,
  pickAccountForEmail,
} from "./user-email-lookup";

const dialect = new PgDialect();

const compile = (condition: SQL | undefined) => {
  if (!condition) throw new Error("Expected a condition.");

  return dialect.sqlToQuery(condition);
};

describe("emailAliases", () => {
  it("pairs the address as typed with its canonical form", () => {
    expect(emailAliases("jan.kowalski@googlemail.com")).toEqual([
      "jan.kowalski@googlemail.com",
      "jankowalski@gmail.com",
    ]);
  });

  it("does not repeat an address that is already canonical", () => {
    expect(emailAliases("zofia.nowak@company.com")).toEqual([
      "zofia.nowak@company.com",
    ]);
  });
});

describe("matchesEmail", () => {
  it("searches the email column for every alias", () => {
    const { sql, params } = compile(
      matchesEmail("jan.kowalski@googlemail.com"),
    );

    expect(sql).toContain('"email"');
    expect(params).toEqual([
      "jan.kowalski@googlemail.com",
      "jankowalski@gmail.com",
    ]);
  });
});

describe("pickAccountForEmail", () => {
  it("returns nothing when no account matched", () => {
    expect(pickAccountForEmail([], "jan@gmail.com")).toBeUndefined();
  });

  it("prefers the account whose stored address is the one that was typed", () => {
    const rows = [
      { id: 1, email: "jankowalski@gmail.com" },
      { id: 2, email: "jan.kowalski@gmail.com" },
    ];

    expect(pickAccountForEmail(rows, "jan.kowalski@gmail.com")?.id).toBe(2);
    expect(pickAccountForEmail(rows, "jankowalski@gmail.com")?.id).toBe(1);
  });

  it("falls back to the canonical match when the typed address is nobody's", () => {
    const rows = [{ id: 1, email: "jankowalski@gmail.com" }];

    expect(
      pickAccountForEmail(rows, "jan.kowalski+ref@googlemail.com")?.id,
    ).toBe(1);
  });
});
