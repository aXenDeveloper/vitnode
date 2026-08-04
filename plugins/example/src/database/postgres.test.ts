import type { Context } from "hono";

import { drizzle } from "drizzle-orm/postgres-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { EXAMPLE_MIGRATIONS } from "@/const";

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
 * exactly. Two rows sharing it are the case that used to overflow: the base was
 * already 160 characters and the duplicate pass appended `-<id>` on top.
 */
const LONG_TITLE = "Lorem ipsum dolor sit amet ".repeat(7).slice(0, 200);

/**
 * Rows the slug backfill has to cope with, inserted *between* `0023` and the
 * slug migration so the committed SQL runs against real data rather than an
 * empty table.
 */
const BACKFILL_ROWS = [
  { code: "mig-1", title: "Same Title" },
  { code: "mig-2", title: "Same Title" },
  { code: "mig-3", title: LONG_TITLE },
  { code: "mig-4", title: LONG_TITLE },
  { code: "mig-5", title: "日本語のタイトル" },
  { code: "mig-6", title: "Only One Of These" },
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

let sql: ReturnType<typeof postgres>;
let context: Context;
let serverMajor = 0;

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
        INSERT INTO "example_articles" ("category", "code", "title")
        VALUES (${seedCategory.id}, ${row.code}, ${row.title})
      `;
    }

    await run(EXAMPLE_MIGRATIONS.slice(slugMigrationAt));

    backfilled = await sql<BackfilledRow[]>`
      SELECT "id", "code", "slug" FROM "example_articles" ORDER BY "id"
    `;

    // Out of the way, so every other test starts against an empty table.
    await sql`DELETE FROM "example_articles"`;
    await sql`DELETE FROM "example_categories"`;

    context = {
      get: (key: string) =>
        key === "db" ? drizzle(sql, { casing: "camelCase" }) : undefined,
    } as unknown as Context;
  }, 60_000);

  afterAll(async () => {
    await sql?.end();
  });

  describe("the slug backfill", () => {
    it("gave every existing row a slug", () => {
      expect(backfilled).toHaveLength(BACKFILL_ROWS.length);
      expect(backfilled.every(row => typeof row.slug === "string")).toBe(true);
      expect(backfilled.every(row => row.slug.length > 0)).toBe(true);
    });

    it("kept every slug inside varchar(160)", () => {
      // The column would have rejected anything longer, so this is really a
      // statement about the two rows whose base slug was already 160 characters
      // before the duplicate pass appended their id.
      expect(
        Math.max(...backfilled.map(row => row.slug.length)),
      ).toBeLessThanOrEqual(160);
    });

    it("made every slug unique", () => {
      const slugs = backfilled.map(row => row.slug);

      expect(new Set(slugs).size).toBe(slugs.length);
    });

    it("separates two rows with the same ordinary title", () => {
      const first = backfilledBy("mig-1");
      const second = backfilledBy("mig-2");

      expect(first.slug).toBe(`same-title-${first.id}`);
      expect(second.slug).toBe(`same-title-${second.id}`);
    });

    it("separates two rows whose title fills the whole column", () => {
      const first = backfilledBy("mig-3");
      const second = backfilledBy("mig-4");

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
      // nothing behind. The id is deterministic, and the row keeps its title.
      const row = backfilledBy("mig-5");

      expect(row.slug).toBe(String(row.id));
    });

    it("leaves an unambiguous title alone", () => {
      expect(backfilledBy("mig-6").slug).toBe("only-one-of-these");
    });

    it("never leaves a leading or trailing dash", () => {
      expect(backfilled.every(row => !/^-|-$/.test(row.slug))).toBe(true);
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
