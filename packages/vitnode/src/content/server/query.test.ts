// @vitest-environment node
import type { SQL } from "drizzle-orm";

import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { defineContentType } from "@/content/define";
import { field } from "@/content/fields";
import {
  testArticleContentType,
  testCategoryContentType,
} from "@/tests/content-fixtures";

import { ContentEngineError } from "../errors";
import {
  buildFilterCondition,
  buildOrderColumn,
  buildSearchCondition,
  diffChangedFields,
  escapeLikePattern,
  toColumnValues,
} from "./query";
import { contentTableColumns, createContentTable } from "./table";

const categories = createContentTable(
  testArticleContentType.fields.category.kind === "relation"
    ? testArticleContentType.fields.category.target()
    : testArticleContentType,
);
const table = createContentTable(testArticleContentType, {
  references: { category: () => categories.id },
});
const columns = contentTableColumns(testArticleContentType, table);
const fields = testArticleContentType.fields;
const contentTypeId = testArticleContentType.id;

/**
 * A focused fixture for the null-filter rules: the shared article type has a
 * nullable `user` field but no nullable *relation*, and both sides of that rule
 * need proving.
 */
const referenceType = defineContentType({
  id: "test.reference",
  tableName: "test_references",
  fields: {
    parent: field.relation({
      nullable: true,
      onDelete: "set null",
      target: () => testCategoryContentType,
    }),
    root: field.relation({
      required: true,
      onDelete: "restrict",
      target: () => testCategoryContentType,
    }),
  },
  admin: { label: { plural: "References", singular: "Reference" } },
});

const referenceTable = createContentTable(referenceType, {
  references: { parent: () => categories.id, root: () => categories.id },
});
const referenceColumns = contentTableColumns(referenceType, referenceTable);

const dialect = new PgDialect();

/** The SQL text and bound parameters Drizzle would actually send. */
const compile = (
  condition: SQL | undefined,
): { params: unknown[]; sql: string } => {
  if (!condition) throw new Error("Expected a condition.");

  const { params, sql } = dialect.sqlToQuery(condition);

  return { params, sql };
};

/** Pulls the bound `ilike` patterns out of a built SQL condition. */
const patternsIn = (condition: unknown): string[] => {
  if (typeof condition === "string") return [condition];
  if (
    condition &&
    typeof condition === "object" &&
    "queryChunks" in condition &&
    Array.isArray(condition.queryChunks)
  ) {
    return condition.queryChunks.flatMap(patternsIn);
  }

  return [];
};

describe("escapeLikePattern", () => {
  it.each([
    ["100%", "100\\%"],
    ["a_b", "a\\_b"],
    ["back\\slash", "back\\\\slash"],
    ["plain", "plain"],
  ])("escapes %s", (input, expected) => {
    expect(escapeLikePattern(input)).toBe(expected);
  });
});

describe("buildSearchCondition", () => {
  it("returns nothing without a term or columns", () => {
    expect(buildSearchCondition([columns.title], undefined)).toBeUndefined();
    expect(buildSearchCondition([columns.title], "   ")).toBeUndefined();
    expect(buildSearchCondition([], "hello")).toBeUndefined();
  });

  it("escapes wildcards so a literal % cannot match every row", () => {
    expect(patternsIn(buildSearchCondition([columns.title], "100%"))).toEqual([
      "%100\\%%",
    ]);
  });

  it("passes a plain term through unescaped", () => {
    expect(patternsIn(buildSearchCondition([columns.title], "hello"))).toEqual([
      "%hello%",
    ]);
  });

  it("searches every given column", () => {
    expect(
      patternsIn(buildSearchCondition([columns.title, columns.excerpt], "hi")),
    ).toEqual(["%hi%", "%hi%"]);
  });
});

