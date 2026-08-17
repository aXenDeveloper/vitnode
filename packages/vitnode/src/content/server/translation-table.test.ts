// @vitest-environment node
import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  testCategoryContentType,
  testLocalizedArticleContentType,
  testLocalizedNoteContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import { createContentModel } from "./model";
import { createContentTranslationTable } from "./translation-table";

const localized = createContentModel(testLocalizedArticleContentType);
const notes = createContentModel(testLocalizedNoteContentType);
const categories = createContentModel(testCategoryContentType);
const posts = createContentModel(testPostContentType, {
  references: { category: () => categories.table.id },
});

type AnyTable = Parameters<typeof getTableConfig>[0];

/** `translationTable` is `null` for a content type without localization. */
const translationTable = (model: { translationTable: AnyTable | null }) => {
  if (!model.translationTable) {
    throw new Error("Expected a generated translation table.");
  }

  return model.translationTable;
};

const configOf = (table: AnyTable | null) => {
  if (!table) throw new Error("Expected a generated translation table.");

  return getTableConfig(table);
};

const base = getTableConfig(localized.table);
const translations = configOf(localized.translationTable);

describe("the base table of a localized content type", () => {
  it("carries the system columns and the shared fields only", () => {
    expect(base.columns.map(column => column.name)).toEqual([
      "id",
      "createdAt",
      "updatedAt",
      "featured",
      "views",
    ]);
  });

  it("has no column for any localized field", () => {
    const names = base.columns.map(column => column.name);

    for (const localizedField of ["title", "slug", "body"]) {
      expect(names).not.toContain(localizedField);
    }
  });

  it("keeps the localized slug's unique index off the base table", () => {
    // A slug is unique *per language*, so its index belongs to the translation
    // table. A base-table unique index would make the URL global.
    expect(base.indexes.map(item => item.config.name)).toEqual([
      "test_localized_articles_created_at_idx",
      "test_localized_articles_updated_at_idx",
    ]);
  });

  it("exposes only shared columns through the column map", () => {
    expect(Object.keys(localized.columns).sort()).toEqual([
      "createdAt",
      "featured",
      "id",
      "updatedAt",
      "views",
    ]);
  });
});

describe("the generated translation table", () => {
  it("is named after the base table", () => {
    expect(getTableName(translationTable(localized))).toBe(
      "test_localized_articles_translations",
    );
  });

  it("enables row level security, like every other generated table", () => {
    expect(translations.enableRLS).toBe(true);
  });

  it("carries the keys, the version, the timestamps and the localized fields", () => {
    expect(translations.columns.map(column => column.name)).toEqual([
      "itemId",
      "languageId",
      "version",
      "createdAt",
      "updatedAt",
      "title",
      "slug",
      "body",
    ]);
  });

  it("has no column for any shared field", () => {
    const names = translations.columns.map(column => column.name);

    expect(names).not.toContain("featured");
    expect(names).not.toContain("views");
  });

  it("materialises real Postgres types rather than a JSON blob", () => {
    const types = Object.fromEntries(
      translations.columns.map(column => [column.name, column.getSQLType()]),
    );

    expect(types).toEqual({
      body: "text",
      createdAt: "timestamp",
      itemId: "integer",
      languageId: "integer",
      slug: "varchar(160)",
      title: "varchar(200)",
      updatedAt: "timestamp",
      version: "integer",
    });
  });

  it("keeps a nullable localized field nullable", () => {
    const columns = Object.fromEntries(
      translations.columns.map(column => [column.name, column]),
    );

    expect(columns.title.notNull).toBe(true);
    expect(columns.body.notNull).toBe(false);
    // Never nullable and never defaulted: a translation nobody can address by
    // URL is not worth allowing.
    expect(columns.slug.notNull).toBe(true);
    expect(columns.slug.default).toBeUndefined();
  });

  it("starts every translation at version 1", () => {
    const version = translations.columns.find(
      column => column.name === "version",
    );

    expect(version?.notNull).toBe(true);
    expect(version?.default).toBe(1);
  });

  it("keys a translation by its record and its language", () => {
    const [primaryKey] = translations.primaryKeys;

    expect(primaryKey.columns.map(column => column.name)).toEqual([
      "itemId",
      "languageId",
    ]);
    expect(primaryKey.getName()).toBe(
      "test_localized_articles_translations_item_id_language_id_pk",
    );
  });

  it("cascades from the record and restricts the language", () => {
    const references = translations.foreignKeys.map(foreignKey => {
      const reference = foreignKey.reference();

      return {
        column: reference.columns[0].name,
        onDelete: foreignKey.onDelete,
        target: getTableName(reference.foreignTable),
      };
    });

    expect(references).toEqual(
      expect.arrayContaining([
        {
          column: "itemId",
          onDelete: "cascade",
          target: "test_localized_articles",
        },
        {
          column: "languageId",
          onDelete: "restrict",
          target: "core_languages",
        },
      ]),
    );
  });

  it("scopes the localized slug's uniqueness to one language", () => {
    const unique = translations.indexes.filter(item => item.config.unique);

    expect(unique).toHaveLength(1);
    expect(unique[0].config.name).toBe(
      "test_localized_articles_translations_language_id_slug_key",
    );
    expect(
      unique[0].config.columns.map(column =>
        "name" in column ? column.name : "",
      ),
    ).toEqual(["languageId", "slug"]);
  });

  it("indexes languageId on its own", () => {
    // `(itemId, languageId)` and `itemId` are served by the primary key; "every
    // row in Polish" is not.
    expect(translations.indexes.map(item => item.config.name)).toContain(
      "test_localized_articles_translations_language_id_idx",
    );
  });

  it("generates deterministic names inside the Postgres limit", () => {
    const names = [
      ...translations.indexes.map(item => item.config.name ?? ""),
      ...translations.primaryKeys.map(key => key.getName()),
    ];

    for (const name of names) {
      expect(name.length).toBeLessThanOrEqual(63);
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("exposes the translation columns through their own map", () => {
    expect(Object.keys(localized.translationColumns ?? {}).sort()).toEqual([
      "body",
      "createdAt",
      "itemId",
      "languageId",
      "slug",
      "title",
      "updatedAt",
      "version",
    ]);
  });
});

describe("a content type without localization", () => {
  it("generates exactly one table", () => {
    expect(posts.translationTable).toBeNull();
    expect(posts.translationColumns).toBeNull();
    expect(posts.translationSchemas).toBeNull();
    expect(posts.translationService).toBeUndefined();
    expect(posts.localizedService).toBeUndefined();
  });

  it("keeps every column it had", () => {
    const names = getTableConfig(posts.table).columns.map(
      column => column.name,
    );

    expect(names).toEqual([
      "id",
      "createdAt",
      "updatedAt",
      "publishedAt",
      "status",
      "title",
      "slug",
      "excerpt",
      "views",
      "author",
      "category",
    ]);
  });

  it("refuses to build a translation table for it", () => {
    expect(() =>
      createContentTranslationTable(testPostContentType, {
        table: posts.table,
      }),
    ).toThrow(/needs `localization: \{ enabled: true, defaultLocale \}`/);
  });
});

describe("a second localized content type", () => {
  it("gets its own tables and its own index names", () => {
    const other = configOf(notes.translationTable);

    expect(getTableName(translationTable(notes))).toBe(
      "test_localized_notes_translations",
    );
    expect(other.indexes.map(item => item.config.name)).toEqual([
      "test_localized_notes_translations_language_id_idx",
      "test_localized_notes_translations_language_id_slug_key",
    ]);
  });
});
