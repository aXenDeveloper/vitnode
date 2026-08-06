import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { EXAMPLE_MIGRATIONS } from "@/const";

import { example_articles } from "./articles";
import { example_categories } from "./categories";
import {
  example_localized_articles,
  example_localized_articles_translations,
} from "./localized-articles";

const articles = getTableConfig(example_articles);
const categories = getTableConfig(example_categories);
const localizedArticles = getTableConfig(example_localized_articles);

// `translationTable` is `null` for every content type without localization, so
// this narrows once - and fails loudly rather than silently skipping the
// assertions below if the fixture ever stops being localized.
const localizedTranslationTable = (() => {
  if (!example_localized_articles_translations) {
    throw new Error(
      "example.localized-article generated no translation table.",
    );
  }

  return example_localized_articles_translations;
})();
const localizedTranslations = getTableConfig(localizedTranslationTable);

const indexNames = (config: typeof articles) =>
  config.indexes.map(item => item.config.name);

// Drizzle types an index name as optional; the engine always sets one.
const byName = (a: string | undefined, b: string | undefined) =>
  (a ?? "").localeCompare(b ?? "");

const uniqueIndexNames = (config: typeof articles) =>
  config.indexes
    .filter(item => item.config.unique)
    .map(item => item.config.name);

/**
 * The committed migrations, concatenated in apply order. Read as text on
 * purpose: this is the artefact a fresh database actually runs, so asserting on
 * the Drizzle objects alone would not prove the DDL landed.
 */
const migration = EXAMPLE_MIGRATIONS.map(file =>
  readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../../../apps/docs/migrations",
      file,
    ),
    "utf8",
  ),
).join("\n");

describe("example_articles", () => {
  it("is a real table with the expected name", () => {
    expect(getTableName(example_articles)).toBe("example_articles");
  });

  it("enables row level security", () => {
    expect(articles.enableRLS).toBe(true);
  });

  it("exercises every field kind", () => {
    const types = Object.fromEntries(
      articles.columns.map(column => [column.name, column.getSQLType()]),
    );

    expect(types).toMatchObject({
      author: "integer", // user
      category: "integer", // relation
      code: "varchar(100)", // text, unique
      excerpt: "text", // textarea
      featured: "boolean",
      slug: "varchar(160)", // slug
      title: "varchar(200)", // text
      views: "integer", // number
    });
  });

  it("makes the slug column NOT NULL with no default", () => {
    const slug = articles.columns.find(column => column.name === "slug");

    // A row nobody can address by URL is not worth allowing, and there is no
    // sensible default URL to fall back on.
    expect(slug?.notNull).toBe(true);
    expect(slug?.default).toBeUndefined();
  });

  it("generates the publication columns instead of declaring them", () => {
    const columns = Object.fromEntries(
      articles.columns.map(column => [column.name, column]),
    );

    expect(columns.status.getSQLType()).toBe("varchar(32)");
    expect(columns.status.notNull).toBe(true);
    expect(columns.status.default).toBe("draft");

    // "First published at", not "is published" - `unpublish` leaves it set.
    expect(columns.publishedAt.getSQLType()).toBe("timestamp");
    expect(columns.publishedAt.notNull).toBe(false);
    expect(columns.publishedAt.default).toBeUndefined();
  });

  it("generates the editorial version column instead of declaring it", () => {
    const columns = Object.fromEntries(
      articles.columns.map(column => [column.name, column]),
    );

    expect(columns.version.getSQLType()).toBe("integer");
    expect(columns.version.notNull).toBe(true);
    // Defaulted, so adding `editorial` to a populated table is one statement
    // and every pre-existing row starts at version 1.
    expect(columns.version.default).toBe(1);
  });

  it("gives the unique text field and the slug a unique index", () => {
    // The slug needs no `unique: true` - a URL segment is unique by definition.
    expect([...uniqueIndexNames(articles)].sort(byName)).toEqual([
      "example_articles_code_key",
      "example_articles_slug_key",
    ]);
  });

  it("indexes the foreign keys, the timestamps, the declared composite and publication", () => {
    expect([...indexNames(articles)].sort(byName)).toEqual([
      "example_articles_author_idx",
      "example_articles_category_idx",
      "example_articles_code_key",
      "example_articles_created_at_idx",
      "example_articles_slug_key",
      "example_articles_status_created_at_idx",
      // Generated by `publication`: serves the published predicate and the
      // default "newest published first" ordering in one.
      "example_articles_status_published_at_idx",
      "example_articles_updated_at_idx",
    ]);
  });

  it("points its references at the right tables", () => {
    const references = articles.foreignKeys.map(key => {
      const reference = key.reference();

      return {
        column: reference.columns[0].name,
        onDelete: key.onDelete,
        table: getTableName(reference.foreignTable),
      };
    });

    expect(references).toContainEqual({
      column: "author",
      onDelete: "set null",
      table: "core_users",
    });
    expect(references).toContainEqual({
      column: "category",
      onDelete: "restrict",
      table: "example_categories",
    });
  });
});

