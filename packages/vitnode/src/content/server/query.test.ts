// @vitest-environment node
import { describe, expect, it } from "vitest";

import { testArticleContentType } from "@/tests/content-fixtures";

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
  it("ignores undefined values", () => {
    expect(
      buildFilterCondition({
        columns,
        contentTypeId,
        fields,
        filters: { status: undefined },
      }),
    ).toBeUndefined();
  });

  it("builds an equality condition per filter", () => {
    const condition = buildFilterCondition({
      columns,
      contentTypeId,
      fields,
      filters: { category: 3, status: "draft" },
    });

    expect(condition).toBeDefined();
  });

  it("coerces the string form of a boolean filter", () => {
    expect(
      buildFilterCondition({
        columns,
        contentTypeId,
        fields,
        filters: { featured: "true" },
      }),
    ).toBeDefined();
  });

  it("rejects a filter that is not a declared field", () => {
    expect(() =>
      buildFilterCondition({
        columns,
        contentTypeId,
        fields,
        filters: { "id; drop table": 1 },
      }),
    ).toThrow(ContentEngineError);
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
