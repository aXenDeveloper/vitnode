import type { Context } from "hono";

import { drizzle } from "drizzle-orm/postgres-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

/** The committed migration - the exact DDL a fresh database would run. */
const migrationSql = readFileSync(
  resolve(
    here,
    "../../../../apps/docs/migrations/0022_add_example_content.sql",
  ),
  "utf8",
);

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
      publishedAt: "2026-08-02T10:00:00.000Z",
      title: "Getting started",
    });

    // Declared defaults reach the row exactly once, from the create schema.
    expect(article).toMatchObject({
      featured: false,
      status: "draft",
      views: 0,
    });
    expect(article.publishedAt).toBeInstanceOf(Date);

    await expect(articles.findById(article.id)).resolves.toMatchObject({
      code: "guide-001",
      title: "Getting started",
    });

    const { edges, pageInfo } = await articles.findMany();
    expect(pageInfo.totalCount).toBe(1);
    // One LEFT JOIN per reference resolved both display labels.
    expect(edges[0].labels).toEqual({ author: "Ada", category: "Guides" });

    const updated = await articles.update(article.id, {
      status: "published",
      title: "Getting started, properly",
    });
    expect([...(updated?.changedFields ?? [])].sort()).toEqual([
      "status",
      "title",
    ]);
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

    // `onDelete: "restrict"` is what a 409 upstream is actually made of.
    await expect(
      pgErrorCode(async () => categories.delete(category.id)),
    ).resolves.toBe("23503");

    // `onDelete: "set null"` on a nullable user field keeps the article.
    await sql`DELETE FROM "core_users" WHERE "id" = ${user.id}`;
    await expect(articles.findById(article.id)).resolves.toMatchObject({
      author: null,
    });

    await expect(articles.delete(article.id)).resolves.toMatchObject({
      id: article.id,
    });
    await expect(categories.delete(category.id)).resolves.toMatchObject({
      id: category.id,
    });
    await expect(articles.findById(article.id)).resolves.toBeNull();
  }, 60_000);

  it("rejects invalid input before it reaches Postgres", async () => {
    await expect(
      articleContent
        .service(context)
        .create({ category: 1, code: "x", title: "no" }),
    ).rejects.toThrow();
  });
});
