import type { Context } from "hono";

import { describe, expectTypeOf, it } from "vitest";

import {
  testArticleContentType,
  testCategoryContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import type {
  ContentFieldKind,
  ContentFieldName,
  FilterableContentFieldKind,
} from "../types";
import type { ContentUpdateResult } from "./service";

import { createContentModel } from "./model";

const categories = createContentModel(testCategoryContentType);
const articles = createContentModel(testArticleContentType, {
  references: { category: () => categories.table.id },
});
const posts = createContentModel(testPostContentType, {
  references: { category: () => categories.table.id },
});

type ArticleType = typeof testArticleContentType;

// Never executed - the type checker is the whole point.
const service = articles.service({} as Context);
const postService = posts.service({} as Context);
const categoryService = categories.service({} as Context);

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

  it("accepts null for a nullable field only", () => {
    void service.findMany({ filters: { author: null } });
    void service.findMany({
      // @ts-expect-error - `category` is required and NOT NULL
      filters: { category: null },
    });
  });

  it("only names kinds that exist", () => {
    expectTypeOf<FilterableContentFieldKind>().toExtend<ContentFieldKind>();
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

describe("publication ordering", () => {
  it("accepts the generated columns on a publication content type", () => {
    void postService.findMany({ orderBy: { column: "status" } });
    void postService.findMany({
      orderBy: { column: "publishedAt", order: "desc" },
    });
  });

  it("still accepts declared fields and system columns", () => {
    void postService.findMany({ orderBy: { column: "title" } });
    void postService.findMany({ orderBy: { column: "updatedAt" } });
  });

  // The category fixture has publication disabled *and* declares neither name,
  // which is what makes this a real negative. The article fixture would pass
  // for the wrong reason: it declares its own `status` and `publishedAt`.
  it("does not invent them for a content type without publication", () => {
    // @ts-expect-error - `status` is not a column of this content type
    void categoryService.findMany({ orderBy: { column: "status" } });
    // @ts-expect-error - `publishedAt` is not a column of this content type
    void categoryService.findMany({ orderBy: { column: "publishedAt" } });
  });

  it("leaves a Stage 1 content type ordering by its own fields", () => {
    // Accepted because they are declared fields, not generated columns.
    void service.findMany({ orderBy: { column: "status" } });
    void service.findMany({ orderBy: { column: "publishedAt" } });
  });
});

describe("publication filters", () => {
  it("accepts the two generated statuses", () => {
    void postService.findMany({ filters: { status: "draft" } });
    void postService.findMany({ filters: { status: "published" } });
  });

  it("rejects anything else", () => {
    void postService.findMany({
      // @ts-expect-error - "archived" is not a generated publication status
      filters: { status: "archived" },
    });
  });

  it("is absent from a content type without publication", () => {
    void categoryService.findMany({
      // @ts-expect-error - no `status` column to filter on
      filters: { status: "draft" },
    });
  });
});

describe("publication service methods", () => {
  it("exist on a publication content type", () => {
    void postService.publish(1);
    void postService.unpublish(1, {});
  });

  it("are absent everywhere else", () => {
    // @ts-expect-error - publication is not enabled on this content type
    void service.publish(1);
    // @ts-expect-error - publication is not enabled on this content type
    void categoryService.unpublish(1);
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
