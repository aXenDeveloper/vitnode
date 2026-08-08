import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { ContentTestHarness } from "./harness";

import {
  createContentTestHarness,
  DATABASE_TEST_URL,
  pgErrorCode,
} from "./harness";

/**
 * The documented migration patterns, run against real data.
 *
 * Stage 1-6 prove the schema a *fresh* install gets. What they never proved is
 * the thing an existing install actually does: take a table with rows in it and
 * move it onto the newer shape. Every pattern below is copied from
 * `apps/docs/content/docs/dev/content-engine/` - so this suite is what stops the
 * docs describing a migration that quietly loses rows.
 *
 * The rule the patterns share, and the one every test here checks: **the
 * destructive statement is in a different migration from the copy.** A backfill
 * that silently dropped three rows and then deleted its source is not something
 * anybody can notice afterwards.
 *
 * The tables are built here rather than taken from the committed migrations,
 * because what is under test is the *shape* of the upgrade rather than one
 * install's history - and a Stage 1-era table no longer exists anywhere to
 * borrow.
 */

let h: ContentTestHarness;

/** Runs a script as one statement per `--> statement-breakpoint`. */
const migrate = async (script: string): Promise<void> => {
  for (const statement of script.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (trimmed) await h.sql.unsafe(trimmed);
  }
};

const countOf = async (table: string): Promise<number> => {
  const [row] = await h.sql.unsafe(
    `SELECT count(*)::int AS count FROM "${table}"`,
  );

  return Number(row.count);
};

const columnsOf = async (table: string) =>
  await h.sql<{ column_name: string; is_nullable: string }[]>`
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_name = ${table}
    ORDER BY column_name
  `;

/** A Stage 1-era flat table: no publication, no editorial, no translations. */
const STAGE_ONE = `
  CREATE TABLE "legacy_articles" (
    "id" serial PRIMARY KEY NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL,
    "title" varchar(200) NOT NULL,
    "slug" varchar(160) NOT NULL,
    "seoTitle" varchar(200),
    "category" integer NOT NULL,
    "faqJson" jsonb,
    CONSTRAINT "legacy_articles_slug_key" UNIQUE("slug")
  );
`;

const seedLegacy = async (): Promise<void> => {
  const [category] = await h.sql<{ id: number }[]>`
    INSERT INTO "example_categories" ("name") VALUES ('Legacy') RETURNING "id"
  `;
  await h.sql`
    INSERT INTO "legacy_articles" ("title", "slug", "seoTitle", "category", "faqJson")
    VALUES
      ('First', 'first', 'First SEO', ${category.id},
        '[{"question":"Q1","answer":"A1"},{"question":"Q2","answer":"A2"}]'::jsonb),
      ('Second', 'second', NULL, ${category.id},
        '[{"question":"Q3","answer":"A3"}]'::jsonb),
      ('Third', 'third', NULL, ${category.id}, NULL)
  `;
};