describe("example_categories", () => {
  it("is a real table with row level security", () => {
    expect(getTableName(example_categories)).toBe("example_categories");
    expect(categories.enableRLS).toBe(true);
  });

  it("has no unique indexes of its own", () => {
    expect(uniqueIndexNames(categories)).toEqual([]);
  });
});

describe("the generated migration", () => {
  it("creates both tables with row level security", () => {
    expect(migration).toContain('CREATE TABLE "example_articles"');
    expect(migration).toContain('CREATE TABLE "example_categories"');
    expect(migration).toContain(
      'ALTER TABLE "example_articles" ENABLE ROW LEVEL SECURITY',
    );
  });

  it("adds the version column in one backfilling statement", () => {
    // `DEFAULT 1 NOT NULL` is what lets an existing table adopt the editorial
    // workflow without a separate backfill pass.
    expect(migration).toContain(
      'ALTER TABLE "example_articles" ADD COLUMN "version" integer DEFAULT 1 NOT NULL',
    );
  });

  it("creates the shared revision table before anything needs it", () => {
    expect(migration).toContain('CREATE TABLE "core_content_revisions"');
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "core_content_revisions_item_version_unique"',
    );
    expect(migration).toContain(
      'ALTER TABLE "core_content_revisions" ENABLE ROW LEVEL SECURITY',
    );
  });

  it("creates the unique index for `field.text({ unique: true })`", () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "example_articles_code_key" ON "example_articles" USING btree ("code")',
    );
  });

  it("creates exactly one index per resolved definition entry", () => {
    const created = [
      ...migration.matchAll(/CREATE (?:UNIQUE )?INDEX "([^"]+)"/g),
    ]
      .map(match => match[1])
      .filter(name => name.startsWith("example_"));

    expect([...created].sort(byName)).toEqual(
      [
        ...indexNames(articles),
        ...indexNames(categories),
        ...indexNames(localizedArticles),
        ...indexNames(localizedTranslations),
      ].sort(byName),
    );
  });

  it("names the composite index in snake_case", () => {
    expect(migration).toContain('"example_articles_status_created_at_idx"');
  });

  describe("the slug column", () => {
    it("arrives nullable, so an existing table can be backfilled", () => {
      // `ADD COLUMN ... NOT NULL` with no default fails outright on a populated
      // table. The generated one-liner has to be split by hand.
      expect(migration).toContain(
        'ALTER TABLE "example_articles" ADD COLUMN "slug" varchar(160);',
      );
      expect(migration).not.toContain(
        'ADD COLUMN "slug" varchar(160) NOT NULL',
      );
    });

    it("backfills from the title before tightening the column", () => {
      const backfill = migration.indexOf('SET "slug" = NULLIF');
      const notNull = migration.indexOf('ALTER COLUMN "slug" SET NOT NULL');
      const unique = migration.indexOf('"example_articles_slug_key"');

      expect(backfill).toBeGreaterThan(-1);
      expect(notNull).toBeGreaterThan(backfill);
      expect(unique).toBeGreaterThan(backfill);
    });

    it("disambiguates with the row id rather than a placeholder", () => {
      // No "untitled-1" and nothing random, so the same table migrates to the
      // same slugs on every machine that runs it.
      expect(migration).toContain(`a."id"`);
      expect(migration).not.toMatch(/random\(|gen_random_uuid\(/);
    });

    it("suffixes every row rather than only the ambiguous ones", () => {
      // A conditional rescue can produce a value that collides with a natural
      // slug it left alone, and that only fails at `CREATE UNIQUE INDEX`. The
      // behaviour is asserted for real in `postgres.test.ts`; this catches the
      // predicate coming back.
      expect(migration).not.toMatch(/WHERE\s+a\."slug"\s+IS\s+NULL/);
    });

    it("truncates the base before appending the id", () => {
      // A title can already fill `varchar(160)`, so appending `-<id>` to the
      // whole thing would overflow the column.
      expect(migration).toContain(
        `left(coalesce(a."slug", ''), 160 - 1 - length(a."id"::text))`,
      );
    });
  });

  it("narrows the status column and normalises the values it dropped", () => {
    expect(migration).toContain(
      `ALTER TABLE "example_articles" ALTER COLUMN "status" SET DATA TYPE varchar(32)`,
    );
    // `archived` is not a generated status; those rows have to go somewhere.
    expect(migration).toContain(
      `UPDATE "example_articles" SET "status" = 'draft' WHERE "status" NOT IN ('draft', 'published')`,
    );
  });

  it("wires the foreign keys with the declared onDelete behaviour", () => {
    expect(migration).toContain(
      'REFERENCES "public"."core_users"("id") ON DELETE set null',
    );
    expect(migration).toContain(
      'REFERENCES "public"."example_categories"("id") ON DELETE restrict',
    );
  });
});