describe("buildFilterCondition", () => {
  const filter = (filters: Record<string, unknown>) =>
    buildFilterCondition({ columns, contentTypeId, fields, filters });

  it("ignores undefined values", () => {
    expect(filter({ status: undefined })).toBeUndefined();
  });

  it("joins several conditions with and", () => {
    const { params, sql } = compile(filter({ category: 3, status: "draft" }));

    expect(sql).toBe(
      '("test_articles"."category" = $1 and "test_articles"."status" = $2)',
    );
    expect(params).toEqual([3, "draft"]);
  });

  it.each([
    ["text", "title", "Hello", "Hello"],
    ["enum", "status", "draft", "draft"],
    ["number", "views", 3, 3],
    ["boolean", "featured", true, true],
    ["relation", "category", 3, 3],
    ["user", "author", 5, 5],
  ])("filters a %s field by equality", (_kind, name, value, expected) => {
    const { params, sql } = compile(filter({ [name]: value }));

    expect(sql).toBe(`"test_articles"."${name}" = $1`);
    expect(params).toEqual([expected]);
  });

  it("coerces the string form of a boolean filter", () => {
    expect(compile(filter({ featured: "true" })).params).toEqual([true]);
    expect(compile(filter({ featured: "false" })).params).toEqual([false]);
  });

  it("rejects a filter that is not a declared field", () => {
    expect(() => filter({ "id; drop table": 1 })).toThrow(ContentEngineError);
  });

  // The public filter type already excludes these kinds. A cast, a JavaScript
  // caller or an object assembled at runtime does not, so the runtime guard is
  // the one that actually holds the contract.
  it("rejects a textarea field, which has no equality filter", () => {
    expect(() => filter({ excerpt: "text" })).toThrow(
      /Field "excerpt" of kind "textarea" cannot be used as a generated equality filter/,
    );
  });

  it("rejects a dateTime field, which has no equality filter", () => {
    expect(() => filter({ publishedAt: "2026-08-03T10:00:00.000Z" })).toThrow(
      /Field "publishedAt" of kind "dateTime" cannot be used as a generated equality filter/,
    );
  });

  it("names the content type when it rejects a kind", () => {
    expect(() => filter({ excerpt: "text" })).toThrow(/test\.article/);
  });

  describe("null", () => {
    const referenceFilter = (filters: Record<string, unknown>) =>
      buildFilterCondition({
        columns: referenceColumns,
        contentTypeId: referenceType.id,
        fields: referenceType.fields,
        filters,
      });

    it("builds IS NULL for a nullable user field", () => {
      const { params, sql } = compile(filter({ author: null }));

      expect(sql).toBe('"test_articles"."author" is null');
      expect(params).toEqual([]);
    });

    it("builds IS NULL for a nullable relation field", () => {
      expect(compile(referenceFilter({ parent: null })).sql).toBe(
        '"test_references"."parent" is null',
      );
    });

    it("still uses equality for a real identifier", () => {
      const { params, sql } = compile(referenceFilter({ parent: 4 }));

      expect(sql).toBe('"test_references"."parent" = $1');
      expect(params).toEqual([4]);
    });

    it("rejects null on a non-nullable relation rather than generating IS NULL", () => {
      expect(() => referenceFilter({ root: null })).toThrow(
        /Field "root" is not nullable/,
      );
      expect(() => referenceFilter({ root: null })).toThrow(/test\.reference/);
    });

    it("mixes IS NULL with an equality condition", () => {
      expect(compile(referenceFilter({ parent: null, root: 2 })).sql).toBe(
        '("test_references"."parent" is null and "test_references"."root" = $1)',
      );
    });
  });
});

describe("buildOrderColumn", () => {
  const orderable = ["title", "status", "createdAt", "updatedAt", "id"];

  it("falls back to the default when nothing is requested", () => {
    expect(
      buildOrderColumn({
        columns,
        contentTypeId,
        fallback: "updatedAt",
        orderBy: undefined,
        orderable,
      }),
    ).toBe(columns.updatedAt);
  });

  it("resolves an allowlisted column", () => {
    expect(
      buildOrderColumn({
        columns,
        contentTypeId,
        fallback: "updatedAt",
        orderBy: "title",
        orderable,
      }),
    ).toBe(columns.title);
  });

  it("rejects a column outside the allowlist", () => {
    expect(() =>
      buildOrderColumn({
        columns,
        contentTypeId,
        fallback: "updatedAt",
        orderBy: "views",
        orderable,
      }),
    ).toThrow(/Cannot order by "views"/);
  });

  it("never lets a raw identifier through", () => {
    expect(() =>
      buildOrderColumn({
        columns,
        contentTypeId,
        fallback: "updatedAt",
        orderBy: "id) --",
        orderable,
      }),
    ).toThrow(ContentEngineError);
  });
});

describe("diffChangedFields", () => {
  const names = ["publishedAt", "status", "title", "views"] as const;
  const current = {
    publishedAt: new Date("2026-01-01T00:00:00.000Z"),
    status: "draft",
    title: "Hello",
    views: 3,
  };

  it("reports only the keys that actually moved", () => {
    expect(
      diffChangedFields(names, current, {
        status: "draft",
        title: "Changed",
      }),
    ).toEqual(["title"]);
  });

  it("ignores undefined values", () => {
    expect(diffChangedFields(names, current, { title: undefined })).toEqual([]);
  });

  it("never reports a key the content type does not declare", () => {
    expect(
      diffChangedFields(names, current, { smuggled: "value", title: "Moved" }),
    ).toEqual(["title"]);
  });

  it("compares dates by instant, not identity", () => {
    expect(
      diffChangedFields(names, current, {
        publishedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toEqual([]);
    expect(
      diffChangedFields(names, current, {
        publishedAt: "2026-02-01T00:00:00.000Z",
      }),
    ).toEqual(["publishedAt"]);
  });

  it("treats clearing a date as a change", () => {
    expect(diffChangedFields(names, current, { publishedAt: null })).toEqual([
      "publishedAt",
    ]);
  });
});

describe("toColumnValues", () => {
  it("turns ISO strings into Dates for dateTime fields only", () => {
    const result = toColumnValues(fields, {
      publishedAt: "2026-08-02T10:00:00.000Z",
      title: "2026-08-02T10:00:00.000Z",
    });

    expect(result.publishedAt).toBeInstanceOf(Date);
    expect(result.title).toBe("2026-08-02T10:00:00.000Z");
  });

  it("leaves null alone", () => {
    expect(
      toColumnValues(fields, { publishedAt: null }).publishedAt,
    ).toBeNull();
  });
});
