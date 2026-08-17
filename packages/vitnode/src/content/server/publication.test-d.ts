import type { PgColumn } from "drizzle-orm/pg-core";

import { describe, it } from "vitest";

import {
  testArticleContentType,
  testCategoryContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import { createContentModel } from "./model";
import { publishedCondition } from "./publication";

const categories = createContentModel(testCategoryContentType);
const articles = createContentModel(testArticleContentType, {
  references: { category: () => categories.table.id },
});
const posts = createContentModel(testPostContentType, {
  references: { category: () => categories.table.id },
});

describe("publishedCondition", () => {
  it("accepts the columns of a publication content type", () => {
    void publishedCondition(posts.columns);
  });

  it("rejects the columns of a content type without publication", () => {
    // @ts-expect-error - publication is off, so there is no `status` or
    // `publishedAt` column to compare against
    void publishedCondition(categories.columns);
  });

  it("accepts a hand-assembled pair of columns", () => {
    // Structural, deliberately: the helper is a predicate over two columns, not
    // over a `ContentModel`, so a custom table with the same two names works.
    const manual: { publishedAt: PgColumn; status: PgColumn } = {
      publishedAt: posts.columns.publishedAt,
      status: posts.columns.status,
    };

    void publishedCondition(manual);
  });

  it("accepts a Stage 1 content type that declares both names itself", () => {
    // The flip side of being structural. This fixture declares its own `status`
    // enum and `publishedAt` date field, so the predicate compiles and compares
    // real columns - it just is not the generated lifecycle. Enabling
    // `publication` is what makes the two columns mean what this helper assumes.
    void publishedCondition(articles.columns);
  });
});