describe.skipIf(!DATABASE_TEST_URL)("Content Engine migration patterns", () => {
  beforeAll(async () => {
    h = await createContentTestHarness();
  }, 60_000);

  afterAll(async () => {
    await h?.end();
  });

  beforeEach(async () => {
    await h.sql`DROP TABLE IF EXISTS "legacy_articles_translations"`;
    await h.sql`DROP TABLE IF EXISTS "legacy_articles_categories"`;
    await h.sql`DROP TABLE IF EXISTS "legacy_articles_faq"`;
    await h.sql`DROP TABLE IF EXISTS "legacy_articles"`;
    await h.sql`DELETE FROM "example_categories"`;
    await h.sql.unsafe(STAGE_ONE);
    await seedLegacy();
  });

  // -------------------------------------------------------------------------
  // Additive upgrades
  // -------------------------------------------------------------------------

  describe("adding a structured group to a populated table", () => {
    it("gives every existing row a null group without touching its other values", async () => {
      const before = await countOf("legacy_articles");

      await migrate(`
        ALTER TABLE "legacy_articles"
          ADD COLUMN "syndicationIndexable" boolean DEFAULT true NOT NULL,
          ADD COLUMN "syndicationPriority" integer DEFAULT 5 NOT NULL;
      `);

      expect(await countOf("legacy_articles")).toBe(before);

      const rows = await h.sql<
        { syndicationIndexable: boolean; syndicationPriority: number }[]
      >`
        SELECT "syndicationIndexable", "syndicationPriority" FROM "legacy_articles"
      `;
      // A defaulted leaf is what makes this additive at all: a `NOT NULL`
      // column with no default cannot be added to a table with rows in it.
      expect(rows.every(row => row.syndicationPriority === 5)).toBe(true);
      expect(rows.every(row => row.syndicationIndexable)).toBe(true);
    });

    it("regroups an existing column with no data migration at all", async () => {
      // `seoTitle` as a top-level field and `seo.title` as a group leaf compile
      // to the same column, so the upgrade is a definition change and nothing
      // else. The test is that the column and its values are still there.
      const before = await h.sql<{ id: number; seoTitle: null | string }[]>`
        SELECT "id", "seoTitle" FROM "legacy_articles" ORDER BY "id"
      `;

      await migrate(`
        ALTER TABLE "legacy_articles" ADD COLUMN "seoDescription" text;
      `);

      const after = await h.sql<{ id: number; seoTitle: null | string }[]>`
        SELECT "id", "seoTitle" FROM "legacy_articles" ORDER BY "id"
      `;
      expect(after).toEqual(before);
    });

    it("refuses a non-null leaf with no default, rather than inventing values", async () => {
      const code = await pgErrorCode(
        async () =>
          await h.sql.unsafe(`
            ALTER TABLE "legacy_articles"
              ADD COLUMN "syndicationOwner" varchar(100) NOT NULL
          `),
      );

      // 23502: not_null_violation. `defineContentType` refuses this shape at
      // definition time, and Postgres refuses it here - which is what makes the
      // rule a fact rather than a convention.
      expect(code).toBe("23502");
    });
  });

  // -------------------------------------------------------------------------
  // To-one to to-many
  // -------------------------------------------------------------------------

  describe("moving a to-one relation onto a junction table", () => {
    const CREATE_JUNCTION = `
      CREATE TABLE "legacy_articles_categories" (
        "itemId" integer NOT NULL,
        "relatedItemId" integer NOT NULL,
        "position" integer NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "legacy_articles_categories_pk"
          PRIMARY KEY("itemId","relatedItemId")
      );--> statement-breakpoint
      CREATE UNIQUE INDEX "legacy_articles_categories_position_key"
        ON "legacy_articles_categories" ("itemId","position");--> statement-breakpoint
      INSERT INTO "legacy_articles_categories" ("itemId", "relatedItemId", "position")
      SELECT "id", "category", 0 FROM "legacy_articles" WHERE "category" IS NOT NULL;
    `;

    it("copies every reference, at position zero, before anything is dropped", async () => {
      const before = await countOf("legacy_articles");

      await migrate(CREATE_JUNCTION);

      expect(await countOf("legacy_articles_categories")).toBe(before);
      const rows = await h.sql<{ position: number }[]>`
        SELECT "position" FROM "legacy_articles_categories"
      `;
      expect(rows.every(row => row.position === 0)).toBe(true);

      // The source column is still there. That is the pattern: the destructive
      // statement is a *second* migration, run after somebody has looked at the
      // counts.
      expect(
        (await columnsOf("legacy_articles")).map(row => row.column_name),
      ).toContain("category");
    });

    it("keeps the foreign key honest once it is added", async () => {
      await migrate(`
        ${CREATE_JUNCTION}--> statement-breakpoint
        ALTER TABLE "legacy_articles_categories"
          ADD CONSTRAINT "legacy_articles_categories_related_fk"
          FOREIGN KEY ("relatedItemId") REFERENCES "example_categories"("id")
          ON DELETE restrict;
      `);

      const code = await pgErrorCode(
        async () =>
          await h.sql`
            INSERT INTO "legacy_articles_categories" ("itemId", "relatedItemId", "position")
            VALUES (1, 999999, 1)
          `,
      );

      expect(code).toBe("23503");
    });

    it("drops the source column only in the second migration", async () => {
      await migrate(CREATE_JUNCTION);
      const copied = await countOf("legacy_articles_categories");
      const source = await countOf("legacy_articles");

      // The pause in the middle, made explicit: the drop is guarded by the very
      // comparison the docs tell an operator to make by hand.
      expect(copied).toBe(source);

      await migrate(`ALTER TABLE "legacy_articles" DROP COLUMN "category";`);

      expect(
        (await columnsOf("legacy_articles")).map(row => row.column_name),
      ).not.toContain("category");
      expect(await countOf("legacy_articles_categories")).toBe(copied);
    });

    it("aborts the copy whole when one row cannot be copied", async () => {
      // Postgres runs a migration statement in a transaction, so a backfill
      // that fails halfway leaves nothing behind - which is what makes the
      // "verify before you drop" pattern safe to retry.
      await migrate(`
        CREATE TABLE "legacy_articles_categories" (
          "itemId" integer NOT NULL,
          "relatedItemId" integer NOT NULL,
          "position" integer NOT NULL,
          CONSTRAINT "legacy_articles_categories_pk"
            PRIMARY KEY("itemId","relatedItemId"),
          CONSTRAINT "legacy_articles_categories_position_check"
            CHECK ("position" >= 0)
        );
      `);

      const code = await pgErrorCode(
        async () =>
          await h.sql`
            INSERT INTO "legacy_articles_categories" ("itemId", "relatedItemId", "position")
            SELECT "id", "category", "id" - 100 FROM "legacy_articles"
          `,
      );

      expect(code).toBe("23514");
      expect(await countOf("legacy_articles_categories")).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // JSON array to repeatable
  // -------------------------------------------------------------------------

  describe("moving a JSON array onto a repeatable child table", () => {
    const CREATE_CHILD = `
      CREATE TABLE "legacy_articles_faq" (
        "id" serial PRIMARY KEY NOT NULL,
        "itemId" integer NOT NULL,
        "position" integer NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        "question" varchar(200) NOT NULL,
        "answer" text NOT NULL
      );--> statement-breakpoint
      CREATE UNIQUE INDEX "legacy_articles_faq_position_key"
        ON "legacy_articles_faq" ("itemId","position");--> statement-breakpoint
      INSERT INTO "legacy_articles_faq" ("itemId", "position", "question", "answer")
      SELECT
        a."id",
        entry.ordinality - 1,
        entry.value ->> 'question',
        entry.value ->> 'answer'
      FROM "legacy_articles" a,
           jsonb_array_elements(a."faqJson")
             WITH ORDINALITY AS entry(value, ordinality)
      WHERE a."faqJson" IS NOT NULL;
    `;

    it("copies every entry and preserves its order", async () => {
      await migrate(CREATE_CHILD);

      const [{ expected }] = await h.sql<{ expected: number }[]>`
        SELECT coalesce(sum(jsonb_array_length("faqJson")), 0)::int AS expected
        FROM "legacy_articles"
      `;
      expect(await countOf("legacy_articles_faq")).toBe(expected);

      const rows = await h.sql<{ position: number; question: string }[]>`
        SELECT f."position", f."question" FROM "legacy_articles_faq" f
        JOIN "legacy_articles" a ON a."id" = f."itemId"
        WHERE a."slug" = 'first'
        ORDER BY f."position"
      `;
      // `WITH ORDINALITY` is what carries the order across, and the engine reads
      // a repeatable back in `position` order - so getting this wrong reorders
      // somebody's FAQ silently.
      expect(rows).toEqual([
        { position: 0, question: "Q1" },
        { position: 1, question: "Q2" },
      ]);
    });

    it("starts positions at zero, which is where the engine reads from", async () => {
      await migrate(CREATE_CHILD);

      const [row] = await h.sql<{ min: number }[]>`
        SELECT min("position")::int AS min FROM "legacy_articles_faq"
      `;
      expect(row.min).toBe(0);
    });

    it("copies nothing for a record whose array was null", async () => {
      await migrate(CREATE_CHILD);

      const rows = await h.sql<{ count: number }[]>`
        SELECT count(*)::int AS count FROM "legacy_articles_faq" f
        JOIN "legacy_articles" a ON a."id" = f."itemId"
        WHERE a."slug" = 'third'
      `;
      expect(rows[0].count).toBe(0);
    });

    it("leaves the source column in place for the operator to check", async () => {
      await migrate(CREATE_CHILD);

      expect(
        (await columnsOf("legacy_articles")).map(row => row.column_name),
      ).toContain("faqJson");
    });

    it("refuses two entries in one position once the index is there", async () => {
      await migrate(CREATE_CHILD);

      const code = await pgErrorCode(
        async () =>
          await h.sql`
            INSERT INTO "legacy_articles_faq" ("itemId", "position", "question", "answer")
            SELECT "itemId", "position", 'Dup', 'Dup' FROM "legacy_articles_faq" LIMIT 1
          `,
      );

      expect(code).toBe("23505");
    });
  });

  // -------------------------------------------------------------------------
  // Non-localized to localized
  // -------------------------------------------------------------------------

  describe("localizing a table that already has rows", () => {
    const CREATE_TRANSLATIONS = `
      CREATE TABLE "legacy_articles_translations" (
        "itemId" integer NOT NULL,
        "languageId" integer NOT NULL,
        "version" integer DEFAULT 1 NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        "title" varchar(200) NOT NULL,
        "slug" varchar(160) NOT NULL
      );--> statement-breakpoint
      INSERT INTO "legacy_articles_translations"
        ("itemId", "languageId", "title", "slug", "createdAt", "updatedAt")
      SELECT
        a."id",
        (SELECT "id" FROM "core_languages" WHERE "code" = 'en'),
        a."title",
        a."slug",
        a."createdAt",
        a."updatedAt"
      FROM "legacy_articles" a;
    `;

    /** Step 4 of the documented six, verbatim in shape. */
    const VERIFY = `
      DO $$
      DECLARE
        source_count integer;
        copied_count integer;
        language_id integer;
      BEGIN
        SELECT "id" INTO language_id FROM "core_languages" WHERE "code" = 'en';
        IF language_id IS NULL THEN
          RAISE EXCEPTION 'No core_languages row for the default locale "en".';
        END IF;

        SELECT count(*) INTO source_count FROM "legacy_articles";
        SELECT count(*) INTO copied_count FROM "legacy_articles_translations";

        IF source_count <> copied_count THEN
          RAISE EXCEPTION 'Copied % of % rows; refusing to drop the source columns.',
            copied_count, source_count;
        END IF;
      END $$;
    `;

    const CONSTRAIN = `
      ALTER TABLE "legacy_articles_translations"
        ADD CONSTRAINT "legacy_articles_translations_pk"
        PRIMARY KEY ("itemId", "languageId");--> statement-breakpoint
      ALTER TABLE "legacy_articles_translations"
        ADD CONSTRAINT "legacy_articles_translations_item_fk"
        FOREIGN KEY ("itemId") REFERENCES "legacy_articles"("id")
        ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
      ALTER TABLE "legacy_articles_translations"
        ADD CONSTRAINT "legacy_articles_translations_language_fk"
        FOREIGN KEY ("languageId") REFERENCES "core_languages"("id")
        ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
      CREATE UNIQUE INDEX "legacy_articles_translations_language_id_slug_key"
        ON "legacy_articles_translations" ("languageId","slug");
    `;

    it("copies every row into the default language, timestamps included", async () => {
      const before = await h.sql<
        { createdAt: Date; id: number; slug: string; title: string }[]
      >`
        SELECT "id", "title", "slug", "createdAt" FROM "legacy_articles" ORDER BY "id"
      `;

      await migrate(CREATE_TRANSLATIONS);

      const after = await h.sql<
        { createdAt: Date; itemId: number; slug: string; title: string }[]
      >`
        SELECT "itemId", "title", "slug", "createdAt"
        FROM "legacy_articles_translations" ORDER BY "itemId"
      `;

      expect(after).toHaveLength(before.length);
      expect(after.map(row => [row.itemId, row.title, row.slug])).toEqual(
        before.map(row => [row.id, row.title, row.slug]),
      );
      // The original timestamps travel with the values. A translation stamped
      // `now()` would tell every editor the whole collection was rewritten on
      // deployment day.
      expect(after.map(row => row.createdAt)).toEqual(
        before.map(row => row.createdAt),
      );
    });

    it("resolves the language rather than hardcoding an identifier", async () => {
      await migrate(CREATE_TRANSLATIONS);

      const [english] = await h.sql<{ id: number }[]>`
        SELECT "id" FROM "core_languages" WHERE "code" = 'en'
      `;
      const rows = await h.sql<{ languageId: number }[]>`
        SELECT DISTINCT "languageId" FROM "legacy_articles_translations"
      `;

      // A literal `1` is right on the machine it was written on and wrong on
      // every other install.
      expect(rows).toEqual([{ languageId: english.id }]);
    });

    it("passes its own verification step and only then drops the columns", async () => {
      await migrate(CREATE_TRANSLATIONS);
      await migrate(VERIFY);
      await migrate(CONSTRAIN);
      await migrate(`
        ALTER TABLE "legacy_articles" DROP COLUMN "title";--> statement-breakpoint
        ALTER TABLE "legacy_articles" DROP COLUMN "slug";
      `);

      const columns = (await columnsOf("legacy_articles")).map(
        row => row.column_name,
      );
      expect(columns).not.toContain("title");
      expect(columns).not.toContain("slug");
      expect(await countOf("legacy_articles_translations")).toBe(3);
    });

    it("aborts rather than dropping the source when a row did not copy", async () => {
      // The failure the verification exists for, produced deliberately: one
      // source row that the copy missed.
      await migrate(CREATE_TRANSLATIONS);
      await h.sql`
        DELETE FROM "legacy_articles_translations"
        WHERE "itemId" = (SELECT min("itemId") FROM "legacy_articles_translations")
      `;

      await expect(migrate(VERIFY)).rejects.toThrow(
        /refusing to drop the source columns/,
      );

      // And the source is untouched, which is the whole point.
      const columns = (await columnsOf("legacy_articles")).map(
        row => row.column_name,
      );
      expect(columns).toContain("title");
      expect(columns).toContain("slug");
    });

    it("moves uniqueness from global to per language", async () => {
      await migrate(CREATE_TRANSLATIONS);
      await migrate(CONSTRAIN);

      const [polish] = await h.sql<{ id: number }[]>`
        SELECT "id" FROM "core_languages" WHERE "code" = 'pl'
      `;

      // The same slug in another language is now legal - it was not before,
      // when the column carried a global unique index.
      await h.sql`
        INSERT INTO "legacy_articles_translations"
          ("itemId", "languageId", "title", "slug")
        VALUES (
          (SELECT min("id") FROM "legacy_articles"), ${polish.id}, 'Pierwszy', 'first'
        )
      `;

      const code = await pgErrorCode(
        async () =>
          await h.sql`
            INSERT INTO "legacy_articles_translations"
              ("itemId", "languageId", "title", "slug")
            VALUES (
              (SELECT max("id") FROM "legacy_articles"), ${polish.id}, 'Drugi', 'first'
            )
          `,
      );
      expect(code).toBe("23505");
    });

    it("surfaces a pre-existing duplicate as a named failure with the data intact", async () => {
      // Step 5 is where a collision shows up, deliberately after the copy: the
      // rows are still there to look at, rather than half-migrated.
      await migrate(CREATE_TRANSLATIONS);
      await h.sql`
        UPDATE "legacy_articles_translations" SET "slug" = 'first'
        WHERE "itemId" = (SELECT max("itemId") FROM "legacy_articles_translations")
      `;

      const code = await pgErrorCode(async () => await migrate(CONSTRAIN));

      expect(code).toBe("23505");
      expect(await countOf("legacy_articles_translations")).toBe(3);
    });

    it("takes the translations with the record it belongs to", async () => {
      await migrate(CREATE_TRANSLATIONS);
      await migrate(CONSTRAIN);

      await h.sql`
        DELETE FROM "legacy_articles"
        WHERE "id" = (SELECT min("id") FROM "legacy_articles")
      `;

      expect(await countOf("legacy_articles_translations")).toBe(2);
    });

    it("refuses to remove a language that content is written in", async () => {
      await migrate(CREATE_TRANSLATIONS);
      await migrate(CONSTRAIN);

      const code = await pgErrorCode(
        async () =>
          await h.sql`DELETE FROM "core_languages" WHERE "code" = 'en'`,
      );

      // `ON DELETE restrict`, which Postgres 18 reports as `23001` and earlier
      // majors as `23503`. The version decides which is correct rather than the
      // assertion accepting either.
      expect(code).toBe(h.serverMajor >= 18 ? "23001" : "23503");
    });
  });

  // -------------------------------------------------------------------------
  // Transactional behaviour
  // -------------------------------------------------------------------------

  describe("a failed migration leaves nothing half-applied", () => {
    it("rolls a multi-statement data migration back whole", async () => {
      // The migrator wraps a file in a transaction, so this is what an operator
      // gets when statement three of four fails: the schema and the data exactly
      // as they were.
      await expect(
        h.sql.begin(async transaction => {
          await transaction.unsafe(`
            CREATE TABLE "legacy_articles_faq" (
              "id" serial PRIMARY KEY NOT NULL,
              "itemId" integer NOT NULL,
              "position" integer NOT NULL,
              "question" varchar(200) NOT NULL,
              "answer" text NOT NULL
            )
          `);
          await transaction.unsafe(`
            INSERT INTO "legacy_articles_faq" ("itemId", "position", "question", "answer")
            SELECT "id", 0, 'Q', 'A' FROM "legacy_articles"
          `);
          await transaction.unsafe(
            `ALTER TABLE "legacy_articles_faq" ADD COLUMN "answer" text`,
          );
        }),
      ).rejects.toThrow();

      // DDL is transactional in Postgres, so even the `CREATE TABLE` is gone.
      const tables = await h.sql<{ table_name: string }[]>`
        SELECT table_name FROM information_schema.tables
        WHERE table_name = 'legacy_articles_faq'
      `;
      expect(tables).toEqual([]);
    });

    it("keeps a verification failure and its copy in one transaction", async () => {
      await expect(
        h.sql.begin(async transaction => {
          await transaction.unsafe(`
            CREATE TABLE "legacy_articles_translations" (
              "itemId" integer NOT NULL,
              "languageId" integer NOT NULL,
              "title" varchar(200) NOT NULL,
              "slug" varchar(160) NOT NULL
            )
          `);
          await transaction.unsafe(`
            INSERT INTO "legacy_articles_translations"
              ("itemId", "languageId", "title", "slug")
            SELECT a."id",
              (SELECT "id" FROM "core_languages" WHERE "code" = 'en'),
              a."title", a."slug"
            FROM "legacy_articles" a LIMIT 1
          `);
          await transaction.unsafe(`
            DO $$
            DECLARE source_count integer; copied_count integer;
            BEGIN
              SELECT count(*) INTO source_count FROM "legacy_articles";
              SELECT count(*) INTO copied_count FROM "legacy_articles_translations";
              IF source_count <> copied_count THEN
                RAISE EXCEPTION 'Copied % of % rows.', copied_count, source_count;
              END IF;
            END $$;
          `);
        }),
      ).rejects.toThrow(/Copied 1 of 3 rows/);

      const tables = await h.sql<{ table_name: string }[]>`
        SELECT table_name FROM information_schema.tables
        WHERE table_name = 'legacy_articles_translations'
      `;
      expect(tables).toEqual([]);
    });

    it("cannot roll back a CREATE INDEX CONCURRENTLY, which is why none is generated", async () => {
      // The documented exception: `CONCURRENTLY` cannot run inside a
      // transaction at all, so a migration using it is not atomic. Nothing the
      // engine generates does, and this pins that.
      await expect(
        h.sql.begin(async transaction => {
          await transaction.unsafe(
            `CREATE INDEX CONCURRENTLY "legacy_articles_title_idx" ON "legacy_articles" ("title")`,
          );
        }),
      ).rejects.toThrow();
    });
  });
});
