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
const migrationSql = EXAMPLE_MIGRATIONS.map(file =>
  readFileSync(resolve(here, "../../../../apps/docs/migrations", file), "utf8"),
).join("\n--> statement-breakpoint\n");

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

    for (const statement of migrationSql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await sql.unsafe(trimmed);
    }

    context = {
      get: (key: string) =>
        key === "db" ? drizzle(sql, { casing: "camelCase" }) : undefined,
    } as unknown as Context;
  }, 60_000);

  afterAll(async () => {
    await sql?.end();
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

  it("rejects invalid input before it reaches Postgres", async () => {
    await expect(
      articleContent
        .service(context)
        .create({ category: 1, code: "x", title: "no" }),
    ).rejects.toThrow();
  });
});
