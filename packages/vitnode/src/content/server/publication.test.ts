// @vitest-environment node
import type { SQL } from "drizzle-orm";

import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  testCategoryContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import { ContentEngineError } from "../errors";
import { createContentModel } from "./model";
import {
  publicationColumns,
  publicationMethods,
  publishedCondition,
} from "./publication";

const categories = createContentModel(testCategoryContentType);
const posts = createContentModel(testPostContentType, {
  references: { category: () => categories.table.id },
});

const dialect = new PgDialect();

/** The SQL text and bound parameters Drizzle would actually send. */
const compile = (condition: SQL | undefined) => {
  if (!condition) throw new Error("Expected a condition.");

  return dialect.sqlToQuery(condition);
};

describe("publishedCondition", () => {
  it("compiles the full published invariant", () => {
    const { params, sql } = compile(publishedCondition(posts.columns));

    // All three clauses, in one predicate. Dropping `IS NOT NULL` would leak a
    // row whose timestamp was cleared by hand, which is the whole reason this
    // is exported rather than written out at each call site.
    expect(sql).toBe(
      '(("test_posts"."status" = $1) and (("test_posts"."publishedAt" is not null)) and ("test_posts"."publishedAt" <= now()))',
    );
    expect(params).toEqual(["published"]);
  });

  it("binds the status rather than inlining it", () => {
    expect(compile(publishedCondition(posts.columns)).sql).not.toContain(
      "'published'",
    );
  });
});

describe("publicationColumns", () => {
  it("picks the two columns out of an erased map", () => {
    // Generic code holds `Record<string, PgColumn>`, which does not satisfy the
    // narrowed parameter type. This is the runtime step that makes it true.
    const narrowed = publicationColumns(testPostContentType, posts.columns);

    expect(Object.keys(narrowed).sort()).toEqual(["publishedAt", "status"]);
    expect(compile(publishedCondition(narrowed)).params).toEqual(["published"]);
  });

  it("throws for a content type without publication", () => {
    expect(() =>
      publicationColumns(testCategoryContentType, categories.columns),
    ).toThrow(ContentEngineError);
  });

  it("throws when the columns are missing, whatever the flag says", () => {
    // Belt and braces: the presence check is what stops `undefined` reaching
    // Drizzle if a caller hands over the wrong column map.
    expect(() => publicationColumns(testPostContentType, {})).toThrow(
      ContentEngineError,
    );
  });
});

describe("publicationMethods", () => {
  it("returns the publish methods for a publication content type", () => {
    const service = posts.service({ get: () => undefined } as never);
    const methods = publicationMethods(testPostContentType, service);

    expect(typeof methods.publish).toBe("function");
    expect(typeof methods.unpublish).toBe("function");
  });

  it("throws for a content type without publication", () => {
    const service = categories.service({ get: () => undefined } as never);

    expect(() => publicationMethods(testCategoryContentType, service)).toThrow(
      ContentEngineError,
    );
    expect(() => publicationMethods(testCategoryContentType, service)).toThrow(
      /publication: \{ enabled: true \}/,
    );
  });
});