describe("example_localized_articles", () => {
  it("keeps every localized field off the base table", () => {
    const columns = localizedArticles.columns.map(column => column.name);

    // `title`, `slug` and `body` are declared on the content type and are
    // deliberately absent here: they live one table over, one row per language.
    expect(columns).toEqual(["id", "createdAt", "updatedAt", "featured"]);
  });

  it("keeps shared fields off the translation table", () => {
    const columns = localizedTranslations.columns.map(column => column.name);

    expect(columns).not.toContain("featured");
    expect(columns).toEqual([
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

  it("gives the translation table its own name", () => {
    expect(getTableName(localizedTranslationTable)).toBe(
      "example_localized_articles_translations",
    );
  });

  it("enables row level security on both tables", () => {
    expect(localizedArticles.enableRLS).toBe(true);
    expect(localizedTranslations.enableRLS).toBe(true);
  });

  it("materialises the real column types, not JSON", () => {
    const types = Object.fromEntries(
      localizedTranslations.columns.map(column => [
        column.name,
        column.getSQLType(),
      ]),
    );

    expect(types).toMatchObject({
      body: "text", // textarea
      itemId: "integer",
      languageId: "integer",
      slug: "varchar(160)",
      title: "varchar(200)",
      version: "integer",
    });
  });

  it("versions each translation independently, starting at 1", () => {
    const version = localizedTranslations.columns.find(
      column => column.name === "version",
    );

    expect(version?.notNull).toBe(true);
    expect(version?.default).toBe(1);
  });

  it("keys a translation by its record and its language", () => {
    const [primaryKey] = localizedTranslations.primaryKeys;

    expect(primaryKey.columns.map(column => column.name)).toEqual([
      "itemId",
      "languageId",
    ]);
    expect(primaryKey.getName()).toBe(
      "example_localized_articles_translations_item_id_language_id_pk",
    );
    expect(primaryKey.getName().length).toBeLessThanOrEqual(63);
  });

  it("cascades from the record and restricts the language", () => {
    const references = localizedTranslations.foreignKeys.map(foreignKey => {
      const reference = foreignKey.reference();

      return {
        column: reference.columns[0].name,
        onDelete: foreignKey.onDelete,
        target: getTableName(reference.foreignTable),
      };
    });

    expect(references).toEqual(
      expect.arrayContaining([
        // Translations are part of the record, so they go with it.
        {
          column: "itemId",
          onDelete: "cascade",
          target: "example_localized_articles",
        },
        // Deleting a language must not silently delete the content written in
        // it - the language screen refuses instead.
        {
          column: "languageId",
          onDelete: "restrict",
          target: "core_languages",
        },
      ]),
    );
  });

  it("scopes the localized slug's uniqueness to one language", () => {
    const unique = localizedTranslations.indexes.find(
      item => item.config.unique,
    );

    expect(unique?.config.name).toBe(
      "example_localized_articles_translations_language_id_slug_key",
    );
    expect(
      unique?.config.columns.map(column => "name" in column && column.name),
    ).toEqual(["languageId", "slug"]);
  });

  it("indexes languageId on its own", () => {
    // The composite primary key already serves `(itemId, languageId)` and
    // `itemId`; "every row in Polish" needs its own index.
    expect(indexNames(localizedTranslations)).toContain(
      "example_localized_articles_translations_language_id_idx",
    );
  });

  it("keeps every generated identifier inside the Postgres limit", () => {
    for (const name of indexNames(localizedTranslations)) {
      expect((name ?? "").length).toBeLessThanOrEqual(63);
    }
  });

  it("creates both tables in the committed migration", () => {
    expect(migration).toContain('CREATE TABLE "example_localized_articles"');
    expect(migration).toContain(
      'CREATE TABLE "example_localized_articles_translations"',
    );
    expect(migration).toContain('PRIMARY KEY("itemId","languageId")');
    expect(migration).toContain(
      'REFERENCES "public"."core_languages"("id") ON DELETE restrict',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "example_localized_articles_translations_language_id_slug_key"',
    );
  });

  it("never adds a localized column to the base table in the migration", () => {
    expect(migration).not.toMatch(
      /ALTER TABLE "example_localized_articles" ADD COLUMN "title"/,
    );
  });
});
