import type { Context } from "hono";

import { describe, expectTypeOf, it } from "vitest";

import {
  testArticleContentType,
  testCategoryContentType,
} from "@/tests/content-fixtures";

import type { ContentFieldName } from "../types";
import type { ContentUpdateResult } from "./service";

import { createContentModel } from "./model";

const categories = createContentModel(testCategoryContentType);
const articles = createContentModel(testArticleContentType, {
  references: { category: () => categories.table.id },
});

type ArticleType = typeof testArticleContentType;

// Never executed - the type checker is the whole point.
const service = articles.service({} as Context);

describe("findMany filters", () => {
  it("accepts every filterable field", () => {
    void service.findMany({
      filters: {
        author: 4,
        category: 2,
        featured: true,
        status: "published",
        title: "Hello",
        views: 10,
      },
    });
  });

  it("rejects a field name that does not exist", () => {
    void service.findMany({
      // @ts-expect-error - no such field
      filters: { nope: 1 },
    });
  });

  it("rejects fields the filter schema does not generate", () => {
    void service.findMany({
      // @ts-expect-error - `textarea` is not filterable
      filters: { excerpt: "prose" },
    });
    void service.findMany({
      // @ts-expect-error - `dateTime` is not filterable
      filters: { publishedAt: "2026-08-02T10:00:00.000Z" },
    });
  });

  it("keeps enum filter values literal", () => {
    void service.findMany({
      // @ts-expect-error - "sideways" is not one of the declared values
      filters: { status: "sideways" },
    });
  });

  it("takes identifiers for relation and user filters", () => {
    void service.findMany({
      // @ts-expect-error - a relation filter is an id, not a label
      filters: { category: "News" },
    });
  });
});

describe("findMany ordering", () => {
  it("accepts system columns", () => {
    void service.findMany({ orderBy: { column: "createdAt" } });
    void service.findMany({ orderBy: { column: "id", order: "asc" } });
  });

  it("accepts declared fields", () => {
    void service.findMany({ orderBy: { column: "title" } });
  });

  it("rejects a column that is not part of the content type", () => {
    // The exact `orderableFields` array is not recoverable from the resolved
    // admin config, so the type is an approximation - anything outside the
    // content type still fails here, and the runtime allowlist is stricter.
    // @ts-expect-error - not a column of this content type
    void service.findMany({ orderBy: { column: "somethingElse" } });
  });
});

describe("options", () => {
  it("accepts relation and user fields", () => {
    void service.options("category");
    void service.options("author");
  });

  it("rejects every other field kind", () => {
    // @ts-expect-error - a text field has no picker to enumerate
    void service.options("title");
    // @ts-expect-error - a textarea field has no picker to enumerate
    void service.options("excerpt");
    // @ts-expect-error - a number field has no picker to enumerate
    void service.options("views");
    // @ts-expect-error - a boolean field has no picker to enumerate
    void service.options("featured");
    // @ts-expect-error - an enum renders its own values, not a picker
    void service.options("status");
    // @ts-expect-error - a dateTime field has no picker to enumerate
    void service.options("publishedAt");
  });
});

describe("update result", () => {
  it("narrows changedFields to the content type's field names", () => {
    expectTypeOf<
      ContentUpdateResult<ArticleType>["changedFields"]
    >().toEqualTypeOf<ContentFieldName<ArticleType>[]>();

    expectTypeOf<
      ContentUpdateResult<ArticleType>["changedFields"][number]
    >().toEqualTypeOf<
      | "author"
      | "category"
      | "excerpt"
      | "featured"
      | "publishedAt"
      | "status"
      | "title"
      | "views"
    >();
  });

  it("keeps the row typed as the content type's select shape", () => {
    expectTypeOf<
      ContentUpdateResult<ArticleType>["row"]["status"]
    >().toEqualTypeOf<"archived" | "draft" | "published">();
  });
});
