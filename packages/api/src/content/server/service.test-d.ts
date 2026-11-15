import type { Context } from "hono";

import { describe, it } from "vitest";

import {
  testArticleContentType,
  testCategoryContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import { createContentModel } from "./model";

const categories = createContentModel(testCategoryContentType);
const articles = createContentModel(testArticleContentType, {
  references: { category: () => categories.table.id },
});
const posts = createContentModel(testPostContentType, {
  references: { category: () => categories.table.id },
});

const service = articles.service({} as Context);
const postService = posts.service({} as Context);
const categoryService = categories.service({} as Context);

describe("findMany filters", () => {
  it("accepts every filterable field", () => {
    void service.findMany({
      filters: {
        author: null,
        category: 2,
        featured: true,
        status: "published",
        title: "Hello",
        views: 10,
      },
    });
  });

  it("rejects unknown, non-filterable and mistyped filters", () => {
    // @ts-expect-error - no such field
    void service.findMany({ filters: { nope: 1 } });
    // @ts-expect-error - `textarea` is not filterable
    void service.findMany({ filters: { excerpt: "prose" } });
    // @ts-expect-error - "sideways" is not one of the declared values
    void service.findMany({ filters: { status: "sideways" } });
    // @ts-expect-error - a relation filter is an id, not a label
    void service.findMany({ filters: { category: "News" } });
    // @ts-expect-error - `category` is required and NOT NULL
    void service.findMany({ filters: { category: null } });
  });

  it("filters publication status only on a publication content type", () => {
    void postService.findMany({ filters: { status: "draft" } });
    // @ts-expect-error - "archived" is not a generated publication status
    void postService.findMany({ filters: { status: "archived" } });
    // @ts-expect-error - no `status` column to filter on
    void categoryService.findMany({ filters: { status: "draft" } });
  });
});

describe("findMany ordering", () => {
  it("accepts system columns, declared fields and generated columns", () => {
    void service.findMany({ orderBy: { column: "id", order: "asc" } });
    void service.findMany({ orderBy: { column: "title" } });
    void postService.findMany({ orderBy: { column: "publishedAt" } });
  });

  it("rejects a column the content type does not have", () => {
    // @ts-expect-error - not a column of this content type
    void service.findMany({ orderBy: { column: "somethingElse" } });
    // @ts-expect-error - publication is off, so there is no `status`
    void categoryService.findMany({ orderBy: { column: "status" } });
  });
});

describe("feature-gated methods", () => {
  it("offers publish only with publication", () => {
    void postService.publish(1);
    // @ts-expect-error - publication is not enabled on this content type
    void service.publish(1);
  });

  it("offers options only for relation and user fields", () => {
    void service.options("category");
    void service.options("author");
    // @ts-expect-error - a text field has no picker to enumerate
    void service.options("title");
    // @ts-expect-error - an enum renders its own values, not a picker
    void service.options("status");
  });
});
