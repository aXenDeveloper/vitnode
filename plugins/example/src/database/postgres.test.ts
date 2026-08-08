import type { ContentSearchOperation } from "@vitnode/core/content/server";
import type { Context } from "hono";

import { executeContentSchedule } from "@vitnode/core/api/modules/content/helpers/execute-content-schedule";
import {
  ContentDefaultTranslationRequired,
  ContentTranslationExists,
  ContentTranslationItemMissing,
  ContentTranslationVersionConflict,
  ContentVersionConflict,
} from "@vitnode/core/content";
import {
  claimContentSchedule,
  contentPublicLocaleStates,
  createContentLocalizedSearchIndexer,
  createContentSearchIndexer,
  settleContentSchedule,
  syncContentLocalizedSearch,
  syncContentSearch,
} from "@vitnode/core/content/server";
import { core_queue } from "@vitnode/core/database/queue";
import { drizzle } from "drizzle-orm/postgres-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CONFIG_PLUGIN, EXAMPLE_MIGRATIONS } from "@/const";
import { articleContentType } from "@/content/article";

import { articleContent } from "./articles";
import { categoryContent } from "./categories";
import { localizedArticleContent } from "./localized-articles";

/**
 * A real Postgres smoke test for the Content Engine.
 *
 * It only runs when `DATABASE_TEST_URL` is set, and it *wipes* the database it
 * points at - so the URL has to name a database with "test" in it. CI provides
 * a throwaway Postgres service; locally you opt in the same way:
 *
 * ```bash
 * DATABASE_TEST_URL=postgres://postgres:postgres@localhost:5432/vitnode_test \
 *   pnpm --filter @vitnode/example test
 * ```
 */
const url = process.env.DATABASE_TEST_URL;

const databaseName = (() => {
  if (!url) return "";
  try {
    return new URL(url).pathname.replace(/^\//, "");
  } catch {
    return "";
  }
})();

const here = dirname(fileURLToPath(import.meta.url));

/** The committed migrations - the exact DDL a fresh database would run. */
const migrationSql = (files: readonly string[]): string =>
  files
    .map(file =>
      readFileSync(
        resolve(here, "../../../../apps/docs/migrations", file),
        "utf8",
      ),
    )
    .join("\n--> statement-breakpoint\n");

const SLUG_MIGRATION = "0024_add_example_article_slug.sql";
const slugMigrationAt = EXAMPLE_MIGRATIONS.indexOf(SLUG_MIGRATION);

/**
 * The longest title the column allows, so `left(title, 160)` fills the slug
 * exactly. Two rows sharing it are the overflow case: the base is already 160
 * characters before anything is appended to it.
 */
const LONG_TITLE = "Lorem ipsum dolor sit amet ".repeat(7).slice(0, 200);

/**
 * Rows the slug backfill has to cope with, inserted *between* `0023` and the
 * slug migration so the committed SQL runs against real data rather than an
 * empty table.
 *
 * The ids are **explicit**, because two of these scenarios are about a
 * generated value colliding with a natural one and that only happens at
 * particular ids. Letting the sequence pick them would make the regression
 * appear and disappear with the insertion order.
 */
const BACKFILL_ROWS = [
  // A natural slug that a *rescue* value can be built to match. Suffixing only
  // the ambiguous rows turns the pair below into "foo-2" and "foo-3" - and
  // "foo-2" is already sitting here, on row 1.
  { code: "mig-foo-2", id: 1, title: "Foo 2" },
  { code: "mig-foo-a", id: 2, title: "Foo" },
  { code: "mig-foo-b", id: 3, title: "Foo" },

  // The same trap, one step shorter: a title that normalises to nothing falls
  // back to its bare id, and row 6's title genuinely normalises to that number.
  { code: "mig-empty", id: 5, title: "日本語のタイトル" },
  { code: "mig-numeric", id: 6, title: "5" },

  // Two identical titles that already fill the column.
  { code: "mig-long-a", id: 7, title: LONG_TITLE },
  { code: "mig-long-b", id: 8, title: LONG_TITLE },

  // Unambiguous, and suffixed all the same - that is the trade the fix makes.
  { code: "mig-unique", id: 9, title: "Only One Of These" },
];

interface BackfilledRow {
  code: string;
  id: number;
  slug: string;
}

/** What the backfill produced, captured before the fixture rows are removed. */
let backfilled: BackfilledRow[] = [];

const backfilledBy = (code: string): BackfilledRow => {
  const row = backfilled.find(item => item.code === code);
  if (!row) throw new Error(`No migrated row for "${code}".`);

  return row;
};

/**
 * Stands in for `core_users`, which the `author` field references.
 *
 * Core's own migrations are not replayed here: one of them builds a full-text
 * column from per-language text-search configurations that a stock Postgres
 * image does not ship, and none of that has anything to do with the Content
 * Engine. Only the columns the foreign key and the label join actually touch
 * are needed.
 */
const CORE_USERS_STUB = `
  CREATE TABLE "core_users" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar(255) NOT NULL
  );
`;

/**
 * Enough of `core_queue` for a scheduled publication to enqueue itself.
 *
 * Stubbed rather than migrated, like `core_users`: the suite replays the
 * example plugin's own migrations plus the core tables the Content Engine
 * writes to, and pulling in core's whole migration history to reach one table
 * would make every unrelated core change a reason for this file to break.
 */
const CORE_QUEUE_STUB = `
  CREATE TABLE "core_queue" (
    "id" serial PRIMARY KEY NOT NULL,
    "pluginId" varchar(255) NOT NULL,
    "name" varchar(100) NOT NULL,
    "queue" varchar(100) DEFAULT 'default' NOT NULL,
    "status" varchar(20) DEFAULT 'pending' NOT NULL,
    "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "maxAttempts" integer DEFAULT 3 NOT NULL,
    "availableAt" timestamp DEFAULT now() NOT NULL,
    "reservedAt" timestamp,
    "lastError" text,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL,
    "completedAt" timestamp
  );
`;

/**
 * Enough of `core_languages` for the localized translation table's foreign key.
 *
 * Stubbed for the same reason `core_users` is - core's own migrations are not
 * replayed here - and it is the *whole* reason the localized suite has to insert
 * its own languages: nothing in VitNode seeds them. They are created by the
 * installer, so a test that assumed `en` existed would pass on a developer
 * machine and fail on a fresh CI database.
 */
/**
 * Who the editorial suites act as.
 *
 * `userId: null` on purpose: `actorUserId` is a real foreign key to `core_users`,
 * and these tests are about the revisions rather than about who wrote them - a
 * seeded user would be a second fixture to keep in step for no assertion.
 */
const ACTOR = { type: "staff" as const, userId: null };

const CORE_LANGUAGES_STUB = `
  CREATE TABLE "core_languages" (
    "id" serial PRIMARY KEY NOT NULL,
    "code" varchar(32) NOT NULL,
    "name" varchar(255) NOT NULL,
    "default" boolean DEFAULT false NOT NULL,
    "protected" boolean DEFAULT false NOT NULL,
    CONSTRAINT "core_languages_code_unique" UNIQUE("code")
  );
`;

let sql: ReturnType<typeof postgres>;
let context: Context;
let db: ReturnType<typeof drizzle>;
let serverMajor = 0;

/**
 * A second connection, for the tests that need two things happening at once.
 *
 * The main client is `max: 1`, which serialises everything through one backend
 * - fine for optimistic locking, useless for row locks, because a statement
 * waiting on `FOR UPDATE` would be waiting on itself.
 */
let rival: ReturnType<typeof postgres>;
let rivalDb: ReturnType<typeof drizzle>;
let rivalContext: Context;

const pgErrorCode = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause;

    return cause?.code ?? (error as { code?: string }).code;
  }

  return undefined;
};

