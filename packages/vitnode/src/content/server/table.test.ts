// @vitest-environment node
import { getTableName, is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { core_users } from "@/database/users";
import {
  testArticleContentType,
  testCategoryContentType,
} from "@/tests/content-fixtures";

import type { AnyContentTypeDefinition } from "../types";

import { defineContentType } from "../define";
import { ContentEngineError } from "../errors";
import { field } from "../fields";
import { assertContentReferences, createContentTable } from "./table";

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

  it("explains a missing definition instead of throwing a TypeError", () => {
    expect(() =>
      createContentTable(undefined as unknown as AnyContentTypeDefinition),
    ).toThrow(/no definition.*build:plugins.*circular import/s);
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

    it("keeps two content types that reference each other safe", () => {
      // Annotated, not inferred: two definitions that name each other are a
      // circular inference, and this is the shape a plugin would import anyway.
      const shelfType: AnyContentTypeDefinition = defineContentType({
        id: "test.shelf",
        tableName: "test_shelves",
        fields: {
          title: field.text({ required: true }),
          featured: field.relation({
            nullable: true,
            target: () => bookType,
          }),
        },
        admin: { label: { plural: "Shelves", singular: "Shelf" } },
      });
      const bookType: AnyContentTypeDefinition = defineContentType({
        id: "test.book",
        tableName: "test_books",
        fields: {
          title: field.text({ required: true }),
          shelf: field.relation({ required: true, target: () => shelfType }),
        },
        admin: { label: { plural: "Books", singular: "Book" } },
      });

      const shelves = createContentTable(shelfType, {
        references: { featured: () => books.id },
      });
      const books = createContentTable(bookType, {
        references: { shelf: () => shelves.id },
      });

      expect(() => assertContentReferences(shelves)).not.toThrow();
      expect(() => assertContentReferences(books)).not.toThrow();
    });

    it("explains a reference thunk that resolved to nothing", () => {
      // What a half-written `dist` looks like from in here: the target module
      // has not finished emitting, so the import binding is still empty.
      const unbuilt = createContentTable(testArticleContentType, {
        references: { category: () => undefined as never },
      });

      expect(() => assertContentReferences(unbuilt)).toThrow(
        /resolved to nothing.*build:plugins/s,
      );
    });

    it("rejects a relation with no reference thunk", () => {
      expect(() => createContentTable(testArticleContentType)).toThrow(
        ContentEngineError,
      );
    });

    it("accepts a reference that matches the descriptor's target", () => {
      expect(() => assertContentReferences(articles)).not.toThrow();
    });

    it("rejects a reference pointing at a different table", () => {
      const decoys = createContentTable(
        defineContentType({
          id: "test.decoy",
          tableName: "test_decoys",
          fields: { title: field.text({ required: true }) },
          admin: { label: { plural: "Decoys", singular: "Decoy" } },
        }),
      );

      // `field.relation({ target })` says `test_categories`; `references` says
      // `test_decoys`. Nothing but this check stops the two drifting apart.
      const drifted = createContentTable(testArticleContentType, {
        references: { category: () => decoys.id },
      });

      expect(() => assertContentReferences(drifted)).toThrow(
        /targets "test_categories".*points at "test_decoys"/s,
      );
    });

    it("does not resolve any target while the table is being built", () => {
      const exploding = defineContentType({
        id: "test.lazy",
        tableName: "test_lazies",
        fields: {
          other: field.relation({
            required: true,
            target: () => {
              throw new Error("evaluated too early");
            },
          }),
        },
        admin: { label: { plural: "Lazies", singular: "Lazy" } },
      });

      expect(() =>
        createContentTable(exploding, {
          references: { other: () => categories.id },
        }),
      ).not.toThrow();
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

    it("adds declared composite indexes, in snake_case", () => {
      expect(names).toContain("test_articles_status_created_at_idx");
    });

    it("materialises exactly the resolved index set, nothing more", () => {
      // Drizzle types an index name as optional; the engine always sets one.
      const byName = (a: string | undefined, b: string | undefined) =>
        (a ?? "").localeCompare(b ?? "");

      expect([...names].sort(byName)).toEqual(
        testArticleContentType.indexes.map(item => item.name).sort(byName),
      );
    });

    it("supports unique declared indexes", () => {
      const table = createContentTable(
        defineContentType({
          id: "test.code",
          tableName: "test_codes",
          fields: { code: field.text({ required: true }) },
          indexes: [
            { name: "test_codes_code_key", on: ["code"], unique: true },
          ],
          admin: { label: { plural: "Codes", singular: "Code" } },
        }),
      );
      const codeIndex = getTableConfig(table).indexes.find(
        item => item.config.name === "test_codes_code_key",
      );

      expect(codeIndex?.config.unique).toBe(true);
    });

    it("turns `field.text({ unique: true })` into a unique index", () => {
      const table = createContentTable(
        defineContentType({
          id: "test.unique",
          tableName: "test_uniques",
          fields: {
            code: field.text({ required: true, unique: true }),
            label: field.text({ required: true }),
          },
          admin: { label: { plural: "Uniques", singular: "Unique" } },
        }),
      );
      const indexes = getTableConfig(table).indexes;

      expect(
        indexes.find(item => item.config.name === "test_uniques_code_key")
          ?.config.unique,
      ).toBe(true);
      // A plain text field gets nothing at all.
      expect(indexes.map(item => item.config.name)).toEqual([
        "test_uniques_code_key",
        "test_uniques_created_at_idx",
        "test_uniques_updated_at_idx",
      ]);
    });
  });
});
