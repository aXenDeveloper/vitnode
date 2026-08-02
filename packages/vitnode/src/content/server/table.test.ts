// @vitest-environment node
import { getTableName, is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { core_users } from "@/database/users";
import {
  testArticleContentType,
  testCategoryContentType,
} from "@/tests/content-fixtures";

import { defineContentType } from "../define";
import { ContentEngineError } from "../errors";
import { field } from "../fields";
import { createContentTable } from "./table";

const categories = createContentTable(testCategoryContentType);
const articles = createContentTable(testArticleContentType, {
  references: { category: () => categories.id },
});

const config = getTableConfig(articles);
const column = (name: string) =>
  config.columns.find(item => item.name === name);

const foreignKeys = config.foreignKeys.map(fk => {
  const reference = fk.reference();

  return {
    columns: reference.columns.map(item => item.name),
    onDelete: fk.onDelete,
    onUpdate: fk.onUpdate,
    table: getTableName(reference.foreignTable),
    targets: reference.foreignColumns.map(item => item.name),
  };
});

describe("createContentTable", () => {
  it("produces a real Drizzle table Drizzle Kit can discover", () => {
    // `drizzle-kit`'s `prepareFromExports` collects schema by runtime identity,
    // so this is the property that makes generated tables migratable.
    expect(is(articles, PgTable)).toBe(true);
    expect(getTableName(articles)).toBe("test_articles");
  });

  it("enables row level security, like every other VitNode table", () => {
    expect(config.enableRLS).toBe(true);
  });

  describe("system columns", () => {
    it("adds a serial primary key", () => {
      expect(column("id")?.getSQLType()).toBe("serial");
      expect(column("id")?.primary).toBe(true);
    });

    it("adds createdAt and updatedAt with defaults", () => {
      for (const name of ["createdAt", "updatedAt"]) {
        expect(column(name)?.getSQLType()).toBe("timestamp");
        expect(column(name)?.notNull).toBe(true);
        expect(column(name)?.hasDefault).toBe(true);
      }
    });

    it("refreshes updatedAt on write", () => {
      expect(column("updatedAt")?.onUpdateFn).toBeTypeOf("function");
      expect(column("createdAt")?.onUpdateFn).toBeUndefined();
    });
  });

  describe("field columns", () => {
    it.each([
      ["title", "varchar(200)", true],
      ["excerpt", "text", false],
      ["views", "integer", true],
      ["featured", "boolean", true],
      ["status", "varchar(64)", true],
      ["publishedAt", "timestamp", false],
      ["author", "integer", false],
      ["category", "integer", true],
    ])("maps %s to %s", (name, sqlType, notNull) => {
      expect(column(name)?.getSQLType()).toBe(sqlType);
      expect(column(name)?.notNull).toBe(notNull);
    });

    it("carries declared defaults into the column", () => {
      expect(column("status")?.hasDefault).toBe(true);
      expect(column("status")?.default).toBe("draft");
      expect(column("views")?.default).toBe(0);
      expect(column("featured")?.default).toBe(false);
    });

    it("leaves undeclared defaults off", () => {
      expect(column("title")?.hasDefault).toBe(false);
      expect(column("publishedAt")?.hasDefault).toBe(false);
    });

    it("keeps enum values on the column", () => {
      expect(column("status")?.enumValues).toEqual([
        "draft",
        "published",
        "archived",
      ]);
    });

    it("uses double precision for non-integer numbers", () => {
      const table = createContentTable(
        defineContentType({
          id: "test.metric",
          tableName: "test_metrics",
          fields: { score: field.number({ integer: false, required: true }) },
          admin: { label: { plural: "Metrics", singular: "Metric" } },
        }),
      );

      expect(
        getTableConfig(table)
          .columns.find(item => item.name === "score")
          ?.getSQLType(),
      ).toBe("double precision");
    });
  });

  describe("foreign keys", () => {
    it("points user fields at core_users", () => {
      expect(foreignKeys).toContainEqual({
        columns: ["author"],
        onDelete: "set null",
        onUpdate: "cascade",
        table: getTableName(core_users),
        targets: ["id"],
      });
    });

    it("points relation fields at the referenced content table", () => {
      expect(foreignKeys).toContainEqual({
        columns: ["category"],
        onDelete: "restrict",
        onUpdate: "cascade",
        table: "test_categories",
        targets: ["id"],
      });
    });

    it("rejects a relation with no reference thunk", () => {
      expect(() => createContentTable(testArticleContentType)).toThrow(
        ContentEngineError,
      );
    });

    it("rejects a reference for a field that is not a relation", () => {
      // A content type with no relations has an empty `references` type, which
      // does not trip excess-property checking, so the runtime guard is the
      // one that catches this.
      expect(() =>
        createContentTable(testCategoryContentType, {
          references: { title: () => categories.id },
        }),
      ).toThrow(/not a relation field/);
    });
  });

  describe("indexes", () => {
    const names = config.indexes.map(item => item.config.name);

    it("indexes the timestamps used for default ordering", () => {
      expect(names).toContain("test_articles_created_at_idx");
      expect(names).toContain("test_articles_updated_at_idx");
    });

    it("indexes every foreign key", () => {
      expect(names).toContain("test_articles_author_idx");
      expect(names).toContain("test_articles_category_idx");
    });

    it("adds declared composite indexes", () => {
      expect(names).toContain("test_articles_status_createdat_idx");
    });

    it("supports unique declared indexes", () => {
      const table = createContentTable(
        defineContentType({
          id: "test.slug",
          tableName: "test_slugs",
          fields: { slug: field.text({ required: true }) },
          indexes: [
            { name: "test_slugs_slug_key", on: ["slug"], unique: true },
          ],
          admin: { label: { plural: "Slugs", singular: "Slug" } },
        }),
      );
      const slugIndex = getTableConfig(table).indexes.find(
        item => item.config.name === "test_slugs_slug_key",
      );

      expect(slugIndex?.config.unique).toBe(true);
    });
  });
});