describe.skipIf(!url)("Content Engine against Postgres", () => {
  beforeAll(async () => {
    // The suite drops and recreates the whole schema, so refuse anything that
    // does not obviously name a scratch database.
    if (!/test/i.test(databaseName)) {
      throw new Error(
        `DATABASE_TEST_URL points at "${databaseName || url}". This suite wipes the database it runs against, so its name must contain "test".`,
      );
    }

    sql = postgres(url ?? "", { max: 1, onnotice: () => undefined });

    const [{ version }] = await sql<{ version: number }[]>`
      SELECT current_setting('server_version_num')::int AS version
    `;
    serverMajor = Math.floor(version / 10_000);

    await sql.unsafe(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
    `);
    await sql.unsafe(CORE_USERS_STUB);
    await sql.unsafe(CORE_QUEUE_STUB);
    await sql.unsafe(CORE_LANGUAGES_STUB);
    // Inserted before the migrations run, so the localized translation table's
    // `ON DELETE restrict` foreign key has something real to point at.
    await sql`
      INSERT INTO "core_languages" ("code", "name", "default") VALUES
        ('en', 'English', true),
        ('pl', 'Polski', false),
        ('de', 'Deutsch', false)
    `;

    const run = async (files: readonly string[]) => {
      for (const statement of migrationSql(files).split(
        "--> statement-breakpoint",
      )) {
        const trimmed = statement.trim();
        if (trimmed) await sql.unsafe(trimmed);
      }
    };

    // Everything up to the slug migration, then rows, then the slug migration.
    // A backfill only means anything against a populated table, and this is the
    // one statement in the set that can fail on data rather than on schema.
    await run(EXAMPLE_MIGRATIONS.slice(0, slugMigrationAt));

    const [seedCategory] = await sql<{ id: number }[]>`
      INSERT INTO "example_categories" ("name") VALUES ('Backfill') RETURNING "id"
    `;
    for (const row of BACKFILL_ROWS) {
      await sql`
        INSERT INTO "example_articles" ("id", "category", "code", "title")
        VALUES (${row.id}, ${seedCategory.id}, ${row.code}, ${row.title})
      `;
    }

    await run(EXAMPLE_MIGRATIONS.slice(slugMigrationAt));

    backfilled = await sql<BackfilledRow[]>`
      SELECT "id", "code", "slug" FROM "example_articles" ORDER BY "id"
    `;

    // Out of the way, so every other test starts against an empty table.
    await sql`DELETE FROM "example_articles"`;
    await sql`DELETE FROM "example_categories"`;
    // Explicit ids bypass the sequence, so move it past them - otherwise the
    // first row the service creates would try to reuse id 1.
    await sql`
      SELECT setval(
        pg_get_serial_sequence('example_articles', 'id'),
        ${Math.max(...BACKFILL_ROWS.map(row => row.id))}
      )
    `;

    db = drizzle(sql, { casing: "camelCase" });
    rival = postgres(url ?? "", { max: 1, onnotice: () => undefined });
    rivalDb = drizzle(rival, { casing: "camelCase" });

    /**
     * Everything the Content Engine reads off the request context.
     *
     * The queue is a stand-in for `QueueModel.dispatch`, writing the same row
     * it would. Faithful in the two ways these tests are about: it honours the
     * `tx` it is handed, so the queue row commits with the schedule, and it
     * stamps the `pluginId` the caller asked for. `QueueModel`'s own handling
     * of both is unit-tested in core.
     */
    const buildContext = (handle: typeof db) =>
      ({
        get: (key: string) => {
          if (key === "db") return handle;
          // How background work gets from a content type id to a table and a
          // service, with no plugin context of its own.
          if (key === "core") {
            return {
              contentModels: [
                { model: articleContent, pluginId: CONFIG_PLUGIN.pluginId },
                {
                  model: localizedArticleContent,
                  pluginId: CONFIG_PLUGIN.pluginId,
                },
              ],
              // Which locales this app *serves*. `core_languages` is the registry
              // of the ones that exist; a locale listed here with
              // `enabled: false` is a deliberate switch-off, and the resolver
              // refuses to write into it.
              i18n: {
                locales: [
                  { code: "en", name: "English" },
                  { code: "pl", name: "Polski" },
                  { code: "de", enabled: false, name: "Deutsch" },
                ],
              },
            };
          }
          if (key === "queue") {
            return {
              dispatch: async ({
                availableAt,
                name,
                payload,
                pluginId,
                tx,
              }: {
                availableAt?: Date;
                name: string;
                payload?: Record<string, unknown>;
                pluginId?: string;
                tx?: typeof db;
              }) => {
                const [queued] = await (tx ?? handle)
                  .insert(core_queue)
                  .values({
                    availableAt: availableAt ?? new Date(),
                    name,
                    payload: payload ?? {},
                    pluginId: pluginId ?? "@vitnode/core",
                  })
                  .returning({ id: core_queue.id });

                return queued;
              },
            };
          }

          return undefined;
        },
      }) as unknown as Context;

    context = buildContext(db);
    rivalContext = buildContext(rivalDb);
  }, 60_000);

  afterAll(async () => {
    await sql?.end();
    await rival?.end();
  });

  describe("the slug backfill", () => {
    it("gave every existing row a slug", () => {
      expect(backfilled).toHaveLength(BACKFILL_ROWS.length);
      expect(backfilled.every(row => typeof row.slug === "string")).toBe(true);
      expect(backfilled.every(row => row.slug.length > 0)).toBe(true);
    });

    it("kept every slug inside varchar(160)", () => {
      // The column would have rejected anything longer, so this is really a
      // statement about the two rows whose base slug already filled it before
      // the id was appended.
      expect(backfilled.every(row => row.slug.length <= 160)).toBe(true);
    });

    it("made every slug unique", () => {
      const slugs = backfilled.map(row => row.slug);

      expect(new Set(slugs).size).toBe(slugs.length);
    });

    it("left no leading or trailing dash", () => {
      expect(backfilled.every(row => !/^-|-$/.test(row.slug))).toBe(true);
    });

    it("ends every slug with the row id", () => {
      // The whole uniqueness argument: a value is `<base>-<id>`, or `<id>` when
      // the title left nothing behind. Two of them can only match if their ids
      // do, and ids are the primary key.
      expect(
        backfilled.every(
          row => row.slug === String(row.id) || row.slug.endsWith(`-${row.id}`),
        ),
      ).toBe(true);
    });

    it("separates two rows with the same ordinary title", () => {
      expect(backfilledBy("mig-foo-a").slug).toBe("foo-2");
      expect(backfilledBy("mig-foo-b").slug).toBe("foo-3");
    });

    it("does not let a generated slug land on a natural one", () => {
      // The regression. "Foo 2" normalises to "foo-2" all by itself, and row 2
      // is one of a duplicate pair - so suffixing only the ambiguous rows would
      // rescue it *to* "foo-2" and collide with row 1. Suffixing everything
      // moves row 1 out of the way instead.
      expect(backfilledBy("mig-foo-2").slug).toBe("foo-2-1");
      expect(backfilledBy("mig-foo-a").slug).toBe("foo-2");
      expect(backfilledBy("mig-foo-2").slug).not.toBe(
        backfilledBy("mig-foo-a").slug,
      );
    });

    it("does not let an id fallback land on a numeric natural slug", () => {
      // Row 5's title normalises to nothing and falls back to "5". Row 6's
      // title *is* "5". Leaving unambiguous rows alone would hand both the same
      // value; the suffix keeps them apart.
      expect(backfilledBy("mig-empty").slug).toBe("5");
      expect(backfilledBy("mig-numeric").slug).toBe("5-6");
    });

    it("separates two rows whose title fills the whole column", () => {
      const first = backfilledBy("mig-long-a");
      const second = backfilledBy("mig-long-b");

      // Truncated to make room for the suffix rather than truncated after it:
      // the id survives, and the whole thing still fits the column. Most of the
      // title survives too - this is a trim, not a fallback.
      for (const row of [first, second]) {
        expect(row.slug.length).toBeLessThanOrEqual(160);
        expect(row.slug.length).toBeGreaterThan(150);
        expect(row.slug.endsWith(`-${row.id}`)).toBe(true);
      }

      expect(first.slug).not.toBe(second.slug);
    });

    it("falls back to the row id for a title that normalises to nothing", () => {
      // No transliteration in SQL, so a title in a non-Latin script leaves
      // nothing behind. The id is deterministic, non-empty, and the row keeps
      // its title.
      const row = backfilledBy("mig-empty");

      expect(row.slug).toBe(String(row.id));
      expect(row.slug.length).toBeGreaterThan(0);
    });

    it("suffixes an unambiguous title too", () => {
      // The cost of the fix, stated plainly: a row that needed no help still
      // gets an id. Anything cleverer has to reason about what the *other*
      // rows resolved to, which is where the collision came from.
      expect(backfilledBy("mig-unique").slug).toBe("only-one-of-these-9");
    });
  });

  it("applies the unique index the descriptor asked for", async () => {
    const indexes = await sql`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'example_articles'
        AND indexname = 'example_articles_code_key'
    `;

    expect(indexes).toHaveLength(1);
    expect(indexes[0].indexdef).toContain("CREATE UNIQUE INDEX");
  });

  it("enables row level security on both generated tables", async () => {
    const rows = await sql`
      SELECT relname, relrowsecurity FROM pg_class
      WHERE relname IN ('example_articles', 'example_categories')
      ORDER BY relname
    `;

    expect(rows).toEqual([
      { relname: "example_articles", relrowsecurity: true },
      { relname: "example_categories", relrowsecurity: true },
    ]);
  });

  it("runs the whole CRUD lifecycle", async () => {
    const categories = categoryContent.service(context);
    const articles = articleContent.service(context);

    const [user] = await sql<{ id: number }[]>`
      INSERT INTO "core_users" ("name") VALUES ('Ada') RETURNING "id"
    `;

    const category = await categories.create({ name: "Guides" });
    expect(category.id).toBeGreaterThan(0);

    const article = await articles.create({
      author: user.id,
      category: category.id,
      code: "guide-001",
      title: "Getting started",
    });

    // Declared defaults reach the row exactly once, from the create schema;
    // the publication columns come from their own database defaults.
    expect(article).toMatchObject({
      featured: false,
      publishedAt: null,
      status: "draft",
      views: 0,
    });

    await expect(articles.findById(article.id)).resolves.toMatchObject({
      code: "guide-001",
      title: "Getting started",
    });

    const { edges, pageInfo } = await articles.findMany();
    expect(pageInfo.totalCount).toBe(1);
    // One LEFT JOIN per reference resolved both display labels.
    expect(edges[0].labels).toEqual({ author: "Ada", category: "Guides" });

    const updated = await articles.update(article.id, {
      title: "Getting started, properly",
    });
    expect([...(updated?.changedFields ?? [])].sort()).toEqual(["title"]);
    expect(updated?.row.title).toBe("Getting started, properly");

    // A unique text field is enforced by Postgres, not just by the descriptor.
    await expect(
      pgErrorCode(async () =>
        articles.create({
          category: category.id,
          code: "guide-001",
          title: "A duplicate",
        }),
      ),
    ).resolves.toBe("23505");

    // The relation is a real foreign key.
    await expect(
      pgErrorCode(async () =>
        articles.create({
          category: 999_999,
          code: "guide-002",
          title: "Orphan",
        }),
      ),
    ).resolves.toBe("23503");

    await expect(
      pgErrorCode(async () => categories.delete(category.id)),
    ).resolves.toBe(serverMajor >= 18 ? "23001" : "23503");

    // `onDelete: "set null"` on a nullable user field keeps the article.
    await sql`DELETE FROM "core_users" WHERE "id" = ${user.id}`;
    await expect(articles.findById(article.id)).resolves.toMatchObject({
      author: null,
    });

    // A null filter has to become `IS NULL`; equality against a null parameter
    // would match nothing and Postgres would not complain about it.
    await expect(
      articles.findMany({ filters: { author: null } }),
    ).resolves.toMatchObject({ pageInfo: { totalCount: 1 } });
    await expect(
      articles.findMany({ filters: { author: 999_999 } }),
    ).resolves.toMatchObject({ pageInfo: { totalCount: 0 } });

    await expect(articles.delete(article.id)).resolves.toMatchObject({
      id: article.id,
    });
    await expect(categories.delete(category.id)).resolves.toMatchObject({
      id: category.id,
    });
    await expect(articles.findById(article.id)).resolves.toBeNull();
  }, 60_000);

  it("runs the whole publication lifecycle", async () => {
    const categories = categoryContent.service(context);
    const articles = articleContent.service(context);

    const category = await categories.create({ name: "Lifecycle" });
    const draft = await articles.create({
      category: category.id,
      code: "lifecycle-001",
      title: "A draft",
    });

    expect(draft.status).toBe("draft");
    expect(draft.publishedAt).toBeNull();

    const published = await articles.publish(draft.id);
    expect(published).toMatchObject({ changed: true });
    expect(published?.row.status).toBe("published");
    expect(published?.publishedAt).toBeInstanceOf(Date);
    const firstPublishedAt = published?.publishedAt;

    // Idempotent: a second publish is a successful no-op, and the date it
    // stamped the first time is not rewritten.
    const again = await articles.publish(draft.id);
    expect(again).toMatchObject({ changed: false });
    expect(again?.publishedAt).toEqual(firstPublishedAt);
    expect(again?.row.status).toBe("published");

    // `status` is filterable once publication is enabled.
    await expect(
      articles.findMany({ filters: { status: "published" } }),
    ).resolves.toMatchObject({ pageInfo: { totalCount: 1 } });
    await expect(
      articles.findMany({ filters: { status: "draft" } }),
    ).resolves.toMatchObject({ pageInfo: { totalCount: 0 } });

    // Unpublishing flips the status and deliberately leaves `publishedAt` set,
    // so a temporary unpublish does not rewrite the publication date.
    const unpublished = await articles.unpublish(draft.id);
    expect(unpublished).toMatchObject({ changed: true });
    expect(unpublished?.row.status).toBe("draft");
    expect(unpublished?.publishedAt).toEqual(firstPublishedAt);

    await expect(articles.unpublish(draft.id)).resolves.toMatchObject({
      changed: false,
    });

    // Republishing keeps the original date rather than moving the article to
    // the top of a `publishedAt desc` feed.
    const republished = await articles.publish(draft.id);
    expect(republished).toMatchObject({ changed: true });
    expect(republished?.publishedAt).toEqual(firstPublishedAt);

    // A field update never touches the publication columns.
    const edited = await articles.update(draft.id, { title: "Still live" });
    expect(edited?.changedFields).toEqual(["title"]);
    expect(edited?.row.status).toBe("published");
    expect(edited?.row.publishedAt).toEqual(firstPublishedAt);

    await expect(articles.publish(999_999)).resolves.toBeNull();
    await expect(articles.unpublish(999_999)).resolves.toBeNull();

    await articles.delete(draft.id);
    await categories.delete(category.id);
  }, 60_000);

  it("applies the generated publication index", async () => {
    const indexes = await sql`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'example_articles'
        AND indexname = 'example_articles_status_published_at_idx'
    `;

    expect(indexes).toHaveLength(1);
    // Postgres only quotes the identifier that needs it.
    expect(indexes[0].indexdef).toContain(`btree (status, "publishedAt")`);
  });

  it("defaults new rows to draft at the database level", async () => {
    const [column] = await sql<
      { column_default: null | string; is_nullable: string }[]
    >`
      SELECT column_default, is_nullable FROM information_schema.columns
      WHERE table_name = 'example_articles' AND column_name = 'status'
    `;

    expect(column.is_nullable).toBe("NO");
    expect(column.column_default).toContain("draft");
  });

  it("applies the slug column and its unique index", async () => {
    const [column] = await sql<
      { character_maximum_length: number; is_nullable: string }[]
    >`
      SELECT character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'example_articles' AND column_name = 'slug'
    `;

    // The backfill ran before the tightening, or this migration would not have
    // applied at all.
    expect(column.is_nullable).toBe("NO");
    expect(column.character_maximum_length).toBe(160);

    const indexes = await sql`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'example_articles'
        AND indexname = 'example_articles_slug_key'
    `;

    expect(indexes).toHaveLength(1);
    expect(indexes[0].indexdef).toContain("CREATE UNIQUE INDEX");
  });

  it("runs the whole slug lifecycle", async () => {
    const categories = categoryContent.service(context);
    const articles = articleContent.service(context);

    const category = await categories.create({ name: "Slugs" });

    const article = await articles.create({
      category: category.id,
      code: "slug-001",
      title: "Zażółć gęślą jaźń",
    });

    // Derived from the title, transliterated, and stored as written.
    expect(article.slug).toBe("zazolc-gesla-jazn");

    // Filterable by equality - the lookup a public detail route will need.
    await expect(
      articles.findMany({ filters: { slug: "zazolc-gesla-jazn" } }),
    ).resolves.toMatchObject({ pageInfo: { totalCount: 1 } });

    // Renaming does not move the URL. This is the whole reason slugs are a
    // dedicated kind rather than a text field with a source.
    const renamed = await articles.update(article.id, {
      title: "A completely different title",
    });
    expect(renamed?.changedFields).toEqual(["title"]);
    expect(renamed?.row.slug).toBe("zazolc-gesla-jazn");

    // Sending it explicitly is the only way to change it, and it is normalised
    // on the way in whoever wrote it.
    const moved = await articles.update(article.id, {
      slug: "  A Brand   New Slug! ",
    });
    expect(moved?.row.slug).toBe("a-brand-new-slug");

    // Re-sending the stored value in another shape is not a change.
    await expect(
      articles.update(article.id, { slug: "A Brand New Slug" }),
    ).resolves.toMatchObject({ changedFields: [] });

    // Two articles cannot share a slug. Nothing auto-suffixes: Postgres
    // refuses, and the generated route turns 23505 into a 409.
    await expect(
      pgErrorCode(async () =>
        articles.create({
          category: category.id,
          code: "slug-002",
          slug: "a-brand-new-slug",
          title: "A different article",
        }),
      ),
    ).resolves.toBe("23505");

    // Same collision, reached by deriving rather than by sending.
    await expect(
      pgErrorCode(async () =>
        articles.create({
          category: category.id,
          code: "slug-003",
          title: "A Brand New Slug",
        }),
      ),
    ).resolves.toBe("23505");

    // A title with nothing sluggable in it is refused rather than guessed at.
    await expect(
      articles.create({
        category: category.id,
        code: "slug-004",
        title: "日本語のタイトル",
      }),
    ).rejects.toThrow(/Could not derive "slug" from "title"/);

    await articles.delete(article.id);
    await categories.delete(category.id);
  }, 60_000);

  it("runs the whole public lifecycle", async () => {
    const categories = categoryContent.service(context);
    const articles = articleContent.service(context);
    const publicArticles = articleContent.publicService?.(context);
    if (!publicArticles) throw new Error("Expected a public service.");

    const [user] = await sql<{ id: number }[]>`
      INSERT INTO "core_users" ("name") VALUES ('Ada') RETURNING "id"
    `;
    // Named to be unmistakable in a response body: `example.category` has no
    // public API of its own, so this string must never leave the AdminCP.
    const category = await categories.create({ name: "Internal-Only-Label" });

    const article = await articles.create({
      author: user.id,
      category: category.id,
      code: "public-001",
      excerpt: "A summary",
      title: "Hello public world",
    });

    // A draft is invisible: not in the list, and not findable by its slug.
    await expect(publicArticles.findMany()).resolves.toMatchObject({
      pageInfo: { totalCount: 0 },
    });
    await expect(
      publicArticles.findBySlug("hello-public-world"),
    ).resolves.toBeNull();
    await expect(publicArticles.findById(article.id)).resolves.toBeNull();

    await articles.publish(article.id);

    const listed = await publicArticles.findMany();
    expect(listed.pageInfo.totalCount).toBe(1);

    const detail = await publicArticles.findBySlug("hello-public-world");
    expect(detail).not.toBeNull();

    // Exactly the allowlist. `code`, `views` and `author` are absent, and the
    // author especially: a user field resolves to a person.
    expect(Object.keys(detail ?? {}).sort()).toEqual([
      "category",
      "excerpt",
      "featured",
      "publishedAt",
      "slug",
      "title",
    ]);
    expect(detail).toMatchObject({
      category: { id: category.id },
      excerpt: "A summary",
      title: "Hello public world",
    });
    // Fetched for the cursor, dropped from the projection.
    expect(detail).not.toHaveProperty("id");

    // The relation is an identifier and nothing else. `example.category` has no
    // public API, so reading its `admin.titleField` here would publish another
    // content type's private data through this one's allowlist.
    expect(detail?.category).toEqual({ id: category.id });
    expect(JSON.stringify(detail)).not.toContain("Internal-Only-Label");

    // Filtering, search and ordering all work through the public allowlists.
    await expect(
      publicArticles.findMany({ filters: { category: category.id } }),
    ).resolves.toMatchObject({ pageInfo: { totalCount: 1 } });
    await expect(
      publicArticles.findMany({ query: { search: "summary" } }),
    ).resolves.toMatchObject({ pageInfo: { totalCount: 1 } });
    await expect(
      publicArticles.findMany({ query: { search: "nothing here" } }),
    ).resolves.toMatchObject({ pageInfo: { totalCount: 0 } });
    await expect(
      publicArticles.findMany({ orderBy: { column: "title", order: "asc" } }),
    ).resolves.toMatchObject({ pageInfo: { totalCount: 1 } });

    // Changing the slug moves the public URL, and the old one stops resolving.
    await articles.update(article.id, { slug: "moved-somewhere-else" });
    await expect(
      publicArticles.findBySlug("hello-public-world"),
    ).resolves.toBeNull();
    await expect(
      publicArticles.findBySlug("moved-somewhere-else"),
    ).resolves.not.toBeNull();

    // A cleared publication date is exactly the leak `IS NOT NULL` prevents.
    await sql`UPDATE "example_articles" SET "publishedAt" = NULL WHERE "id" = ${article.id}`;
    await expect(
      publicArticles.findBySlug("moved-somewhere-else"),
    ).resolves.toBeNull();

    // So is a date in the future, which is what makes scheduling additive.
    await sql`
      UPDATE "example_articles"
      SET "publishedAt" = now() + interval '1 day'
      WHERE "id" = ${article.id}
    `;
    await expect(
      publicArticles.findBySlug("moved-somewhere-else"),
    ).resolves.toBeNull();
    await expect(publicArticles.findMany()).resolves.toMatchObject({
      pageInfo: { totalCount: 0 },
    });

    await sql`UPDATE "example_articles" SET "publishedAt" = now() WHERE "id" = ${article.id}`;
    await articles.unpublish(article.id);

    // Unpublished: gone from both endpoints even though `publishedAt` is set.
    await expect(publicArticles.findMany()).resolves.toMatchObject({
      pageInfo: { totalCount: 0 },
    });
    await expect(
      publicArticles.findBySlug("moved-somewhere-else"),
    ).resolves.toBeNull();

    await articles.publish(article.id);
    await articles.delete(article.id);

    await expect(
      publicArticles.findBySlug("moved-somewhere-else"),
    ).resolves.toBeNull();

    await sql`DELETE FROM "core_users" WHERE "id" = ${user.id}`;
    await categories.delete(category.id);
  }, 60_000);

  it("runs the whole search lifecycle", async () => {
    const categories = categoryContent.service(context);
    const articles = articleContent.service(context);
    const indexer = createContentSearchIndexer(articleContent, {
      pluginId: CONFIG_PLUGIN.pluginId,
    });

    // The search engine is the one thing stubbed here: `core_search_index` is a
    // core table whose generated column needs text-search configurations a stock
    // Postgres image does not ship (the same reason `core_users` is a stub). The
    // publication state every decision below turns on is real.
    const calls: { args: unknown[]; op: "delete" | "index" }[] = [];
    const searchContext = {
      get: (key: string) => {
        if (key === "search") {
          return {
            delete: async (...args: unknown[]) => {
              calls.push({ args, op: "delete" });
              await Promise.resolve();
            },
            index: async (...args: unknown[]) => {
              calls.push({ args, op: "index" });
              await Promise.resolve();
            },
          };
        }
        if (key === "log") {
          return {
            debug: async () => await Promise.resolve(),
            error: async () => await Promise.resolve(),
            warn: async () => await Promise.resolve(),
          };
        }

        return db;
      },
    } as unknown as Context;

    const sync = async (
      operation: ContentSearchOperation,
      input: { changed?: boolean; changedFields?: string[]; row: object },
    ) =>
      await syncContentSearch(searchContext, articleContentType, {
        operation,
        // A direct caller passes its own plugin id, exactly as the generated
        // routes do - otherwise the document would be owned by whichever plugin
        // the request belongs to.
        pluginId: CONFIG_PLUGIN.pluginId,
        ...input,
      });

    const category = await categories.create({ name: "Searchable" });
    const draft = await articles.create({
      category: category.id,
      code: "search-001",
      excerpt: "A findable summary",
      title: "Findable article",
    });

    // A draft is never indexed, and the decision is made from the real row.
    await expect(sync("create", { row: draft })).resolves.toMatchObject({
      action: "skip",
    });
    await expect(indexer.count?.(context)).resolves.toBe(0);
    await expect(indexer.load(context, 0, 10)).resolves.toEqual({
      documents: [],
      itemsRead: 0,
    });

    const published = await articles.publish(draft.id);
    if (!published) throw new Error("Expected a publish result.");

    const upsert = await sync("publish", {
      changed: published.changed,
      row: published.row,
    });
    expect(upsert.action).toBe("upsert");
    expect(upsert.documentId).toBe(`example.article:${draft.id}`);
    expect(calls.at(-1)?.op).toBe("index");
    expect(calls.at(-1)?.args[0]).toMatchObject({
      // `title` is one of the example's `contentFields`, and `excerpt` is both
      // the description and the second one - so it appears once, not twice.
      content: "Findable article\n\nA findable summary",
      isPublic: true,
      itemId: draft.id,
      itemType: "example.article",
      // The owning plugin, not core - the same value a rebuild stamps.
      pluginId: CONFIG_PLUGIN.pluginId,
      title: "Findable article",
      url: "/articles/findable-article",
    });

    // Only published rows reach the rebuild, and only the projected columns.
    await expect(indexer.count?.(context)).resolves.toBe(1);
    const page = await indexer.load(context, 0, 10);
    expect(page.itemsRead).toBe(1);
    const [document] = page.documents;
    expect(document).toMatchObject({
      itemId: draft.id,
      itemType: "example.article",
      // A rebuild reproduces the ownership the live write stored.
      pluginId: CONFIG_PLUGIN.pluginId,
      url: "/articles/findable-article",
    });
    // The private columns are not in the document, and the author is not in it
    // either - a user field is never public, so it is never indexed.
    expect(JSON.stringify(document)).not.toContain("search-001");
    expect(document).not.toHaveProperty("authorId");

    // Offsets page over the published rows deterministically, and the cursor
    // advances by source rows read.
    await expect(indexer.load(context, 1, 10)).resolves.toEqual({
      documents: [],
      itemsRead: 0,
    });

    // An idempotent publish writes nothing.
    const noop = await articles.publish(draft.id);
    expect(noop?.changed).toBe(false);
    const before = calls.length;
    await expect(
      sync("publish", { changed: noop?.changed, row: noop?.row ?? {} }),
    ).resolves.toMatchObject({ action: "skip" });
    expect(calls).toHaveLength(before);

    // An update that moves no indexed field writes nothing.
    const bumped = await articles.update(draft.id, { views: 5 });
    await expect(
      sync("update", {
        changedFields: bumped?.changedFields,
        row: bumped?.row ?? {},
      }),
    ).resolves.toMatchObject({ action: "skip" });

    // A slug change rewrites the url in place - there is no stale document,
    // because the document is keyed by item type and id.
    const renamed = await articles.update(draft.id, { slug: "moved-article" });
    await expect(
      sync("update", {
        changedFields: renamed?.changedFields,
        row: renamed?.row ?? {},
      }),
    ).resolves.toMatchObject({ action: "upsert" });
    expect(calls.at(-1)?.args[0]).toMatchObject({
      url: "/articles/moved-article",
    });
    await expect(indexer.load(context, 0, 10)).resolves.toMatchObject({
      documents: [{ url: "/articles/moved-article" }],
      itemsRead: 1,
    });

    // Unpublishing removes the document and takes the row out of the rebuild.
    const unpublished = await articles.unpublish(draft.id);
    await expect(
      sync("unpublish", {
        changed: unpublished?.changed,
        row: unpublished?.row ?? {},
      }),
    ).resolves.toMatchObject({ action: "delete" });
    expect(calls.at(-1)).toMatchObject({
      args: ["example.article", draft.id],
      op: "delete",
    });
    await expect(indexer.count?.(context)).resolves.toBe(0);
    await expect(indexer.load(context, 0, 10)).resolves.toEqual({
      documents: [],
      itemsRead: 0,
    });

    // A future publication date is not public, so it is not indexed either -
    // the same `publishedAt <= now()` rule the public read layer uses.
    await articles.publish(draft.id);
    await sql`
      UPDATE "example_articles"
      SET "publishedAt" = now() + interval '1 day'
      WHERE "id" = ${draft.id}
    `;
    await expect(indexer.load(context, 0, 10)).resolves.toEqual({
      documents: [],
      itemsRead: 0,
    });
    const scheduled = await articles.findById(draft.id);
    await expect(
      sync("update", { changedFields: ["title"], row: scheduled ?? {} }),
    ).resolves.toMatchObject({ action: "skip" });

    await sql`UPDATE "example_articles" SET "publishedAt" = now() WHERE "id" = ${draft.id}`;

    // Deleting a published record removes its document; `publishedAt` survives
    // an unpublish, so a record that was ever published is cleaned up too.
    const deleted = await articles.delete(draft.id);
    await expect(sync("delete", { row: deleted ?? {} })).resolves.toMatchObject(
      { action: "delete" },
    );

    const neverPublished = await articles.create({
      category: category.id,
      code: "search-002",
      title: "Never published",
    });
    await expect(
      sync("delete", { row: neverPublished }),
    ).resolves.toMatchObject({ action: "skip" });

    await articles.delete(neverPublished.id);
    await categories.delete(category.id);
  }, 60_000);

  it("keeps paging past published rows it cannot project", async () => {
    const categories = categoryContent.service(context);
    const articles = articleContent.service(context);
    const indexer = createContentSearchIndexer(articleContent, {
      pluginId: CONFIG_PLUGIN.pluginId,
    });

    const category = await categories.create({ name: "Paging" });
    const created: { id: number }[] = [];
    for (const index of [1, 2, 3]) {
      const article = await articles.create({
        category: category.id,
        code: `paging-00${index}`,
        title: `Paging article ${index}`,
      });
      await articles.publish(article.id);
      created.push(article);
    }

    // Only the database can produce this: `title` is required and non-nullable,
    // so the engine never writes a blank one. It is still what a rebuild has to
    // survive - the row is published, and the mapper refuses it.
    await sql`
      UPDATE "example_articles" SET "title" = '   ' WHERE "id" = ${created[0].id}
    `;

    // Page one reads a row and projects nothing. `itemsRead` is what says the
    // source is not finished, which is the whole reason it is reported.
    const first = await indexer.load(context, 0, 1);
    expect(first.itemsRead).toBe(1);
    expect(first.documents).toEqual([]);

    const second = await indexer.load(context, first.itemsRead, 1);
    expect(second.itemsRead).toBe(1);
    expect(second.documents.map(document => document.itemId)).toEqual([
      created[1].id,
    ]);

    // The source count still counts the malformed row, so the collection reads
    // as under-indexed in the AdminCP rather than silently complete.
    await expect(indexer.count?.(context)).resolves.toBe(3);
    const all = await indexer.load(context, 0, 50);
    expect(all.itemsRead).toBe(3);
    expect(all.documents).toHaveLength(2);

    for (const article of created) await articles.delete(article.id);
    await categories.delete(category.id);
  }, 60_000);

  describe("the editorial workflow", () => {
    const editorial = () => {
      const build = articleContent.editorialService;
      if (!build) throw new Error("example.article has no editorial service");

      return build(context, { pluginId: CONFIG_PLUGIN.pluginId });
    };

    const STAFF = { type: "staff", userId: null } as const;

    // The slug is derived from the title and the table has a unique index on
    // it, so every seeded article needs a title of its own.
    let seeded = 0;

    const seed = async () => {
      seeded += 1;
      const title = `Editorial subject ${seeded}`;

      const [category] = await sql<{ id: number }[]>`
        INSERT INTO "example_categories" ("name") VALUES ('Editorial')
        RETURNING "id"
      `;
      const created = await editorial().create(
        { category: category.id, code: `ed-${seeded}`, title },
        { actor: STAFF },
      );

      return { articleId: created.row.id, categoryId: category.id, title };
    };

    const cleanup = async (articleId: number, categoryId: number) => {
      await sql`DELETE FROM "example_articles" WHERE "id" = ${articleId}`;
      await sql`DELETE FROM "example_categories" WHERE "id" = ${categoryId}`;
      await sql`
        DELETE FROM "core_content_revisions" WHERE "itemId" = ${articleId}
      `;
    };

    const revisionsOf = async (articleId: number) =>
      await sql<{ operation: string; version: number }[]>`
        SELECT "operation", "version" FROM "core_content_revisions"
        WHERE "contentTypeId" = ${articleContentType.id}
          AND "itemId" = ${articleId}
        ORDER BY "version"
      `;

    it("starts at version 1 with one create revision", async () => {
      const { articleId, categoryId } = await seed();

      const [row] = await sql<{ version: number }[]>`
        SELECT "version" FROM "example_articles" WHERE "id" = ${articleId}
      `;
      expect(row.version).toBe(1);
      expect(await revisionsOf(articleId)).toEqual([
        { operation: "create", version: 1 },
      ]);

      await cleanup(articleId, categoryId);
    }, 30_000);

    it("lets exactly one of two concurrent writers win", async () => {
      const { articleId, categoryId } = await seed();

      // Both read version 1 and both write against it - the real lost-update
      // race, run for real rather than simulated with a mock.
      const results = await Promise.allSettled([
        editorial().update(
          articleId,
          { title: "Writer A" },
          { actor: STAFF, expectedVersion: 1 },
        ),
        editorial().update(
          articleId,
          { title: "Writer B" },
          { actor: STAFF, expectedVersion: 1 },
        ),
      ]);

      const fulfilled = results.filter(r => r.status === "fulfilled");
      const rejected = results.filter(r => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ContentVersionConflict);

      const [row] = await sql<{ version: number }[]>`
        SELECT "version" FROM "example_articles" WHERE "id" = ${articleId}
      `;
      // One increment, not two - the loser wrote nothing at all.
      expect(row.version).toBe(2);

      await cleanup(articleId, categoryId);
    }, 30_000);

    it("keeps the content write and its revision in one transaction", async () => {
      const { articleId, categoryId, title } = await seed();

      // A duplicate version is the one thing the unique index forbids, so
      // pre-claiming version 2 makes the revision insert fail - and the content
      // write must roll back with it.
      await sql`
        INSERT INTO "core_content_revisions"
          ("pluginId", "contentTypeId", "itemId", "version", "operation", "snapshot")
        VALUES (
          ${CONFIG_PLUGIN.pluginId}, ${articleContentType.id}, ${articleId},
          2, 'update', '{}'::jsonb
        )
      `;

      await expect(
        editorial().update(
          articleId,
          { title: "Should not survive" },
          { actor: STAFF, expectedVersion: 1 },
        ),
      ).rejects.toThrow();

      const [row] = await sql<{ title: string; version: number }[]>`
        SELECT "title", "version" FROM "example_articles" WHERE "id" = ${articleId}
      `;
      expect(row.title).toBe(title);
      expect(row.version).toBe(1);

      await cleanup(articleId, categoryId);
    }, 30_000);

    it("rejects two revisions at the same version", async () => {
      const { articleId, categoryId } = await seed();

      await expect(
        sql`
          INSERT INTO "core_content_revisions"
            ("pluginId", "contentTypeId", "itemId", "version", "operation", "snapshot")
          VALUES (
            ${CONFIG_PLUGIN.pluginId}, ${articleContentType.id}, ${articleId},
            1, 'update', '{}'::jsonb
          )
        `,
      ).rejects.toThrow();

      await cleanup(articleId, categoryId);
    }, 30_000);

    it("writes no revision and no version bump for a no-op", async () => {
      const { articleId, categoryId, title } = await seed();

      const result = await editorial().update(
        articleId,
        { title },
        { actor: STAFF, expectedVersion: 1 },
      );

      expect(result?.changed).toBe(false);
      expect(await revisionsOf(articleId)).toHaveLength(1);

      await cleanup(articleId, categoryId);
    }, 30_000);

    it("records publication transitions and skips the idempotent one", async () => {
      const { articleId, categoryId } = await seed();

      await editorial().publish(articleId, { actor: STAFF });
      const again = await editorial().publish(articleId, { actor: STAFF });

      expect(again?.changed).toBe(false);
      expect(await revisionsOf(articleId)).toEqual([
        { operation: "create", version: 1 },
        { operation: "publish", version: 2 },
      ]);

      await cleanup(articleId, categoryId);
    }, 30_000);

    it("restores an earlier revision without touching publication", async () => {
      const { articleId, categoryId, title } = await seed();

      await editorial().update(
        articleId,
        { title: "Second title" },
        { actor: STAFF, expectedVersion: 1 },
      );
      await editorial().publish(articleId, { actor: STAFF });

      const [first] = await sql<{ id: number }[]>`
        SELECT "id" FROM "core_content_revisions"
        WHERE "itemId" = ${articleId} AND "version" = 1
      `;

      const restored = await editorial().restore(articleId, first.id, {
        actor: STAFF,
        expectedVersion: 3,
      });

      expect(restored?.changed).toBe(true);
      expect(restored?.changedFields).toEqual(["title"]);

      const [row] = await sql<
        { status: string; title: string; version: number }[]
      >`
        SELECT "title", "status", "version" FROM "example_articles"
        WHERE "id" = ${articleId}
      `;
      expect(row.title).toBe(title);
      // A new version on top, not a rewind - and still published.
      expect(row.version).toBe(4);
      expect(row.status).toBe("published");

      // Nothing newer was deleted: the whole history is still there.
      expect(await revisionsOf(articleId)).toEqual([
        { operation: "create", version: 1 },
        { operation: "update", version: 2 },
        { operation: "publish", version: 3 },
        { operation: "restore", version: 4 },
      ]);

      await cleanup(articleId, categoryId);
    }, 30_000);

    it("refuses a revision belonging to another record", async () => {
      const first = await seed();
      const second = await seed();

      const [foreign] = await sql<{ id: number }[]>`
        SELECT "id" FROM "core_content_revisions"
        WHERE "itemId" = ${second.articleId} AND "version" = 1
      `;

      // Scoped by the record, not only by the revision id - the table is shared
      // by every editorial content type in the install.
      await expect(
        editorial().restore(first.articleId, foreign.id, {
          actor: STAFF,
          expectedVersion: 1,
        }),
      ).resolves.toBeNull();

      await cleanup(first.articleId, first.categoryId);
      await cleanup(second.articleId, second.categoryId);
    }, 30_000);

    it("keeps a final revision after the record is deleted", async () => {
      const { articleId, categoryId } = await seed();

      await editorial().delete(articleId, {
        actor: STAFF,
        expectedVersion: 1,
      });

      expect(await revisionsOf(articleId)).toEqual([
        { operation: "create", version: 1 },
        // One past the last live version: nothing holds it, and the history
        // stays strictly increasing.
        { operation: "delete", version: 2 },
      ]);

      await sql`
        DELETE FROM "core_content_revisions" WHERE "itemId" = ${articleId}
      `;
      await sql`DELETE FROM "example_categories" WHERE "id" = ${categoryId}`;
    }, 30_000);

    it("refuses to delete a version nobody has looked at", async () => {
      // The stale-table case: somebody edited the record after this row was
      // rendered, and the confirmation dialog cannot describe a change the
      // person has not seen.
      const { articleId, categoryId } = await seed();
      await editorial().update(
        articleId,
        { title: `Moved on ${seeded}` },
        { actor: STAFF, expectedVersion: 1 },
      );

      await expect(
        editorial().delete(articleId, { actor: STAFF, expectedVersion: 1 }),
      ).rejects.toBeInstanceOf(ContentVersionConflict);

      // Still there, and no `delete` revision was written either.
      const [row] = await sql<{ version: number }[]>`
        SELECT "version" FROM "example_articles" WHERE "id" = ${articleId}
      `;
      expect(row.version).toBe(2);
      expect(
        (await revisionsOf(articleId)).map(entry => entry.operation),
      ).toEqual(["create", "update"]);

      await cleanup(articleId, categoryId);
    }, 30_000);

    it("treats an already-deleted record as gone, not as a conflict", async () => {
      const { articleId, categoryId } = await seed();
      await editorial().delete(articleId, {
        actor: STAFF,
        expectedVersion: 1,
      });

      await expect(
        editorial().delete(articleId, { actor: STAFF, expectedVersion: 1 }),
      ).resolves.toBeNull();

      await cleanup(articleId, categoryId);
    }, 30_000);

    describe("reading the history back", () => {
      it("pages without repeating the boundary, and reaches every revision", async () => {
        // Retention is 20 on this content type and the page size here is 7, so
        // this is the exact shape the AdminCP hits: more history than one page.
        const { articleId, categoryId } = await seed();
        for (let index = 0; index < 11; index += 1) {
          await editorial().update(
            articleId,
            { title: `Paged title ${seeded}-${index}` },
            { actor: STAFF, expectedVersion: index + 1 },
          );
        }

        const revisions = editorial().revisions;
        const seen: number[] = [];
        let cursor: number | undefined;

        for (let page = 0; page < 5; page += 1) {
          const result = await revisions.list(articleId, { cursor, limit: 7 });
          seen.push(...result.edges.map(edge => edge.version));
          if (!result.pageInfo.hasNextPage) break;
          cursor = result.pageInfo.endCursor ?? undefined;
        }

        // 12 versions: the create plus 11 updates.
        expect(seen).toHaveLength(12);
        expect(new Set(seen).size).toBe(12);
        // Newest first, strictly decreasing, all the way down.
        expect(seen).toEqual([...seen].sort((a, b) => b - a));
        expect(seen.at(-1)).toBe(1);

        await cleanup(articleId, categoryId);
      }, 60_000);

      it("keeps page two stable when a revision lands in between", async () => {
        // A version cursor cannot shift under a reader the way an offset can:
        // anything written after page one is *newer* than the cursor.
        const { articleId, categoryId } = await seed();
        for (let index = 0; index < 5; index += 1) {
          await editorial().update(
            articleId,
            { title: `Stable title ${seeded}-${index}` },
            { actor: STAFF, expectedVersion: index + 1 },
          );
        }

        const revisions = editorial().revisions;
        const first = await revisions.list(articleId, { limit: 3 });

        await editorial().update(
          articleId,
          { title: `Stable title ${seeded}-inserted` },
          { actor: STAFF, expectedVersion: 6 },
        );

        const second = await revisions.list(articleId, {
          cursor: first.pageInfo.endCursor ?? undefined,
          limit: 3,
        });

        expect(first.edges.map(edge => edge.version)).toEqual([6, 5, 4]);
        expect(second.edges.map(edge => edge.version)).toEqual([3, 2, 1]);
        expect(second.pageInfo.hasNextPage).toBe(false);

        await cleanup(articleId, categoryId);
      }, 60_000);
    });

    it("prunes past the retention window", async () => {
      const { articleId, categoryId } = await seed();

      // Retention is 20 on this content type, so 22 versions leaves 20.
      for (let index = 0; index < 21; index += 1) {
        await editorial().update(
          articleId,
          { title: `Title ${index}` },
          { actor: STAFF, expectedVersion: index + 1 },
        );
      }

      const revisions = await revisionsOf(articleId);
      expect(revisions).toHaveLength(20);
      // The oldest survivor is exactly `newest - retention + 1`.
      expect(revisions[0].version).toBe(3);
      expect(revisions.at(-1)?.version).toBe(22);

      await cleanup(articleId, categoryId);
    }, 60_000);

    it("enables row level security on the revision table", async () => {
      const [table] = await sql<{ relrowsecurity: boolean }[]>`
        SELECT relrowsecurity FROM pg_class
        WHERE relname = 'core_content_revisions'
      `;

      expect(table.relrowsecurity).toBe(true);
    });
  });

  describe("scheduled publication", () => {
    const schedulesOn = (on: Context) => {
      const build = articleContent.editorialService;
      if (!build) throw new Error("example.article has no editorial service");

      const model = build(on, { pluginId: CONFIG_PLUGIN.pluginId }).schedules;
      if (!model) throw new Error("example.article has no scheduling");

      return model;
    };

    const schedules = () => schedulesOn(context);
    /** The same model on the second connection, for real lock contention. */
    const rivalSchedules = () => schedulesOn(rivalContext);

    let scheduled = 0;

    const seed = async () => {
      scheduled += 1;

      const [category] = await sql<{ id: number }[]>`
        INSERT INTO "example_categories" ("name") VALUES ('Scheduling')
        RETURNING "id"
      `;
      const [article] = await sql<{ id: number }[]>`
        INSERT INTO "example_articles" ("title", "slug", "code", "category")
        VALUES (
          ${`Scheduled subject ${scheduled}`},
          ${`scheduled-subject-${scheduled}`},
          ${`sch-${scheduled}`},
          ${category.id}
        )
        RETURNING "id"
      `;

      return { articleId: article.id, categoryId: category.id };
    };

    const cleanup = async (articleId: number, categoryId: number) => {
      await sql`DELETE FROM "core_content_schedules" WHERE "itemId" = ${articleId}`;
      await sql`DELETE FROM "core_content_revisions" WHERE "itemId" = ${articleId}`;
      await sql`DELETE FROM "example_articles" WHERE "id" = ${articleId}`;
      await sql`DELETE FROM "example_categories" WHERE "id" = ${categoryId}`;
    };

    const soon = () => new Date(Date.now() + 3_600_000);

    it("books a schedule and its queue row in one transaction", async () => {
      const { articleId, categoryId } = await seed();

      const booked = await schedules().schedule({
        action: "publish",
        actorUserId: null,
        itemId: articleId,
        scheduledFor: soon(),
      });

      const [queued] = await sql<{ availableAt: Date; pluginId: string }[]>`
        SELECT "availableAt", "pluginId" FROM "core_queue"
        WHERE "name" = 'content-schedule'
          AND "payload"->>'scheduleId' = ${String(booked.id)}
      `;

      expect(queued).toBeDefined();
      // Core owns the handler, so the row has to be stamped with core - the
      // worker resolves handlers by `${pluginId}:${name}`, and stamping the
      // requesting plugin would leave the row unclaimable forever.
      expect(queued.pluginId).toBe("@vitnode/core");

      await sql`DELETE FROM "core_queue" WHERE "name" = 'content-schedule'`;
      await cleanup(articleId, categoryId);
    }, 30_000);

    it("allows only one pending schedule per record and action", async () => {
      const { articleId, categoryId } = await seed();

      await schedules().schedule({
        action: "publish",
        actorUserId: null,
        itemId: articleId,
        scheduledFor: soon(),
      });

      // Enforced by a partial unique index, not by the code that reads before
      // it writes - so two requests arriving together cannot both insert.
      await expect(
        sql`
          INSERT INTO "core_content_schedules"
            ("pluginId", "contentTypeId", "itemId", "action", "scheduledFor")
          VALUES (
            ${CONFIG_PLUGIN.pluginId},
            ${articleContentType.id},
            ${articleId},
            'publish',
            ${soon()}
          )
        `,
      ).rejects.toThrow();

      await sql`DELETE FROM "core_queue" WHERE "name" = 'content-schedule'`;
      await cleanup(articleId, categoryId);
    }, 30_000);

    it("allows a publish and an unpublish to be pending together", async () => {
      const { articleId, categoryId } = await seed();
      const publishAt = soon();

      await schedules().schedule({
        action: "publish",
        actorUserId: null,
        itemId: articleId,
        scheduledFor: publishAt,
      });
      await schedules().schedule({
        action: "unpublish",
        actorUserId: null,
        itemId: articleId,
        scheduledFor: new Date(publishAt.getTime() + 3_600_000),
      });

      const rows = await sql<{ action: string }[]>`
        SELECT "action" FROM "core_content_schedules"
        WHERE "itemId" = ${articleId} AND "status" = 'pending'
        ORDER BY "action"
      `;

      expect(rows.map(entry => entry.action)).toEqual(["publish", "unpublish"]);

      await sql`DELETE FROM "core_queue" WHERE "name" = 'content-schedule'`;
      await cleanup(articleId, categoryId);
    }, 30_000);

    it("refuses an unpublish that would fire before its publish", async () => {
      const { articleId, categoryId } = await seed();
      const publishAt = soon();

      await schedules().schedule({
        action: "publish",
        actorUserId: null,
        itemId: articleId,
        scheduledFor: publishAt,
      });

      await expect(
        schedules().schedule({
          action: "unpublish",
          actorUserId: null,
          itemId: articleId,
          scheduledFor: new Date(publishAt.getTime() - 60_000),
        }),
      ).rejects.toThrow();

      await sql`DELETE FROM "core_queue" WHERE "name" = 'content-schedule'`;
      await cleanup(articleId, categoryId);
    }, 30_000);

    it("cancels the old row and bumps the generation on a reschedule", async () => {
      const { articleId, categoryId } = await seed();

      const first = await schedules().schedule({
        action: "publish",
        actorUserId: null,
        itemId: articleId,
        scheduledFor: soon(),
      });
      const second = await schedules().schedule({
        action: "publish",
        actorUserId: null,
        itemId: articleId,
        scheduledFor: new Date(Date.now() + 7_200_000),
      });

      expect(second.generation).toBe(first.generation + 1);

      const rows = await sql<{ generation: number; status: string }[]>`
        SELECT "generation", "status" FROM "core_content_schedules"
        WHERE "itemId" = ${articleId}
        ORDER BY "generation"
      `;

      // The old plan is kept as a cancelled row, so "we moved it twice" stays
      // recoverable - and the stale queue task finds a generation mismatch.
      expect(rows).toEqual([
        { generation: 1, status: "cancelled" },
        { generation: 2, status: "pending" },
      ]);

      await sql`DELETE FROM "core_queue" WHERE "name" = 'content-schedule'`;
      await cleanup(articleId, categoryId);
    }, 30_000);

    it("refuses a time well in the past", async () => {
      const { articleId, categoryId } = await seed();

      await expect(
        schedules().schedule({
          action: "publish",
          actorUserId: null,
          itemId: articleId,
          scheduledFor: new Date(Date.now() - 3_600_000),
        }),
      ).rejects.toThrow();

      await cleanup(articleId, categoryId);
    }, 30_000);

    it("enables row level security on the schedule table", async () => {
      const [table] = await sql<{ relrowsecurity: boolean }[]>`
        SELECT relrowsecurity FROM pg_class
        WHERE relname = 'core_content_schedules'
      `;

      expect(table.relrowsecurity).toBe(true);
    });

    describe("racing a cancel against the worker", () => {
      const statusOf = async (scheduleId: number) => {
        const [row] = await sql<
          { effectsError: null | string; status: string }[]
        >`
          SELECT "status", "effectsError" FROM "core_content_schedules"
          WHERE "id" = ${scheduleId}
        `;

        return row;
      };

      const book = async (itemId: number, when = new Date(Date.now() - 1000)) =>
        await schedules().schedule({
          action: "publish",
          actorUserId: null,
          itemId,
          scheduledFor: when,
        });

      const drain = async () => {
        await sql`DELETE FROM "core_queue"`;
      };

      it("lets the cancel win when it commits first", async () => {
        const { articleId, categoryId } = await seed();
        const booked = await book(articleId);

        // Committed before anything claims it.
        await schedules().cancel(articleId, booked.id);

        const outcome = await executeContentSchedule(context, {
          generation: booked.generation,
          scheduleId: booked.id,
        });

        expect(outcome.status).toBe("skipped");
        expect((await statusOf(booked.id)).status).toBe("cancelled");

        const [row] = await sql<{ status: string }[]>`
          SELECT "status" FROM "example_articles" WHERE "id" = ${articleId}
        `;
        expect(row.status).toBe("draft");

        await drain();
        await cleanup(articleId, categoryId);
      }, 30_000);

      it("makes the cancel wait, and then fail, once the worker owns the row", async () => {
        // The race the old shape lost. The worker used to release the lock
        // between claiming and publishing, so a cancel could commit in the gap,
        // report success, and then watch the article go live anyway.
        const { articleId, categoryId } = await seed();
        const booked = await book(articleId);

        let cancelSettled = false;
        let cancelling: Promise<null | { action: string }> | undefined;

        await db.transaction(async tx => {
          const claimed = await claimContentSchedule(tx, {
            generation: booked.generation,
            scheduleId: booked.id,
          });
          expect(claimed).not.toBeNull();

          // Fired on the *other* connection and deliberately not awaited: it
          // blocks on the row lock this transaction is holding.
          cancelling = rivalSchedules()
            .cancel(articleId, booked.id)
            .then(result => {
              cancelSettled = true;

              return result;
            });

          // Still blocked while the transition runs.
          await new Promise(resolve => setTimeout(resolve, 250));
          expect(cancelSettled).toBe(false);

          await settleContentSchedule(tx, booked.id, {
            expectedStatus: "pending",
            lastError: null,
            status: "completed",
          });
        });

        // Released by the commit, at which point the cancel re-evaluates its
        // `status = 'pending'` predicate and matches nothing - so the route
        // above it answers "no such pending schedule" rather than lying.
        await expect(cancelling).resolves.toBeNull();
        // Completed, not cancelled: the transition really happened.
        expect((await statusOf(booked.id)).status).toBe("completed");

        await drain();
        await cleanup(articleId, categoryId);
      }, 30_000);

      it("never lets a stale worker overwrite a cancelled schedule", async () => {
        // The guard `settleContentSchedule` carries. Without `expectedStatus`
        // this write would rewrite history to say a cancelled plan ran.
        const { articleId, categoryId } = await seed();
        const booked = await book(articleId);
        await schedules().cancel(articleId, booked.id);

        const settled = await settleContentSchedule(db, booked.id, {
          expectedStatus: "pending",
          lastError: null,
          status: "completed",
        });

        expect(settled).toBe(false);
        expect((await statusOf(booked.id)).status).toBe("cancelled");

        await drain();
        await cleanup(articleId, categoryId);
      }, 30_000);

      it("ignores the task left behind by a reschedule", async () => {
        const { articleId, categoryId } = await seed();
        const first = await book(articleId);
        const second = await book(articleId, new Date(Date.now() - 500));

        // The old task still exists and still points at the old row.
        const outcome = await executeContentSchedule(context, {
          generation: first.generation,
          scheduleId: first.id,
        });

        expect(outcome.status).toBe("skipped");
        const [row] = await sql<{ status: string }[]>`
          SELECT "status" FROM "example_articles" WHERE "id" = ${articleId}
        `;
        expect(row.status).toBe("draft");
        // And the replacement is untouched, still waiting its turn.
        expect((await statusOf(second.id)).status).toBe("pending");

        await drain();
        await cleanup(articleId, categoryId);
      }, 30_000);

      it("ignores a task whose generation no longer matches its row", async () => {
        const { articleId, categoryId } = await seed();
        const booked = await book(articleId);

        const outcome = await executeContentSchedule(context, {
          generation: booked.generation + 1,
          scheduleId: booked.id,
        });

        expect(outcome.status).toBe("skipped");
        expect((await statusOf(booked.id)).status).toBe("pending");

        await drain();
        await cleanup(articleId, categoryId);
      }, 30_000);
    });

    describe("executing a due schedule", () => {
      const drain = async () => {
        await sql`DELETE FROM "core_queue"`;
      };

      it("publishes, settles and queues the announcements in one commit", async () => {
        const { articleId, categoryId } = await seed();
        const booked = await schedules().schedule({
          action: "publish",
          actorUserId: null,
          itemId: articleId,
          // Inside the past tolerance, so it is due on this tick.
          scheduledFor: new Date(Date.now() - 1000),
        });
        await drain();

        const outcome = await executeContentSchedule(context, {
          generation: booked.generation,
          scheduleId: booked.id,
        });

        expect(outcome.status).toBe("executed");

        const [row] = await sql<{ status: string; version: number }[]>`
          SELECT "status", "version" FROM "example_articles"
          WHERE "id" = ${articleId}
        `;
        expect(row.status).toBe("published");
        expect(row.version).toBe(2);

        const [schedule] = await sql<{ completedAt: Date; status: string }[]>`
          SELECT "status", "completedAt" FROM "core_content_schedules"
          WHERE "id" = ${booked.id}
        `;
        expect(schedule.status).toBe("completed");
        expect(schedule.completedAt).not.toBeNull();

        // The revision the transition wrote, with the system as its actor.
        const [revision] = await sql<
          { actorType: string; operation: string; version: number }[]
        >`
          SELECT "operation", "version", "actorType"
          FROM "core_content_revisions"
          WHERE "itemId" = ${articleId} AND "operation" = 'publish'
        `;
        expect(revision).toMatchObject({
          actorType: "system",
          version: 2,
        });

        // And the announcements, durable and pointing at what committed.
        const [queued] = await sql<
          { payload: Record<string, unknown>; pluginId: string }[]
        >`
          SELECT "payload", "pluginId" FROM "core_queue"
          WHERE "name" = 'content-schedule-effects'
        `;
        expect(queued.pluginId).toBe("@vitnode/core");
        expect(queued.payload).toMatchObject({
          itemId: articleId,
          operation: "publish",
          scheduleId: booked.id,
          version: 2,
        });

        await drain();
        await cleanup(articleId, categoryId);
      }, 30_000);

      it("writes no announcement when the transition rolls back", async () => {
        // Atomicity in the direction that matters: a queue row for a
        // publication that never happened would announce a lie.
        const { articleId, categoryId } = await seed();
        const booked = await schedules().schedule({
          action: "publish",
          actorUserId: null,
          itemId: articleId,
          scheduledFor: new Date(Date.now() - 1000),
        });
        await drain();

        // Pre-claim version 2, which is the version the publish would write -
        // so the revision insert violates the unique index and the whole
        // transaction goes back.
        await sql`
          INSERT INTO "core_content_revisions"
            ("pluginId", "contentTypeId", "itemId", "version", "operation", "snapshot")
          VALUES (
            ${CONFIG_PLUGIN.pluginId}, ${articleContentType.id}, ${articleId},
            2, 'update', '{}'::jsonb
          )
        `;

        await expect(
          executeContentSchedule(context, {
            generation: booked.generation,
            scheduleId: booked.id,
          }),
        ).rejects.toThrow();

        const [row] = await sql<{ status: string }[]>`
          SELECT "status" FROM "example_articles" WHERE "id" = ${articleId}
        `;
        expect(row.status).toBe("draft");

        const queued = await sql`
          SELECT "id" FROM "core_queue" WHERE "name" = 'content-schedule-effects'
        `;
        expect(queued).toHaveLength(0);

        // Left pending with the reason on it, so the AdminCP shows it overdue
        // and the queue's backoff retries the transition.
        const [schedule] = await sql<
          { lastError: null | string; status: string }[]
        >`
          SELECT "status", "lastError" FROM "core_content_schedules"
          WHERE "id" = ${booked.id}
        `;
        expect(schedule.status).toBe("pending");
        expect(schedule.lastError).not.toBeNull();

        await drain();
        await cleanup(articleId, categoryId);
      }, 30_000);
    });
  });

  it("adds no columns or indexes for search", async () => {
    // Search is a projection of columns that already exist. If it ever needed
    // one of its own, every content type opting in would need a migration.
    const columns = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'example_articles'
    `;

    expect(columns.map(row => row.column_name).sort()).toEqual([
      "author",
      "category",
      "code",
      "createdAt",
      "excerpt",
      "featured",
      "id",
      "publishedAt",
      "slug",
      "status",
      "title",
      "updatedAt",
      // `editorial`, not `search` - the point of the assertion is that search
      // adds nothing, and listing every column is what makes that provable.
      "version",
      "views",
    ]);
  });

  it("has no public service without a public API", () => {
    // `example.category` opts into neither publication nor `publicApi`.
    expect(categoryContent.publicService).toBeUndefined();
  });

  it("rejects invalid input before it reaches Postgres", async () => {
    await expect(
      articleContent
        .service(context)
        .create({ category: 1, code: "x", title: "no" }),
    ).rejects.toThrow();
  });

  /**
   * Localization against a real database.
   *
   * Everything here is a property of Postgres rather than of the engine, which is
   * exactly why it cannot be unit-tested: a mock asked whether a rollback happened
   * can only agree with itself, and the composite primary key, the two foreign keys
   * and the per-language unique index are enforced by the server or not at all.
   */
  describe("localization", () => {
    // Both are `undefined` for a content type without localization, so
    // TypeScript refuses the call until the check has been made. Narrowed once
    // here rather than asserted past at every call site.
    const translations = (handle = context) => {
      const build = localizedArticleContent.translationService;
      if (!build) throw new Error("Expected a translation service.");

      return build(handle);
    };
    /**
     * The atomic-create service.
     *
     * `pluginId` is passed on purpose: it is what lets the default translation get
     * its own `create` revision, stamped with the right owner. Omitting it - which
     * every Stage 5A caller does - falls back to the plain repository write.
     */
    const localizedService = (handle = context) => {
      const build = localizedArticleContent.localizedService;
      if (!build) throw new Error("Expected a localized service.");

      return build(handle, { pluginId: CONFIG_PLUGIN.pluginId });
    };

    /** Every translation row for one record, straight out of SQL. */
    const rowsFor = async (itemId: number) =>
      await sql<
        { languageId: number; slug: string; title: string; version: number }[]
      >`
        SELECT "languageId", "slug", "title", "version"
        FROM "example_localized_articles_translations"
        WHERE "itemId" = ${itemId}
        ORDER BY "languageId"
      `;

    const countArticles = async () => {
      const [{ count }] = await sql<{ count: number }[]>`
        SELECT count(*)::int AS count FROM "example_localized_articles"
      `;

      return count;
    };

    const countTranslations = async () => {
      const [{ count }] = await sql<{ count: number }[]>`
        SELECT count(*)::int AS count
        FROM "example_localized_articles_translations"
      `;

      return count;
    };

    beforeEach(async () => {
      // The cascade is the point of one of the tests below, so clear the base
      // table and let it take the translations with it.
      await sql`DELETE FROM "example_localized_articles"`;
    });

    describe("atomic create", () => {
      it("commits the base row and its default translation together", async () => {
        const { row, translation } = await localizedService().create({
          shared: { featured: true },
          translation: { body: "Hello body", title: "Hello World" },
        });

        expect(row.featured).toBe(true);
        expect(translation).toMatchObject({
          itemId: row.id,
          locale: "en",
          version: 1,
        });
        expect(translation.values).toMatchObject({
          slug: "hello-world",
          title: "Hello World",
        });

        // Both really landed, read back through SQL rather than through the
        // service that wrote them.
        expect(await countArticles()).toBe(1);
        expect(await rowsFor(row.id)).toEqual([
          {
            languageId: 1,
            slug: "hello-world",
            title: "Hello World",
            version: 1,
          },
        ]);
      });

      it("keeps localized values off the base table", async () => {
        const { row } = await localizedService().create({
          shared: {},
          translation: { body: "Body of Column Check", title: "Column Check" },
        });

        const columns = await sql<{ column_name: string }[]>`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'example_localized_articles'
        `;

        expect(columns.map(column => column.column_name).sort()).toEqual([
          "createdAt",
          "featured",
          "id",
          // The base row's own lifecycle from Stage 5B on. Still no `title`,
          // `slug` or `body` - those live one table over, one row per language.
          "publishedAt",
          "status",
          "updatedAt",
          "version",
        ]);
        expect(row).not.toHaveProperty("title");
      });

      it("leaves no base row when the translation cannot be written", async () => {
        await localizedService().create({
          shared: {},
          translation: { body: "Body of First", slug: "taken", title: "First" },
        });
        const before = await countArticles();

        // The unique `(languageId, slug)` index rejects the second English row.
        await expect(
          localizedService().create({
            shared: {},
            translation: {
              body: "Body of Second",
              slug: "taken",
              title: "Second",
            },
          }),
        ).rejects.toThrow();

        // No orphan: the base insert went back with the transaction.
        expect(await countArticles()).toBe(before);
        expect(await countTranslations()).toBe(before);
      });

      it("creates nothing when the default language is missing", async () => {
        // A context whose language registry has no `en` row at all - what a typo
        // in `defaultLocale`, or a language somebody deleted, looks like.
        const blind = {
          get: (key: string) => {
            if (key === "db") {
              return {
                ...db,
                select: () => ({
                  from: () => [],
                  where: () => ({ limit: () => [] }),
                }),
              };
            }

            return context.get(key);
          },
        } as unknown as Context;

        await expect(
          localizedService(blind).create({
            shared: {},
            translation: {
              body: "Body of Never Written",
              title: "Never Written",
            },
          }),
        ).rejects.toThrow();
        expect(await countArticles()).toBe(0);
      });

      it("refuses to create a record straight into a non-default locale", async () => {
        await expect(
          localizedService().create(
            {
              shared: {},
              translation: { body: "Body of Witaj", title: "Witaj" },
            },
            { locale: "pl" },
          ),
        ).rejects.toThrow(/created in its default locale/);
        expect(await countArticles()).toBe(0);
      });
    });

    describe("per-locale optimistic locking", () => {
      it("versions each locale independently", async () => {
        const { row } = await localizedService().create({
          shared: {},
          translation: { body: "Body of English One", title: "English One" },
        });
        await translations().create(row.id, "pl", {
          body: "Body of Polski Jeden",
          title: "Polski Jeden",
        });

        // Move English twice, Polish once.
        await translations().update(
          row.id,
          "en",
          { body: "Body of English Two", title: "English Two" },
          { expectedVersion: 1 },
        );
        await translations().update(
          row.id,
          "en",
          { body: "Body of English Three", title: "English Three" },
          { expectedVersion: 2 },
        );
        await translations().update(
          row.id,
          "pl",
          { body: "Body of Polski Dwa", title: "Polski Dwa" },
          { expectedVersion: 1 },
        );

        expect(await rowsFor(row.id)).toMatchObject([
          { languageId: 1, version: 3 },
          { languageId: 2, version: 2 },
        ]);
      });

      it("lets two locales be edited concurrently without conflicting", async () => {
        const { row } = await localizedService().create({
          shared: {},
          translation: {
            body: "Body of Concurrent English",
            title: "Concurrent English",
          },
        });
        await translations().create(row.id, "pl", {
          body: "Body of Concurrent Polski",
          title: "Concurrent Polski",
        });
        await translations().update(
          row.id,
          "en",
          { body: "Body of English At Two", title: "English At Two" },
          { expectedVersion: 1 },
        );
        await translations().update(
          row.id,
          "en",
          { body: "Body of English At Three", title: "English At Three" },
          { expectedVersion: 2 },
        );

        // English is at 3, Polish at 1. Two writers, two connections, one each.
        const [english, polish] = await Promise.all([
          translations().update(
            row.id,
            "en",
            { body: "Body of English At Four", title: "English At Four" },
            { expectedVersion: 3 },
          ),
          translations(rivalContext).update(
            row.id,
            "pl",
            { body: "Body of Polski At Two", title: "Polski At Two" },
            { expectedVersion: 1 },
          ),
        ]);

        // Neither is told the other language moved: the lock is per row, and the
        // rows are keyed by `(itemId, languageId)`.
        expect(english).toMatchObject({ changed: true, version: 4 });
        expect(polish).toMatchObject({ changed: true, version: 2 });
      });

      it("lets exactly one of two writers on the same locale win", async () => {
        const { row } = await localizedService().create({
          shared: {},
          translation: { body: "Body of Race Subject", title: "Race Subject" },
        });
        await translations().create(row.id, "pl", {
          body: "Body of Wersja Jeden",
          title: "Wersja Jeden",
        });
        await translations().update(
          row.id,
          "pl",
          { body: "Body of Wersja Dwa", title: "Wersja Dwa" },
          { expectedVersion: 1 },
        );

        const outcomes = await Promise.allSettled([
          translations().update(
            row.id,
            "pl",
            { body: "Body of Wersja Trzy A", title: "Wersja Trzy A" },
            { expectedVersion: 2 },
          ),
          translations(rivalContext).update(
            row.id,
            "pl",
            { body: "Body of Wersja Trzy B", title: "Wersja Trzy B" },
            { expectedVersion: 2 },
          ),
        ]);

        const fulfilled = outcomes.filter(
          outcome => outcome.status === "fulfilled",
        );
        const rejected = outcomes.filter(
          outcome => outcome.status === "rejected",
        );

        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        expect(rejected[0]).toMatchObject({
          reason: expect.objectContaining({
            currentVersion: 3,
            expectedVersion: 2,
            locale: "pl",
          }),
        });
        // The winner's value is the one that is stored, and the version moved once.
        const [, polishRow] = await rowsFor(row.id);
        expect(polishRow.version).toBe(3);
      });

      it("refuses a stale update", async () => {
        const { row } = await localizedService().create({
          shared: {},
          translation: { body: "Body of Stale Update", title: "Stale Update" },
        });
        await translations().update(
          row.id,
          "en",
          { body: "Body of Moved On", title: "Moved On" },
          { expectedVersion: 1 },
        );

        await expect(
          translations().update(
            row.id,
            "en",
            { body: "Body of From The Past", title: "From The Past" },
            { expectedVersion: 1 },
          ),
        ).rejects.toThrow(ContentTranslationVersionConflict);
      });

      it("refuses a stale delete", async () => {
        const { row } = await localizedService().create({
          shared: {},
          translation: { body: "Body of Stale Delete", title: "Stale Delete" },
        });
        await translations().create(row.id, "pl", {
          body: "Body of Do Usuniecia",
          title: "Do Usuniecia",
        });
        await translations().update(
          row.id,
          "pl",
          { body: "Body of Zmienione", title: "Zmienione" },
          { expectedVersion: 1 },
        );

        await expect(
          translations().delete(row.id, "pl", { expectedVersion: 1 }),
        ).rejects.toThrow(ContentTranslationVersionConflict);
        expect(await rowsFor(row.id)).toHaveLength(2);
      });

      it("leaves version and updatedAt alone on a no-op", async () => {
        const { row } = await localizedService().create({
          shared: {},
          translation: {
            body: "Body of No Op Subject",
            title: "No Op Subject",
          },
        });
        // The raw `postgres` client is used directly here rather than Drizzle,
        // so a timestamp arrives as whatever the driver produced - hence the
        // explicit `new Date`.
        const [before] = await sql<{ updatedAt: string; version: number }[]>`
          SELECT "updatedAt", "version"
          FROM "example_localized_articles_translations"
          WHERE "itemId" = ${row.id} AND "languageId" = 1
        `;

        const result = await translations().update(
          row.id,
          "en",
          { body: "Body of No Op Subject", title: "No Op Subject" },
          { expectedVersion: 1 },
        );

        const [after] = await sql<{ updatedAt: string; version: number }[]>`
          SELECT "updatedAt", "version"
          FROM "example_localized_articles_translations"
          WHERE "itemId" = ${row.id} AND "languageId" = 1
        `;

        expect(result).toMatchObject({ changed: false, version: 1 });
        expect(after.version).toBe(before.version);
        // `$onUpdate` fires on any UPDATE, so an unchanged `updatedAt` is proof no
        // statement ran at all.
        expect(new Date(after.updatedAt).getTime()).toBe(
          new Date(before.updatedAt).getTime(),
        );
      });

      it("moves updatedAt on a real update", async () => {
        const { row } = await localizedService().create({
          shared: {},
          translation: { body: "Body of Real Update", title: "Real Update" },
        });
        const [before] = await sql<{ updatedAt: string }[]>`
          SELECT "updatedAt" FROM "example_localized_articles_translations"
          WHERE "itemId" = ${row.id} AND "languageId" = 1
        `;

        await translations().update(
          row.id,
          "en",
          { body: "Body of Really Updated", title: "Really Updated" },
          { expectedVersion: 1 },
        );

        const [after] = await sql<{ updatedAt: string }[]>`
          SELECT "updatedAt" FROM "example_localized_articles_translations"
          WHERE "itemId" = ${row.id} AND "languageId" = 1
        `;

        expect(new Date(after.updatedAt).getTime()).toBeGreaterThanOrEqual(
          new Date(before.updatedAt).getTime(),
        );
      });
    });

    describe("the default translation invariant", () => {
      it("refuses to delete the default translation", async () => {
        const { row } = await localizedService().create({
          shared: {},
          translation: {
            body: "Body of Keeps Its English",
            title: "Keeps Its English",
          },
        });

        await expect(
          translations().delete(row.id, "en", { expectedVersion: 1 }),
        ).rejects.toThrow(ContentDefaultTranslationRequired);
        expect(await rowsFor(row.id)).toHaveLength(1);
      });

      it("deletes an additional translation", async () => {
        const { row } = await localizedService().create({
          shared: {},
          translation: { body: "Body of Has Two", title: "Has Two" },
        });
        await translations().create(row.id, "pl", {
          body: "Body of Ma Dwa",
          title: "Ma Dwa",
        });

        const removed = await translations().delete(row.id, "pl", {
          expectedVersion: 1,
        });

        expect(removed).toMatchObject({ locale: "pl" });
        expect(await rowsFor(row.id)).toMatchObject([{ languageId: 1 }]);
      });
    });

    describe("locale-scoped slug uniqueness", () => {
      it("allows the same slug in two different languages", async () => {
        const { row } = await localizedService().create({
          shared: {},
          translation: { body: "Body of About", slug: "about", title: "About" },
        });

        await translations().create(row.id, "pl", {
          body: "O nas po polsku",
          slug: "about",
          title: "O Nas",
        });

        // `/en/about` and `/pl/about` are two different pages, and that is the
        // whole reason the unique index is `(languageId, slug)`.
        expect((await rowsFor(row.id)).map(item => item.slug)).toEqual([
          "about",
          "about",
        ]);
      });

      it("refuses two rows with the same slug in one language", async () => {
        const first = await localizedService().create({
          shared: {},
          translation: {
            body: "Body of First",
            slug: "duplicate",
            title: "First",
          },
        });
        const second = await localizedService().create({
          shared: {},
          translation: {
            body: "Body of Second",
            slug: "other",
            title: "Second",
          },
        });

        const code = await pgErrorCode(async () =>
          translations().update(
            second.row.id,
            "en",
            { slug: "duplicate" },
            { expectedVersion: 1 },
          ),
        );

        expect(code).toBe("23505");
        expect((await rowsFor(first.row.id))[0].slug).toBe("duplicate");
      });

      it("derives a different slug per language from that language's title", async () => {
        const { row } = await localizedService().create({
          shared: {},
          translation: {
            body: "Body of The English Title",
            title: "The English Title",
          },
        });
        await translations().create(row.id, "pl", {
          body: "Body of Polski Tytul",
          title: "Polski Tytul",
        });

        expect((await rowsFor(row.id)).map(item => item.slug)).toEqual([
          "the-english-title",
          "polski-tytul",
        ]);
      });
    });

    describe("foreign keys", () => {
      it("cascades translations when the record is deleted", async () => {
        const { row } = await localizedService().create({
          shared: {},
          translation: { body: "Body of Going Away", title: "Going Away" },
        });
        await translations().create(row.id, "pl", {
          body: "Body of Odchodzi",
          title: "Odchodzi",
        });
        expect(await rowsFor(row.id)).toHaveLength(2);

        // One statement, no loop over locales: the database owns the cascade.
        await localizedArticleContent.service(context).delete(row.id);

        expect(await rowsFor(row.id)).toEqual([]);
      });

      it("restricts deleting a language that content is written in", async () => {
        const { row } = await localizedService().create({
          shared: {},
          translation: {
            body: "Body of Holds English",
            title: "Holds English",
          },
        });
        await translations().create(row.id, "pl", {
          body: "Body of Trzyma Polski",
          title: "Trzyma Polski",
        });

        const code = await pgErrorCode(
          async () =>
            await sql`DELETE FROM "core_languages" WHERE "code" = 'pl'`,
        );

        // Refused, not silently cascaded: deleting a language must not quietly
        // delete every article written in it.
        //
        // Postgres 18 reports an explicit `ON DELETE RESTRICT` as `23001`
        // (restrict_violation) where earlier majors reported the generic
        // `23503` (foreign_key_violation), so the version decides which one is
        // correct rather than the assertion accepting either - "one of these
        // two" would still pass if a future major stopped refusing at all.
        expect(code).toBe(serverMajor >= 18 ? "23001" : "23503");
        // The rows are what actually matter: the code says how it was refused,
        // this says that nothing was lost.
        expect(await rowsFor(row.id)).toHaveLength(2);
      });

      it("refuses a translation for a record that does not exist", async () => {
        await expect(
          translations().create(999_999, "pl", {
            body: "Body of Nigdzie",
            title: "Nigdzie",
          }),
        ).rejects.toThrow(ContentTranslationItemMissing);
      });
    });

    describe("the composite primary key", () => {
      it("refuses a second translation in the same locale", async () => {
        const { row } = await localizedService().create({
          shared: {},
          translation: {
            body: "Body of Only One English",
            title: "Only One English",
          },
        });

        await expect(
          translations().create(row.id, "en", {
            body: "Body of Second English",
            title: "Second English",
          }),
        ).rejects.toThrow(ContentTranslationExists);
        expect(await rowsFor(row.id)).toHaveLength(1);
      });

      it("is the key Postgres actually created", async () => {
        const [key] = await sql<{ columns: string[]; name: string }[]>`
          SELECT
            c.conname AS name,
            array_agg(a.attname ORDER BY k.ord) AS columns
          FROM pg_constraint c
          JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
          WHERE c.conrelid = 'example_localized_articles_translations'::regclass
            AND c.contype = 'p'
          GROUP BY c.conname
        `;

        expect(key.name).toBe(
          "example_localized_articles_translations_item_id_language_id_pk",
        );
        expect(key.columns).toEqual(["itemId", "languageId"]);
      });
    });

    describe("language resolution", () => {
      it("returns the canonical locale whatever casing arrives", async () => {
        const { row } = await localizedService().create({
          shared: {},
          translation: {
            body: "Body of Casing Subject",
            title: "Casing Subject",
          },
        });

        expect((await translations().findByLocale(row.id, "EN"))?.locale).toBe(
          "en",
        );
      });

      it("refuses to write into a locale the app has disabled", async () => {
        const { row } = await localizedService().create({
          shared: {},
          translation: { body: "Body of No German", title: "No German" },
        });

        // `de` exists in `core_languages` but the app config switched it off.
        await expect(
          translations().create(row.id, "de", {
            body: "Body of Kein Deutsch",
            title: "Kein Deutsch",
          }),
        ).rejects.toMatchObject({ reason: "disabled" });
      });

      it("refuses an unknown locale", async () => {
        const { row } = await localizedService().create({
          shared: {},
          translation: { body: "Body of No Klingon", title: "No Klingon" },
        });

        await expect(
          translations().create(row.id, "tlh", {
            body: "Body of nuqneH",
            title: "nuqneH",
          }),
        ).rejects.toMatchObject({ reason: "missing" });
      });
    });

    describe("reads", () => {
      it("lists every locale a record exists in, without the bodies", async () => {
        const { row } = await localizedService().create({
          shared: {},
          translation: { body: "A long English body", title: "Listed" },
        });
        await translations().create(row.id, "pl", {
          body: "Dlugi polski tekst",
          title: "Na Liscie",
        });

        const edges = await translations().findManyForItem(row.id);

        expect(edges.map(edge => edge.locale)).toEqual(["en", "pl"]);
        for (const edge of edges) {
          expect(edge).not.toHaveProperty("values");
          expect(edge).not.toHaveProperty("body");
        }
      });

      it("finds a translation by language id as well as by locale", async () => {
        const { row } = await localizedService().create({
          shared: {},
          translation: {
            body: "Body of Found Both Ways",
            title: "Found Both Ways",
          },
        });

        expect(await translations().findByLanguageId(row.id, 1)).toMatchObject({
          locale: "en",
          version: 1,
        });
        expect(await translations().exists(row.id, "pl")).toBe(false);
        expect(await translations().exists(row.id, "en")).toBe(true);
      });

      it("never joins translations into an ordinary base list", async () => {
        await localizedService().create({
          shared: { featured: true },
          translation: {
            body: "Body of Base List Row",
            title: "Base List Row",
          },
        });

        const page = await localizedArticleContent
          .service(context)
          .findMany({ query: {} });

        expect(page.edges).toHaveLength(1);
        // Stage 5A loads translations explicitly, one record at a time. A list of
        // 25 rows must not drag 25 records' worth of every language with it.
        expect(page.edges[0]).not.toHaveProperty("title");
        expect(page.edges[0]).toMatchObject({ featured: true });
      });
    });

    describe("translation lifecycle", () => {
      const statusOf = async (itemId: number, languageId: number) => {
        const [row] = await sql<
          { publishedAt: null | string; status: string; version: number }[]
        >`
          SELECT "status", "publishedAt", "version"
          FROM "example_localized_articles_translations"
          WHERE "itemId" = ${itemId} AND "languageId" = ${languageId}
        `;

        return row;
      };

      /** A record with an English default translation and a Polish one. */
      const twoLocales = async (title: string) => {
        const { row } = await localizedService().create({
          shared: {},
          translation: { body: `Body of ${title}`, title },
        });
        await translations().create(row.id, "pl", {
          body: `Tresc ${title}`,
          title: `${title} PL`,
        });

        return row.id;
      };

      it("creates every translation as a draft", async () => {
        const itemId = await twoLocales("Lifecycle Draft");

        // A translator finishing a copy must not put it on the internet by
        // pressing save. `DEFAULT 'draft'` is what the migration relies on too.
        expect(await statusOf(itemId, 1)).toMatchObject({
          publishedAt: null,
          status: "draft",
        });
        expect(await statusOf(itemId, 2)).toMatchObject({ status: "draft" });
      });

      it("stamps publishedAt on the first publish and bumps the version", async () => {
        const itemId = await twoLocales("Lifecycle Publish");

        const result = await translations().publish(itemId, "pl");

        expect(result).toMatchObject({ changed: true, version: 2 });
        const after = await statusOf(itemId, 2);
        expect(after.status).toBe("published");
        expect(after.publishedAt).not.toBeNull();
      });

      it("is a true no-op when the translation is already published", async () => {
        const itemId = await twoLocales("Lifecycle Idempotent");
        await translations().publish(itemId, "pl");
        const before = await statusOf(itemId, 2);

        const result = await translations().publish(itemId, "pl");

        expect(result).toMatchObject({ changed: false });
        // No version, no timestamp, nothing - which is what keeps a retried task
        // from writing a second revision and a second event.
        expect(await statusOf(itemId, 2)).toEqual(before);
      });

      it("keeps the original publishedAt across a republish", async () => {
        const itemId = await twoLocales("Lifecycle Republish");
        await translations().publish(itemId, "pl");
        const first = await statusOf(itemId, 2);

        await translations().unpublish(itemId, "pl");
        await translations().publish(itemId, "pl");

        const after = await statusOf(itemId, 2);
        expect(after.publishedAt).toBe(first.publishedAt);
        expect(after.version).toBe(first.version + 2);
      });

      it("leaves publishedAt alone on unpublish", async () => {
        const itemId = await twoLocales("Lifecycle Unpublish");
        await translations().publish(itemId, "pl");
        const published = await statusOf(itemId, 2);

        await translations().unpublish(itemId, "pl");

        const after = await statusOf(itemId, 2);
        expect(after.status).toBe("draft");
        // "First published on" stays true after it is taken down again.
        expect(after.publishedAt).toBe(published.publishedAt);
      });

      it("publishes one locale without touching the other", async () => {
        const itemId = await twoLocales("Lifecycle Independent");

        await translations().publish(itemId, "pl");

        expect(await statusOf(itemId, 1)).toMatchObject({
          status: "draft",
          version: 1,
        });
        expect(await statusOf(itemId, 2)).toMatchObject({
          status: "published",
        });
      });

      it("refuses a stale expectedVersion", async () => {
        const itemId = await twoLocales("Lifecycle Stale");

        await expect(
          translations().publish(itemId, "pl", { expectedVersion: 9 }),
        ).rejects.toThrow(/version 1, not 9/);
      });

      it("refuses to publish into a locale the app has switched off", async () => {
        // `de` is `enabled: false` in this app's config, and one rule covers a
        // disabled language in both directions: nothing new goes *into* it -
        // create, update and publish all refuse - and everything can still come
        // *out* of it. Publishing into a locale nothing renders would put a page
        // on the internet that the app has no route for.
        const itemId = await twoLocales("Lifecycle Disabled");
        await sql`
          INSERT INTO "example_localized_articles_translations"
            ("itemId", "languageId", "title", "slug", "body")
          VALUES (${itemId}, 3, 'Deutsch', 'deutsch', 'Deutscher Text')
        `;

        await expect(
          translations().publish(itemId, "de"),
        ).rejects.toMatchObject({ reason: "disabled" });
        expect(await statusOf(itemId, 3)).toMatchObject({ status: "draft" });
      });

      it("still unpublishes and deletes a locale the app has switched off", async () => {
        // The other half of the rule, and the reason it is the other half: an
        // administrator who has just disabled a language wants to take down what
        // is already published in it. Refusing would strand those pages.
        const itemId = await twoLocales("Lifecycle Disabled Down");
        await sql`
          INSERT INTO "example_localized_articles_translations"
            ("itemId", "languageId", "title", "slug", "body", "status", "publishedAt")
          VALUES (${itemId}, 3, 'Deutsch', 'deutsch-down', 'Deutscher Text', 'published', now())
        `;

        await expect(
          translations().unpublish(itemId, "de"),
        ).resolves.toMatchObject({ changed: true });
        expect(await statusOf(itemId, 3)).toMatchObject({ status: "draft" });

        await expect(
          translations().delete(itemId, "de", { expectedVersion: 2 }),
        ).resolves.toMatchObject({ locale: "de" });
      });

      /**
       * The path a content type with `publication` and no `editorial` takes.
       *
       * The generated publish route calls the repository directly when there is
       * no history to write, so this is that orchestration in SQL: the status
       * moves, the version moves, an already-published translation is a true
       * no-op, and nothing lands in `core_content_revisions`.
       */
      it("runs the whole lifecycle without writing any history", async () => {
        const itemId = await twoLocales("Lifecycle No History");

        const published = await translations().publish(itemId, "pl");
        expect(published).toMatchObject({ changed: true, version: 2 });

        // Idempotent: no second version, and therefore nothing for an event or a
        // search write to be triggered by either.
        const again = await translations().publish(itemId, "pl");
        expect(again).toMatchObject({ changed: false, version: 2 });

        const down = await translations().unpublish(itemId, "pl");
        expect(down).toMatchObject({ changed: true, version: 3 });
        expect(await statusOf(itemId, 2)).toMatchObject({ status: "draft" });

        const [{ count }] = await sql<{ count: number }[]>`
          SELECT count(*)::int AS count
          FROM "core_content_revisions"
          WHERE "contentTypeId" = 'example.localized-article'
            AND "itemId" = ${itemId}
        `;
        expect(count).toBe(0);
      });

      it("carries the lifecycle in the metadata list", async () => {
        const itemId = await twoLocales("Lifecycle Metadata");
        await translations().publish(itemId, "pl");

        const metas = await translations().findManyForItem(itemId);

        expect(metas).toHaveLength(2);
        expect(metas[0]).toMatchObject({ locale: "en", status: "draft" });
        expect(metas[1]).toMatchObject({ locale: "pl", status: "published" });
      });
    });

    describe("translation revisions", () => {
      const editorial = (handle = context) => {
        const build = localizedArticleContent.translationEditorialService;
        if (!build)
          throw new Error("Expected a translation editorial service.");

        return build(handle, { pluginId: CONFIG_PLUGIN.pluginId });
      };

      const revisionsFor = async (itemId: number, languageId: null | number) =>
        await sql<
          { languageId: null | number; operation: string; version: number }[]
        >`
          SELECT "languageId", "operation", "version"
          FROM "core_content_revisions"
          WHERE "contentTypeId" = 'example.localized-article'
            AND "itemId" = ${itemId}
            AND ${
              languageId === null
                ? sql`"languageId" IS NULL`
                : sql`"languageId" = ${languageId}`
            }
          ORDER BY "version"
        `;

      beforeEach(async () => {
        await sql`
          DELETE FROM "core_content_revisions"
          WHERE "contentTypeId" = 'example.localized-article'
        `;
      });

      /**
       * A record whose default translation has a `create` revision.
       *
       * `actor` is what asks for one: without it the default translation is written
       * through the plain repository and leaves no history, which is exactly the
       * Stage 5A behaviour the atomic-create tests above still exercise.
       */
      const guide = async (title: string) => {
        const { row } = await localizedService().create(
          {
            shared: {},
            translation: { body: `Body of ${title}`, title },
          },
          { actor: ACTOR },
        );

        return row.id;
      };

      it("writes one revision per real translation mutation", async () => {
        const itemId = await guide("Revision Basics");

        await editorial().create(
          itemId,
          "pl",
          { body: "Tresc", title: "Polski" },
          { actor: ACTOR },
        );
        await editorial().update(
          itemId,
          "pl",
          { title: "Polski Nowy" },
          { actor: ACTOR, expectedVersion: 1 },
        );
        await editorial().publish(itemId, "pl", { actor: ACTOR });

        const rows = await revisionsFor(itemId, 2);
        expect(rows.map(row => row.operation)).toEqual([
          "create",
          "update",
          "publish",
        ]);
        expect(rows.map(row => row.version)).toEqual([1, 2, 3]);
      });

      it("writes no revision for a no-op", async () => {
        const itemId = await guide("Revision No Op");
        await editorial().create(
          itemId,
          "pl",
          { body: "Tresc", title: "Polski" },
          { actor: ACTOR },
        );

        await editorial().update(
          itemId,
          "pl",
          { title: "Polski" },
          { actor: ACTOR, expectedVersion: 1 },
        );
        await editorial().publish(itemId, "pl", { actor: ACTOR });
        await editorial().publish(itemId, "pl", { actor: ACTOR });

        // create, then publish. The unchanged update and the second publish both
        // wrote nothing.
        expect(
          (await revisionsFor(itemId, 2)).map(row => row.operation),
        ).toEqual(["create", "publish"]);
      });

      it("keeps each locale's versions independent under the partial index", async () => {
        const itemId = await guide("Revision Independent");
        await editorial().create(
          itemId,
          "pl",
          { body: "Tresc", title: "Polski" },
          { actor: ACTOR },
        );

        // English v1 and Polish v1 are two different facts, and so are their v2s.
        // A single unique index over `(contentTypeId, itemId, version)` would have
        // rejected the second of each pair.
        await editorial().publish(itemId, "en", { actor: ACTOR });
        await editorial().publish(itemId, "pl", { actor: ACTOR });

        const english = await revisionsFor(itemId, 1);
        const polish = await revisionsFor(itemId, 2);

        expect(english.map(row => row.version)).toEqual([1, 2]);
        expect(polish.map(row => row.version)).toEqual([1, 2]);
      });

      it("leaves the shared history unmixed with any locale's", async () => {
        const itemId = await guide("Revision Shared");
        await editorial().create(
          itemId,
          "pl",
          { body: "Tresc", title: "Polski" },
          { actor: ACTOR },
        );

        // The base row's own editorial history uses `languageId IS NULL`, which is
        // exactly what every pre-Stage-5B revision already was.
        expect(await revisionsFor(itemId, null)).toHaveLength(0);
        expect(await revisionsFor(itemId, 2)).toHaveLength(1);
      });

      it("snapshots localized fields only", async () => {
        const itemId = await guide("Revision Snapshot");
        await editorial().create(
          itemId,
          "pl",
          { body: "Tresc", title: "Polski" },
          { actor: ACTOR },
        );

        const [row] = await sql<{ snapshot: Record<string, unknown> }[]>`
          SELECT "snapshot" FROM "core_content_revisions"
          WHERE "itemId" = ${itemId} AND "languageId" = 2
        `;
        const fields = (row.snapshot as { fields: Record<string, unknown> })
          .fields;

        // Order is not asserted: Postgres stores `jsonb` with its own key order.
        expect(Object.keys(fields).sort()).toEqual(["body", "slug", "title"]);
        expect(fields).not.toHaveProperty("featured");
      });

      it("scopes history reads to one locale", async () => {
        const itemId = await guide("Revision Scoped");
        await editorial().create(
          itemId,
          "pl",
          { body: "Tresc", title: "Polski" },
          { actor: ACTOR },
        );

        await editorial().update(
          itemId,
          "pl",
          { title: "Polski Nowy" },
          { actor: ACTOR, expectedVersion: 1 },
        );

        const english = await editorial().listRevisions(itemId, "en");
        const polish = await editorial().listRevisions(itemId, "pl");

        // One `create` each, plus the Polish update - and no overlap at all: the
        // read filters on `languageId`, it is not a post-filter over a wider one.
        expect(english.edges.map(edge => edge.operation)).toEqual(["create"]);
        expect(polish.edges.map(edge => edge.operation)).toEqual([
          "update",
          "create",
        ]);
      });

      it("restores one locale forward to a new version", async () => {
        const itemId = await guide("Revision Restore");
        await editorial().update(
          itemId,
          "en",
          { title: "Second Title" },
          { actor: ACTOR, expectedVersion: 1 },
        );

        const history = await editorial().listRevisions(itemId, "en");
        const first = history.edges.at(-1);
        if (!first) throw new Error("Expected a first revision.");

        const outcome = await editorial().restore(itemId, "en", first.id, {
          actor: ACTOR,
          expectedVersion: 2,
        });
        expect(outcome?.changed).toBe(true);
        // Forward to 3, not back to 1: the history stays append-only.
        expect(outcome?.version).toBe(3);
        expect(outcome?.restoredFromRevisionId).toBe(first.id);
        expect((await rowsFor(itemId))[0]).toMatchObject({
          title: "Revision Restore",
          version: 3,
        });
      });

      it("refuses a revision belonging to another locale", async () => {
        const itemId = await guide("Revision Cross Locale");
        await editorial().create(
          itemId,
          "pl",
          { body: "Tresc", title: "Polski" },
          { actor: ACTOR },
        );
        const polish = await editorial().listRevisions(itemId, "pl");
        const revisionId = polish.edges[0]?.id;
        if (revisionId === undefined) throw new Error("Expected a revision.");

        // Scoped by language before anything is read, so the Polish revision is
        // simply not found from the English tab.
        expect(
          await editorial().restore(itemId, "en", revisionId, {
            actor: ACTOR,
            expectedVersion: 1,
          }),
        ).toBeNull();
      });

      it("keeps the publication state across a restore", async () => {
        const itemId = await guide("Revision Restore Published");
        await editorial().publish(itemId, "en", { actor: ACTOR });
        await editorial().update(
          itemId,
          "en",
          { title: "Changed While Published" },
          { actor: ACTOR, expectedVersion: 2 },
        );

        const history = await editorial().listRevisions(itemId, "en");
        const original = history.edges.at(-1);
        if (!original) throw new Error("Expected the create revision.");

        await editorial().restore(itemId, "en", original.id, {
          actor: ACTOR,
          expectedVersion: 3,
        });

        // Restoring field values never takes a translation off the internet, and
        // never puts one on it.
        const [row] = await sql<{ status: string }[]>`
          SELECT "status" FROM "example_localized_articles_translations"
          WHERE "itemId" = ${itemId} AND "languageId" = 1
        `;
        expect(row.status).toBe("published");
      });

      it("prunes each locale's history against its own retention window", async () => {
        const itemId = await guide("Revision Retention");

        // Retention is 20 on this fixture, so nothing is pruned yet - what this
        // proves is that the two locales' counters do not compete for the window.
        for (let index = 0; index < 3; index += 1) {
          await editorial().update(
            itemId,
            "en",
            { title: `English ${index}` },
            { actor: ACTOR, expectedVersion: index + 1 },
          );
        }

        // The create plus three updates. Polish has none of them, so five Polish
        // revisions could never evict an English one.
        expect(await revisionsFor(itemId, 1)).toHaveLength(4);
        expect(await revisionsFor(itemId, 2)).toHaveLength(0);
      });

      it("refuses a stale expectedVersion on a restore", async () => {
        const itemId = await guide("Revision Restore Stale");
        await editorial().update(
          itemId,
          "en",
          { title: "Moved On" },
          { actor: ACTOR, expectedVersion: 1 },
        );
        const history = await editorial().listRevisions(itemId, "en");
        const first = history.edges.at(-1);
        if (!first) throw new Error("Expected a first revision.");

        await expect(
          editorial().restore(itemId, "en", first.id, {
            actor: ACTOR,
            expectedVersion: 1,
          }),
        ).rejects.toThrow(/version 2, not 1/);
      });

      /**
       * A translation row is deleted physically; its history is not.
       *
       * So a locale can be recreated on top of revisions that already exist, and
       * the version a fresh row starts at cannot be 1: the locale-scoped unique
       * index on `(contentTypeId, itemId, languageId, version)` would reject the
       * new `create` revision against the old one, and the write would fail with a
       * `23505` a translator has no way to act on. The new row picks up where the
       * old one left off instead.
       */
      it("keeps one increasing history across a delete and a recreate", async () => {
        const itemId = await guide("Recreated");

        const created = await editorial().create(
          itemId,
          "pl",
          { body: "Tresc", title: "Polski" },
          { actor: ACTOR },
        );
        expect(created.version).toBe(1);

        const updated = await editorial().update(
          itemId,
          "pl",
          { title: "Polski Nowy" },
          { actor: ACTOR, expectedVersion: 1 },
        );
        expect(updated?.version).toBe(2);

        // The row held 2; the delete revision records 3, so the number the row
        // last held is not reused by the thing that removed it.
        const deleted = await editorial().delete(itemId, "pl", {
          actor: ACTOR,
          expectedVersion: 2,
        });
        expect(deleted?.version).toBe(3);
        expect((await rowsFor(itemId)).map(item => item.languageId)).toEqual([
          1,
        ]);

        // 4, not 1. This is the write that used to fail.
        const recreated = await editorial().create(
          itemId,
          "pl",
          { body: "Znowu", title: "Polski Znowu" },
          { actor: ACTOR },
        );
        expect(recreated.version).toBe(4);

        const again = await editorial().update(
          itemId,
          "pl",
          { title: "Polski Trzeci" },
          { actor: ACTOR, expectedVersion: 4 },
        );
        expect(again?.version).toBe(5);

        // Nothing was pruned to make room, and nothing collided.
        expect(
          (await revisionsFor(itemId, 2)).map(row => [
            row.version,
            row.operation,
          ]),
        ).toEqual([
          [1, "create"],
          [2, "update"],
          [3, "delete"],
          [4, "create"],
          [5, "update"],
        ]);

        // And the AdminCP, which reads newest first, sees the same five.
        const history = await editorial().listRevisions(itemId, "pl");
        expect(history.edges.map(edge => edge.version)).toEqual([
          5, 4, 3, 2, 1,
        ]);

        // The row itself is at 5, so the next optimistic write asks for 5.
        expect(
          (await rowsFor(itemId)).find(item => item.languageId === 2)?.version,
        ).toBe(5);
      });

      it("leaves another locale's counter alone when one is recreated", async () => {
        const itemId = await guide("Recreated Independently");

        // English is at 1 from the atomic create. Polish runs to 3 and is
        // deleted, so its next life starts at 4 - a shared counter would have
        // started it at 5 and left a hole nothing explains.
        await editorial().create(
          itemId,
          "pl",
          { body: "Tresc", title: "Polski Nieza" },
          { actor: ACTOR },
        );
        await editorial().update(
          itemId,
          "pl",
          { title: "Polski Nieza Nowy" },
          { actor: ACTOR, expectedVersion: 1 },
        );
        await editorial().delete(itemId, "pl", {
          actor: ACTOR,
          expectedVersion: 2,
        });

        const recreated = await editorial().create(
          itemId,
          "pl",
          { body: "Znowu", title: "Polski Nieza Znowu" },
          { actor: ACTOR },
        );

        expect(recreated.version).toBe(4);
        expect((await revisionsFor(itemId, 1)).map(row => row.version)).toEqual(
          [1],
        );
      });

      /**
       * The recreate above, run as a race on two connections.
       *
       * Both writers read the same `latest()` inside their own transaction and
       * both compute the same next version, so the only thing standing between
       * them and two rows is the primary key. `create` targets its
       * `onConflictDoNothing` at `(itemId, languageId)` alone, which is what
       * turns the loser into a named `ContentTranslationExists` instead of a
       * `23505` a translator cannot act on - and what leaves a *slug* clash still
       * reported as the unique violation it is.
       */
      it("lets exactly one of two concurrent recreates claim the version", async () => {
        const itemId = await guide("Recreated Concurrently");

        await editorial().create(
          itemId,
          "pl",
          { body: "Tresc", title: "Polski Wyscig" },
          { actor: ACTOR },
        );
        await editorial().delete(itemId, "pl", {
          actor: ACTOR,
          expectedVersion: 1,
        });

        const outcomes = await Promise.allSettled([
          editorial().create(
            itemId,
            "pl",
            { body: "Znowu A", title: "Polski Wyscig A" },
            { actor: ACTOR },
          ),
          editorial(rivalContext).create(
            itemId,
            "pl",
            { body: "Znowu B", title: "Polski Wyscig B" },
            { actor: ACTOR },
          ),
        ]);

        const fulfilled = outcomes.filter(
          outcome => outcome.status === "fulfilled",
        );
        const rejected = outcomes.filter(
          outcome => outcome.status === "rejected",
        );

        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        // Structured, and named for what actually happened - not the driver's
        // constraint message.
        expect(rejected[0]).toMatchObject({
          reason: expect.objectContaining({
            itemId,
            locale: "pl",
            name: "ContentTranslationExists",
          }),
        });

        // One row, at the version the delete left room for.
        const polish = (await rowsFor(itemId)).filter(
          row => row.languageId === 2,
        );
        expect(polish).toHaveLength(1);
        expect(polish[0].version).toBe(3);

        // The loser's transaction took its revision down with it, so the history
        // is still strictly increasing with no duplicate at 3.
        expect(
          (await revisionsFor(itemId, 2)).map(row => [
            row.version,
            row.operation,
          ]),
        ).toEqual([
          [1, "create"],
          [2, "delete"],
          [3, "create"],
        ]);
      });

      /**
       * A delete and an update that both think the row is at the same version.
       *
       * Exactly one of them may take effect, and the loser has two legitimate
       * answers depending on which order they land in - so the assertion is on
       * the *pair*, not on either one:
       *
       * - the delete lands first, and the update finds no translation at all,
       *   which is a `null` the route turns into a 404 rather than a conflict;
       * - the update lands first, and the delete re-reads after its zero-row
       *   statement, finds the row at 2 and reports a version conflict.
       *
       * What must never happen is both taking effect: a delete reporting that it
       * removed a row the update had just moved would be a lost update, and an
       * update writing over a row the delete had removed would resurrect it.
       */
      it("never lets a delete and a stale update resurrect or lose a translation", async () => {
        const itemId = await guide("Delete Versus Update");

        await editorial().create(
          itemId,
          "pl",
          { body: "Tresc", title: "Polski Kontra" },
          { actor: ACTOR },
        );

        const [deletion, revision] = await Promise.allSettled([
          editorial().delete(itemId, "pl", {
            actor: ACTOR,
            expectedVersion: 1,
          }),
          editorial(rivalContext).update(
            itemId,
            "pl",
            { title: "Polski Kontra Nowy" },
            { actor: ACTOR, expectedVersion: 1 },
          ),
        ]);

        const polish = (await rowsFor(itemId)).filter(
          row => row.languageId === 2,
        );
        const history = await revisionsFor(itemId, 2);
        const deleteWon = polish.length === 0;

        if (deleteWon) {
          // The update found nothing to update. `null`, not a conflict: there is
          // no version to disagree about once the row is gone.
          expect(deletion).toMatchObject({
            status: "fulfilled",
            value: expect.objectContaining({ version: 2 }),
          });
          expect(revision).toStrictEqual({
            status: "fulfilled",
            value: null,
          });
          expect(history.map(row => [row.version, row.operation])).toEqual([
            [1, "create"],
            [2, "delete"],
          ]);

          return;
        }

        // The update won, so the delete's `expectedVersion: 1` no longer matches
        // a row that is sitting at 2 - and it says so rather than reporting a
        // removal that never happened.
        expect(revision).toMatchObject({
          status: "fulfilled",
          value: expect.objectContaining({ changed: true, version: 2 }),
        });
        expect(deletion).toMatchObject({
          reason: expect.objectContaining({
            currentVersion: 2,
            expectedVersion: 1,
            locale: "pl",
            name: "ContentTranslationVersionConflict",
          }),
          status: "rejected",
        });
        expect(polish[0].version).toBe(2);
        expect(history.map(row => [row.version, row.operation])).toEqual([
          [1, "create"],
          [2, "update"],
        ]);
      });
    });

    /**
     * The Stage 5C public read, against a real database.
     *
     * The interesting behaviour is entirely in the SQL: subordination is two
     * `published` predicates on two tables, the fallback is which translation the
     * join resolves to, and a strict-locale slug is the absence of a second arm.
     * A mock asked whether the right translation was joined can only agree with
     * itself.
     */
    describe("public reads", () => {
      const publicService = (handle = context) => {
        const build = localizedArticleContent.publicService;
        if (!build) throw new Error("Expected a public service.");

        return build(handle);
      };

      const editorial = (handle = context) => {
        const build = localizedArticleContent.translationEditorialService;
        if (!build)
          throw new Error("Expected a translation editorial service.");

        return build(handle, { pluginId: CONFIG_PLUGIN.pluginId });
      };

      /**
       * A record published globally, with an English translation and - when asked
       * - a Polish one, each published or left as a draft.
       */
      const seed = async ({
        featured = false,
        pl,
        title,
      }: {
        featured?: boolean;
        pl?: { published: boolean; title: string };
        title: string;
      }) => {
        const { row } = await localizedService().create({
          shared: { featured },
          translation: { body: `Body of ${title}`, title },
        });

        await articlePublish(row.id);
        await editorial().publish(row.id, "en", { actor: ACTOR });

        if (pl) {
          await translations().create(row.id, "pl", {
            body: `Tresc ${pl.title}`,
            title: pl.title,
          });
          if (pl.published) {
            await editorial().publish(row.id, "pl", { actor: ACTOR });
          }
        }

        return row.id;
      };

      /** Publishes the *record*, which every translation is subordinate to. */
      const articlePublish = async (itemId: number) => {
        await sql`
          UPDATE "example_localized_articles"
          SET "status" = 'published', "publishedAt" = now()
          WHERE "id" = ${itemId}
        `;
      };

      it("serves the requested language", async () => {
        const itemId = await seed({
          pl: { published: true, title: "Witaj" },
          title: "Hello",
        });

        const row = await publicService().findById(itemId, { locale: "pl" });

        expect(row).toMatchObject({ locale: "pl", title: "Witaj" });
      });

      it("mixes shared and localized columns in one row", async () => {
        const itemId = await seed({ featured: true, title: "Mixed" });

        // A public localized response is a base row joined to a translation.
        expect(
          await publicService().findById(itemId, { locale: "en" }),
        ).toMatchObject({ featured: true, title: "Mixed" });
      });

      it("falls back to the default language and says so", async () => {
        const itemId = await seed({ title: "Only English" });

        const row = await publicService().findById(itemId, { locale: "pl" });

        // Served, and honest about which language it is - which is what a
        // language switcher and `hreflang` need.
        expect(row).toMatchObject({ locale: "en", title: "Only English" });
      });

      it("never falls back to a draft translation", async () => {
        const itemId = await seed({
          pl: { published: false, title: "Szkic" },
          title: "Published English",
        });

        // The fallback picks *which* translation the predicate runs against; it
        // never relaxes the predicate.
        expect(
          await publicService().findById(itemId, { locale: "pl" }),
        ).toMatchObject({ locale: "en" });
      });

      it("hides every language while the record itself is a draft", async () => {
        const { row } = await localizedService().create({
          shared: {},
          translation: { body: "Body", title: "Unpublished Record" },
        });
        await editorial().publish(row.id, "en", { actor: ACTOR });

        // Subordination: publishing the English copy of a draft article puts
        // nothing on the internet.
        expect(
          await publicService().findById(row.id, { locale: "en" }),
        ).toBeNull();
      });

      it("resolves a slug strictly in its own language", async () => {
        await seed({
          pl: { published: true, title: "Witaj Swiecie" },
          title: "Hello World",
        });
        const polish = await publicService().findBySlug("witaj-swiecie", {
          locale: "pl",
        });

        expect(polish).toMatchObject({ locale: "pl", title: "Witaj Swiecie" });
        // The same slug on the English URL is a 404 rather than the Polish
        // article: a URL belongs to a language.
        expect(
          await publicService().findBySlug("witaj-swiecie", { locale: "en" }),
        ).toBeNull();
      });

      it("does not fall back on a slug lookup", async () => {
        await seed({ title: "Fallback Slug" });

        // The English article is reachable in Polish through the fallback, but
        // its English URL is not a Polish URL.
        expect(
          await publicService().findBySlug("fallback-slug", { locale: "pl" }),
        ).toBeNull();
      });

      it("lists one row per record, in the requested language", async () => {
        await seed({ pl: { published: true, title: "Jeden" }, title: "One" });
        await seed({ title: "Two" });

        const { edges } = await publicService().findMany({ locale: "pl" });

        // Two records, not three rows: the join resolves one translation each.
        expect(edges.map(edge => edge.title).sort()).toEqual(["Jeden", "Two"]);
      });

      it("counts the same rows it returns", async () => {
        await seed({ title: "Counted One" });
        await seed({ title: "Counted Two" });

        const { pageInfo } = await publicService().findMany({ locale: "en" });

        // The `EXISTS` in the `WHERE` is what makes the paginator's `COUNT`
        // agree with the joined read.
        expect(pageInfo.totalCount).toBe(2);
      });

      it("omits a record with no published translation at all", async () => {
        const { row } = await localizedService().create({
          shared: {},
          translation: { body: "Body", title: "Draft Everywhere" },
        });
        await articlePublish(row.id);

        expect(
          (await publicService().findMany({ locale: "en" })).edges,
        ).toEqual([]);
      });

      it("filters on a localized field against the served translation", async () => {
        await seed({
          pl: { published: true, title: "Filtr" },
          title: "Filter",
        });

        const matched = await publicService().findMany({
          filters: { slug: "filtr" },
          locale: "pl",
        });
        const crossed = await publicService().findMany({
          filters: { slug: "filtr" },
          locale: "en",
        });

        expect(matched.edges.map(edge => edge.title)).toEqual(["Filtr"]);
        // The English read is served the English translation, whose slug is
        // `filter` - so a filter can never match a language nobody will see.
        expect(crossed.edges).toEqual([]);
      });

      it("searches a localized field against the served translation", async () => {
        await seed({
          pl: { published: true, title: "Wyszukiwanie" },
          title: "Searching",
        });

        const polish = await publicService().findMany({
          locale: "pl",
          query: { search: "Wyszuk" },
        });
        const english = await publicService().findMany({
          locale: "en",
          query: { search: "Wyszuk" },
        });

        expect(polish.edges).toHaveLength(1);
        expect(english.edges).toEqual([]);
      });

      it("filters on a shared field alongside a localized one", async () => {
        await seed({ featured: true, title: "Featured One" });
        await seed({ featured: false, title: "Plain One" });

        const { edges } = await publicService().findMany({
          filters: { featured: true },
          locale: "en",
        });

        expect(edges.map(edge => edge.title)).toEqual(["Featured One"]);
      });

      it("returns nothing at all for a locale the install does not serve", async () => {
        await seed({ title: "Unknown Locale" });

        // Not a throw, and not a substitution: the route turns this into the
        // same 404 a missing record gets.
        expect(await publicService().findMany({ locale: "fr" })).toMatchObject({
          edges: [],
        });
      });

      it("returns nothing for a locale the app has switched off", async () => {
        const itemId = await seed({ title: "Disabled Locale" });

        // `de` exists in `core_languages` and is `enabled: false` in the app
        // config: readable in the AdminCP, unreachable in public.
        expect(
          await publicService().findById(itemId, { locale: "de" }),
        ).toBeNull();
      });

      it("exposes only the allowlisted columns", async () => {
        const itemId = await seed({ title: "Allowlist" });

        const row = await publicService().findById(itemId, { locale: "en" });

        expect(Object.keys(row ?? {}).sort()).toEqual([
          "body",
          "featured",
          "locale",
          "publishedAt",
          "slug",
          "title",
        ]);
      });

      it("hides a language again when its translation is unpublished", async () => {
        const itemId = await seed({
          pl: { published: true, title: "Znika" },
          title: "Disappears",
        });

        await editorial().unpublish(itemId, "pl", { actor: ACTOR });

        // Back to the fallback, not to a 404: the record is still public in
        // English, and Polish has no translation of its own any more.
        expect(
          await publicService().findById(itemId, { locale: "pl" }),
        ).toMatchObject({ locale: "en" });
      });
    });

    /**
     * Per-locale search, against a real database.
     *
     * One document per published translation, and the interesting parts are all
     * in SQL: the keyset page over `(itemId, languageId)` and the two published
     * predicates the join carries. The search *engine* is stubbed for the same
     * reason it is in the base lifecycle test - `core_search_index` is a core
     * table this plugin's migrations do not create - so the assertions are about
     * the documents the engine is handed.
     */
    describe("localized search", () => {
      const editorial = (handle = context) => {
        const build = localizedArticleContent.translationEditorialService;
        if (!build)
          throw new Error("Expected a translation editorial service.");

        return build(handle, { pluginId: CONFIG_PLUGIN.pluginId });
      };

      /** The stubbed engine, and everything it was asked to write. */
      const engine = () => {
        const indexed: {
          languageCode?: string;
          title: string;
          url?: string;
        }[] = [];
        const deleted: { itemId: number; languageCode?: string }[] = [];

        const searchContext = {
          get: (key: string) => {
            if (key === "search") {
              return {
                delete: async (
                  _itemType: string,
                  itemId: number,
                  languageCode?: string,
                ) => {
                  deleted.push({ itemId, languageCode });
                  await Promise.resolve();
                },
                index: async (document: {
                  languageCode?: string;
                  title: string;
                  url?: string;
                }) => {
                  indexed.push(document);
                  await Promise.resolve();
                },
              };
            }
            if (key === "log") {
              return {
                debug: async () => await Promise.resolve(),
                error: async () => await Promise.resolve(),
                warn: async () => await Promise.resolve(),
              };
            }
            if (key === "core") return context.get("core");

            return db;
          },
        } as unknown as Context;

        return { deleted, indexed, searchContext };
      };

      const publishRecord = async (itemId: number) => {
        await sql`
          UPDATE "example_localized_articles"
          SET "status" = 'published', "publishedAt" = now()
          WHERE "id" = ${itemId}
        `;
      };

      /** A published record with English published and Polish optional. */
      const seed = async ({
        pl,
        title,
      }: {
        pl?: { published: boolean; title: string };
        title: string;
      }) => {
        const { row } = await localizedService().create({
          shared: {},
          translation: { body: `Body of ${title}`, title },
        });
        await publishRecord(row.id);
        await editorial().publish(row.id, "en", { actor: ACTOR });

        if (pl) {
          await translations().create(row.id, "pl", {
            body: `Tresc ${pl.title}`,
            title: pl.title,
          });
          if (pl.published) {
            await editorial().publish(row.id, "pl", { actor: ACTOR });
          }
        }

        return row.id;
      };

      /** Runs the whole rebuild, two translation rows per page. */
      const rebuild = async (searchContext: Context) => {
        const indexer = createContentLocalizedSearchIndexer(
          localizedArticleContent,
          { pluginId: CONFIG_PLUGIN.pluginId },
        );

        let offset = 0;
        for (;;) {
          const page = await indexer.load(searchContext, offset, 2);
          for (const document of page.documents) {
            await searchContext.get("search").index(document);
          }
          if (page.itemsRead === 0) break;
          offset += page.itemsRead;
        }

        return indexer;
      };

      it("indexes one document per published translation", async () => {
        await seed({
          pl: { published: true, title: "Szukaj" },
          title: "Search",
        });
        const { indexed, searchContext } = engine();

        await rebuild(searchContext);

        expect(
          indexed.map(document => [document.languageCode, document.title]),
        ).toEqual([
          ["en", "Search"],
          ["pl", "Szukaj"],
        ]);
      });

      it("gives each language its own URL", async () => {
        await seed({
          pl: { published: true, title: "Adres" },
          title: "Address",
        });
        const { indexed, searchContext } = engine();

        await rebuild(searchContext);

        // Two languages routinely answer to the same slug, so a template without
        // `{locale}` would give both documents the same link.
        expect(indexed.map(document => document.url)).toEqual([
          "/en/localized-articles/address",
          "/pl/localized-articles/adres",
        ]);
      });

      it("leaves a draft translation out", async () => {
        await seed({
          pl: { published: false, title: "Szkic" },
          title: "Draft PL",
        });
        const { indexed, searchContext } = engine();

        await rebuild(searchContext);

        expect(indexed.map(document => document.languageCode)).toEqual(["en"]);
      });

      it("indexes nothing at all while the record is a draft", async () => {
        const { row } = await localizedService().create({
          shared: {},
          translation: { body: "Body", title: "Unpublished" },
        });
        await editorial().publish(row.id, "en", { actor: ACTOR });
        const { indexed, searchContext } = engine();

        await rebuild(searchContext);

        // Subordination: a published translation of a draft record is not public,
        // so it is not indexed either.
        expect(indexed).toEqual([]);
      });

      it("pages over translations without skipping or repeating one", async () => {
        // Three records with two languages each is six rows, read two at a time -
        // so the keyset cursor is exercised across a record boundary.
        for (const title of ["Page One", "Page Two", "Page Three"]) {
          await seed({ pl: { published: true, title: `${title} PL` }, title });
        }
        const { indexed, searchContext } = engine();

        await rebuild(searchContext);

        expect(indexed).toHaveLength(6);
        expect(new Set(indexed.map(document => document.title)).size).toBe(6);
      });

      it("counts published translations, not records", async () => {
        await seed({ pl: { published: true, title: "Licz" }, title: "Count" });
        const { searchContext } = engine();
        const indexer = await rebuild(searchContext);

        // The coverage bar compares this against the document count, so counting
        // records would pin a fully-indexed two-language collection at 50%.
        expect(await indexer.count?.(searchContext)).toBe(2);
      });

      it("takes one language out when its translation is unpublished", async () => {
        const itemId = await seed({
          pl: { published: true, title: "Wycofane" },
          title: "Withdrawn",
        });
        const { deleted, indexed, searchContext } = engine();

        const outcome = await editorial().unpublish(itemId, "pl", {
          actor: ACTOR,
        });
        if (!outcome) throw new Error("Expected an outcome.");

        const base = await localizedArticleContent
          .service(context)
          .findById(itemId);

        await syncContentLocalizedSearch(
          searchContext,
          localizedArticleContent,
          {
            changed: outcome.changed,
            locale: "pl",
            operation: "unpublish",
            pluginId: CONFIG_PLUGIN.pluginId,
            row: base as object,
          },
        );

        // Scoped to Polish. The English document is not rewritten and not
        // removed - it was not part of what moved.
        expect(deleted).toEqual([{ itemId, languageCode: "pl" }]);
        expect(indexed).toEqual([]);
      });

      it("removes every language when the record itself is unpublished", async () => {
        const itemId = await seed({
          pl: { published: true, title: "Wszystkie" },
          title: "All",
        });
        const { deleted, searchContext } = engine();

        const result = await localizedArticleContent
          .service(context)
          .unpublish(itemId);
        if (!result) throw new Error("Expected a transition.");

        await syncContentLocalizedSearch(
          searchContext,
          localizedArticleContent,
          {
            changed: result.changed,
            operation: "unpublish",
            pluginId: CONFIG_PLUGIN.pluginId,
            row: result.row,
          },
        );

        // Every language at once: the record's publication state gates them all.
        expect(deleted).toEqual([
          { itemId, languageCode: "en" },
          { itemId, languageCode: "pl" },
        ]);
      });

      it("re-indexes only the language a translation edit touched", async () => {
        const itemId = await seed({
          pl: { published: true, title: "Edytowane" },
          title: "Edited",
        });
        const { indexed, searchContext } = engine();

        const outcome = await editorial().update(
          itemId,
          "pl",
          { title: "Edytowane Ponownie" },
          { actor: ACTOR, expectedVersion: 2 },
        );
        if (!outcome) throw new Error("Expected an outcome.");

        const base = await localizedArticleContent
          .service(context)
          .findById(itemId);

        await syncContentLocalizedSearch(
          searchContext,
          localizedArticleContent,
          {
            changedFields: outcome.changedFields,
            locale: "pl",
            operation: "update",
            pluginId: CONFIG_PLUGIN.pluginId,
            row: base as object,
          },
        );

        expect(indexed).toEqual([
          expect.objectContaining({
            languageCode: "pl",
            title: "Edytowane Ponownie",
          }),
        ]);
      });

      it("removes only the deleted translation's document", async () => {
        // The blocker this pair guards: a delete cannot enumerate translations
        // (the row it would read is gone), so it has to read the locale off the
        // input instead. Reading nothing meant deleting every language, and the
        // English document would disappear because somebody removed the Polish
        // copy.
        const itemId = await seed({
          pl: { published: true, title: "Do Usuniecia" },
          title: "Keep English",
        });
        const { deleted, indexed, searchContext } = engine();

        const outcome = await editorial().delete(itemId, "pl", {
          actor: ACTOR,
          expectedVersion: 2,
        });
        if (!outcome) throw new Error("Expected an outcome.");

        const base = await localizedArticleContent
          .service(context)
          .findById(itemId);

        await syncContentLocalizedSearch(
          searchContext,
          localizedArticleContent,
          {
            locale: outcome.locale,
            operation: "delete",
            pluginId: CONFIG_PLUGIN.pluginId,
            row: base as object,
          },
        );

        expect(deleted).toEqual([{ itemId, languageCode: "pl" }]);
        expect(indexed).toEqual([]);

        // And the English translation really is still there to be indexed, so
        // the next rebuild puts its document back exactly where it was.
        const rebuilt = engine();
        await rebuild(rebuilt.searchContext);
        expect(rebuilt.indexed.map(document => document.languageCode)).toEqual([
          "en",
        ]);
      });

      it("removes every language when the record is deleted", async () => {
        const itemId = await seed({
          pl: { published: true, title: "Cala Usunieta" },
          title: "Delete Whole",
        });
        const { deleted, searchContext } = engine();

        const removed = await localizedArticleContent
          .service(context)
          .delete(itemId);
        if (!removed) throw new Error("Expected a deleted row.");

        await syncContentLocalizedSearch(
          searchContext,
          localizedArticleContent,
          {
            operation: "delete",
            pluginId: CONFIG_PLUGIN.pluginId,
            row: removed,
          },
        );

        // One call with no language: every `(itemType, itemId, *)` document
        // goes, which is what deleting the record means - and there is nothing
        // left to enumerate them from anyway.
        expect(deleted).toEqual([{ itemId, languageCode: undefined }]);
      });
    });

    /** Which languages a record is publicly reachable in, evaluated in SQL. */
    describe("public locale states", () => {
      const editorial = (handle = context) => {
        const build = localizedArticleContent.translationEditorialService;
        if (!build)
          throw new Error("Expected a translation editorial service.");

        return build(handle, { pluginId: CONFIG_PLUGIN.pluginId });
      };

      it("reports the fallback consumers as public but not their own", async () => {
        const { row } = await localizedService().create({
          shared: {},
          translation: { body: "Body", title: "Locale States" },
        });
        await sql`
          UPDATE "example_localized_articles"
          SET "status" = 'published', "publishedAt" = now()
          WHERE "id" = ${row.id}
        `;
        await editorial().publish(row.id, "en", { actor: ACTOR });

        const states = await contentPublicLocaleStates(
          context,
          localizedArticleContent,
          row.id,
        );

        // `de` is disabled in this app's config, so it is not reported at all.
        expect(states).toEqual([
          {
            hasOwnTranslation: true,
            isPublic: true,
            locale: "en",
            slug: "locale-states",
          },
          {
            hasOwnTranslation: false,
            isPublic: true,
            locale: "pl",
            slug: "locale-states",
          },
        ]);
      });
    });
  });
});
