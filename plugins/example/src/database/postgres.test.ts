import type { ContentSearchOperation } from "@vitnode/core/content/server";
import type { Context } from "hono";

import { executeContentSchedule } from "@vitnode/core/api/modules/content/helpers/execute-content-schedule";
import { ContentVersionConflict } from "@vitnode/core/content";
import {
  claimContentSchedule,
  createContentSearchIndexer,
  settleContentSchedule,
  syncContentSearch,
} from "@vitnode/core/content/server";
import { core_queue } from "@vitnode/core/database/queue";
import { drizzle } from "drizzle-orm/postgres-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CONFIG_PLUGIN, EXAMPLE_MIGRATIONS } from "@/const";
import { articleContentType } from "@/content/article";

import { articleContent } from "./articles";
import { categoryContent } from "./categories";

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
              ],
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
});
