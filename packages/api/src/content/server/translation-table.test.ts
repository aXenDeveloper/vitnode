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

describe("the base table of a localized content type", () => {
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

  it("refuses to build a translation table for it", () => {
    expect(() =>
      createContentTranslationTable(testPostContentType, {
        table: posts.table,
      }),
    ).toThrow(/needs `localization: \{ defaultLocale \}`/);
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
