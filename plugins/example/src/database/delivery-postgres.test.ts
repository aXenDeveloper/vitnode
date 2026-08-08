import type { SearchDocument } from "@vitnode/core/api/models/search";
import type { ContentDeliverySitemapPage } from "@vitnode/core/content/server";
import type { Context } from "hono";

import {
  ContentDeliverySlugReserved,
  ContentVersionConflict,
} from "@vitnode/core/content";
import {
  contentDeliveryEffects,
  contentEditorialEffects,
  contentTranslationEffects,
} from "@vitnode/core/content/server";
import { drizzle } from "drizzle-orm/postgres-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CONFIG_PLUGIN, EXAMPLE_MIGRATIONS } from "@/const";

import { advancedArticleContent } from "./advanced-articles";
import { articleContent } from "./articles";
import { categoryContent } from "./categories";

/**
 * Stage 8 against real Postgres.
 *
 * Everything here is about what the *database* enforces and what the resolver
 * actually answers, neither of which a mock can show:
 *
 * - a historical URL is **reserved** by two partial unique indexes, so an unrelated
 *   record cannot inherit somebody's incoming links;
 * - a redirect chain collapses because the resolver reads the record's current slug
 *   rather than the next entry in the chain;
 * - a slug change and its reservation are **one transaction**, so a writer that
 *   loses the version race leaves the history exactly as it found it;
 * - each locale's history is its own, because `languageId` is part of the key.
 *
 * Runs only with `DATABASE_TEST_URL` set, and **wipes** the database it points at -
 * so the URL has to name one with "test" in it:
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

const migrationSql = (files: readonly string[]): string =>
  files
    .map(file =>
      readFileSync(
        resolve(here, "../../../../apps/docs/migrations", file),
        "utf8",
      ),
    )
    .join("\n--> statement-breakpoint\n");

const CORE_STUBS = `
  CREATE TABLE "core_users" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar(255) NOT NULL
  );
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
  CREATE TABLE "core_languages" (
    "id" serial PRIMARY KEY NOT NULL,
    "code" varchar(32) NOT NULL,
    "name" varchar(255) NOT NULL,
    "default" boolean DEFAULT false NOT NULL,
    "protected" boolean DEFAULT false NOT NULL,
    CONSTRAINT "core_languages_code_unique" UNIQUE("code")
  );
`;

const ACTOR = { type: "staff" as const, userId: null };
const PLUGIN = CONFIG_PLUGIN.pluginId;

let sql: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle>;
let context: Context;
/** A second connection, for the tests that need two writers at once. */
let rival: ReturnType<typeof postgres>;
let rivalContext: Context;
let categoryId = 0;

const emitted: { name: string; payload: Record<string, unknown> }[] = [];
const indexed: SearchDocument[] = [];

const pgErrorCode = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause;

    return cause?.code ?? (error as { code?: string }).code;
  }

  return undefined;
};

// ---------------------------------------------------------------------------
// Nonlocalized fixture: `example.article`
// ---------------------------------------------------------------------------

const editorial = (target: Context = context) =>
  articleContent.editorialService?.(target, { pluginId: PLUGIN });

const delivery = (target: Context = context) =>
  articleContent.deliveryService?.(target, { pluginId: PLUGIN });

/**
 * A monotonic counter for the `unique: true` `code` field.
 *
 * `Date.now()` is not enough: several articles are created inside one millisecond by
 * the tests below, and a duplicate `code` would surface as a `23505` from an
 * unrelated constraint.
 */
let nextCode = 0;

const createArticle = async (
  values: Record<string, unknown> = {},
): Promise<{ id: number; version: number }> => {
  nextCode += 1;

  const outcome = await editorial()?.create(
    {
      category: categoryId,
      code: `code-${nextCode}`,
      title: "Hello world",
      ...values,
    },
    { actor: ACTOR },
  );
  if (!outcome) throw new Error("create returned nothing");

  return { id: outcome.row.id, version: outcome.version };
};

/** Creates, publishes, and hands back the version to write against next. */
const publishArticle = async (
  values: Record<string, unknown> = {},
): Promise<{ id: number; version: number }> => {
  const created = await createArticle(values);
  const published = await editorial()?.publish(created.id, { actor: ACTOR });
  if (!published) throw new Error("publish returned nothing");

  return { id: created.id, version: published.version };
};

/**
 * One record's addresses, as plain objects.
 *
 * `postgres.js` hands back a `Result` array subclass whose prototype is not
 * `Array.prototype`, which `toStrictEqual` compares - so every raw read in this file
 * is normalised rather than asserted directly.
 */
const historyRows = async (
  itemId: number,
): Promise<{ path: string; retired: boolean; slug: string }[]> => {
  const rows = await sql<
    { path: string; retiredAt: null | string; slug: string }[]
  >`
    SELECT "slug", "path", "retiredAt"
    FROM "core_content_slug_history"
    WHERE "contentTypeId" = 'example.article' AND "itemId" = ${itemId}
    ORDER BY "id"
  `;

  return rows.map(row => ({
    path: row.path,
    retired: row.retiredAt !== null,
    slug: row.slug,
  }));
};

// ---------------------------------------------------------------------------
// Localized fixture: `example.advanced-article`
// ---------------------------------------------------------------------------

const localizedService = () =>
  advancedArticleContent.localizedService?.(context, { pluginId: PLUGIN });

const translationEditorial = (target: Context = context) =>
  advancedArticleContent.translationEditorialService?.(target, {
    pluginId: PLUGIN,
  });

const advancedEditorial = () =>
  advancedArticleContent.editorialService?.(context, { pluginId: PLUGIN });

const advancedDelivery = () =>
  advancedArticleContent.deliveryService?.(context, { pluginId: PLUGIN });

/**
 * A localized article, published in `en` and optionally in `pl`.
 *
 * Both halves are published on purpose: a translation is only publicly reachable
 * when the record is too, which is the subordination the delivery layer reads.
 */
const publishLocalized = async ({
  pl,
  title = "Hello world",
}: { pl?: string; title?: string } = {}) => {
  const localized = localizedService();
  if (!localized) throw new Error("no localized service");

  const created = await localized.create({
    shared: {},
    translation: { title },
  });

  const base = await advancedEditorial()?.publish(created.row.id, {
    actor: ACTOR,
  });
  if (!base) throw new Error("base publish returned nothing");

  const en = await translationEditorial()?.publish(created.row.id, "en", {
    actor: ACTOR,
  });
  if (!en) throw new Error("en publish returned nothing");

  if (pl !== undefined) {
    await translationEditorial()?.create(
      created.row.id,
      "pl",
      { title: pl },
      { actor: ACTOR },
    );
    await translationEditorial()?.publish(created.row.id, "pl", {
      actor: ACTOR,
    });
  }

  return { enVersion: en.version, id: created.row.id };
};

const localizedHistory = async (
  itemId: number,
): Promise<
  { languageId: null | number; path: string; retired: boolean; slug: string }[]
> => {
  const rows = await sql<
    {
      languageId: null | number;
      path: string;
      retiredAt: null | string;
      slug: string;
    }[]
  >`
    SELECT "slug", "path", "retiredAt", "languageId"
    FROM "core_content_slug_history"
    WHERE "contentTypeId" = 'example.advanced-article' AND "itemId" = ${itemId}
    ORDER BY "id"
  `;

  return rows.map(row => ({
    languageId: row.languageId,
    path: row.path,
    retired: row.retiredAt !== null,
    slug: row.slug,
  }));
};

const localeIds: Record<string, number> = {};

describe.skipIf(!url)("Stage 8 content delivery against Postgres", () => {
  beforeAll(async () => {
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
    await sql.unsafe(CORE_STUBS);
    const languages = await sql<{ code: string; id: number }[]>`
      INSERT INTO "core_languages" ("code", "name", "default") VALUES
        ('en', 'English', true),
        ('pl', 'Polski', false)
      RETURNING "id", "code"
    `;
    for (const language of languages) localeIds[language.code] = language.id;

    for (const statement of migrationSql(EXAMPLE_MIGRATIONS).split(
      "--> statement-breakpoint",
    )) {
      const trimmed = statement.trim();
      if (trimmed) await sql.unsafe(trimmed);
    }

    db = drizzle(sql, { casing: "camelCase" });
    rival = postgres(url ?? "", { max: 1, onnotice: () => undefined });

    const buildContext = (handle: ReturnType<typeof drizzle>) =>
      ({
        get: (key: string) => {
          if (key === "db") return handle;
          if (key === "search") {
            return {
              delete: async () => await Promise.resolve(),
              index: async (document: SearchDocument) => {
                indexed.push(document);

                return await Promise.resolve();
              },
            };
          }
          if (key === "events") {
            return {
              emit: async (name: string, payload: Record<string, unknown>) => {
                emitted.push({ name, payload });

                return await Promise.resolve({ failures: [] });
              },
            };
          }
          if (key === "log")
            return { error: async () => await Promise.resolve() };
          if (key === "core") {
            return {
              contentModels: [
                { model: advancedArticleContent, pluginId: PLUGIN },
                { model: articleContent, pluginId: PLUGIN },
                { model: categoryContent, pluginId: PLUGIN },
              ],
              i18n: {
                locales: [
                  { code: "en", name: "English" },
                  { code: "pl", name: "Polski" },
                ],
              },
            };
          }

          return undefined;
        },
      }) as unknown as Context;

    context = buildContext(db);
    rivalContext = buildContext(drizzle(rival, { casing: "camelCase" }));
  }, 60_000);

  afterAll(async () => {
    await sql?.end();
    await rival?.end();
  });

  beforeEach(async () => {
    await sql`DELETE FROM "example_articles"`;
    await sql`DELETE FROM "example_advanced_articles"`;
    await sql`DELETE FROM "core_content_slug_history"`;
    await sql`DELETE FROM "core_content_revisions"`;
    await sql`DELETE FROM "example_categories"`;

    const [category] = await sql<{ id: number }[]>`
      INSERT INTO "example_categories" ("name") VALUES ('News') RETURNING "id"
    `;
    categoryId = category.id;
    emitted.length = 0;
    indexed.length = 0;
  });

  // -------------------------------------------------------------------------
  // The table itself
  // -------------------------------------------------------------------------

  describe("the reservation constraints", () => {
    it("refuses two shared rows for the same address", async () => {
      await sql`
        INSERT INTO "core_content_slug_history"
          ("pluginId", "contentTypeId", "itemId", "slug", "path")
        VALUES (${PLUGIN}, 'example.article', 1, 'hello', '/articles/hello')
      `;

      const code = await pgErrorCode(
        async () =>
          await sql`
            INSERT INTO "core_content_slug_history"
              ("pluginId", "contentTypeId", "itemId", "slug", "path")
            VALUES (${PLUGIN}, 'example.article', 2, 'hello', '/articles/hello')
          `,
      );

      // The partial unique index over `(contentTypeId, slug) WHERE languageId IS
      // NULL` is what makes a retired URL a reservation rather than only a log.
      expect(code).toBe("23505");
    });

    it("allows the same address in two different locales", async () => {
      await sql`
        INSERT INTO "core_content_slug_history"
          ("pluginId", "contentTypeId", "itemId", "languageId", "slug", "path")
        VALUES
          (${PLUGIN}, 'example.advanced-article', 1, ${localeIds.en}, 'shared', '/en/advanced-articles/shared'),
          (${PLUGIN}, 'example.advanced-article', 2, ${localeIds.pl}, 'shared', '/pl/advanced-articles/shared')
      `;

      const [row] = await sql<{ count: number }[]>`
        SELECT count(*)::int AS count FROM "core_content_slug_history"
      `;

      // Locale-scoped uniqueness: `/en/x/shared` and `/pl/x/shared` are two URLs.
      expect(row.count).toBe(2);
    });

    it("refuses two rows for the same address in one locale", async () => {
      await sql`
        INSERT INTO "core_content_slug_history"
          ("pluginId", "contentTypeId", "itemId", "languageId", "slug", "path")
        VALUES (${PLUGIN}, 'example.advanced-article', 1, ${localeIds.en}, 'hello', '/en/advanced-articles/hello')
      `;

      const code = await pgErrorCode(
        async () =>
          await sql`
            INSERT INTO "core_content_slug_history"
              ("pluginId", "contentTypeId", "itemId", "languageId", "slug", "path")
            VALUES (${PLUGIN}, 'example.advanced-article', 2, ${localeIds.en}, 'hello', '/en/advanced-articles/hello')
          `,
      );

      expect(code).toBe("23505");
    });

    it("keeps two content types' histories apart", async () => {
      await sql`
        INSERT INTO "core_content_slug_history"
          ("pluginId", "contentTypeId", "itemId", "slug", "path")
        VALUES
          (${PLUGIN}, 'example.article', 1, 'hello', '/articles/hello'),
          (${PLUGIN}, 'other.thing', 1, 'hello', '/things/hello')
      `;

      const [row] = await sql<{ count: number }[]>`
        SELECT count(*)::int AS count FROM "core_content_slug_history"
      `;

      expect(row.count).toBe(2);
    });

    it("indexes the resolver's lookup", async () => {
      // The redirect lookup is on a public request path for a URL that is very
      // often a typo, so it has to be an index hit rather than a scan.
      const rows = await sql<{ indexdef: string; indexname: string }[]>`
        SELECT indexname, indexdef FROM pg_indexes
        WHERE tablename = 'core_content_slug_history'
      `;
      const names = rows.map(row => row.indexname);

      expect(names).toContain("core_content_slug_history_shared_unique");
      expect(names).toContain("core_content_slug_history_locale_unique");
      expect(names).toContain("core_content_slug_history_item_idx");

      const shared = rows.find(
        row => row.indexname === "core_content_slug_history_shared_unique",
      );
      expect(shared?.indexdef).toContain("UNIQUE");
      expect(shared?.indexdef).toMatch(/"?languageId"? IS NULL/);
    });
  });

  // -------------------------------------------------------------------------
  // The redirect lifecycle
  // -------------------------------------------------------------------------

  describe("the redirect lifecycle", () => {
    it("records nothing while the record is still a draft", async () => {
      const article = await createArticle({ title: "Draft article" });

      await editorial()?.update(
        article.id,
        { slug: "corrected" },
        { actor: ACTOR, expectedVersion: article.version },
      );

      // A draft has no public URL, so neither the original nor the corrected slug
      // was ever addressable - and neither is reserved.
      expect(await historyRows(article.id)).toStrictEqual([]);
    });

    it("reserves the current address on publication", async () => {
      const article = await publishArticle({ title: "Hello world" });

      const rows = await historyRows(article.id);

      expect(rows).toStrictEqual([
        {
          path: "/articles/hello-world",
          retired: false,
          slug: "hello-world",
        },
      ]);
    });

    it("resolves the current slug as canonical content", async () => {
      const article = await publishArticle({ title: "Hello world" });

      expect(await delivery()?.resolveSlug("hello-world")).toMatchObject({
        canonicalPath: "/articles/hello-world",
        // `example.article` does not expose `id`, so delivery reports none rather
        // than publishing a column the public API withheld.
        itemId: null,
        type: "content",
      });
      expect(article.id).toBeGreaterThan(0);
    });

    it("redirects the old address after a slug change", async () => {
      const article = await publishArticle({ title: "Hello world" });

      await editorial()?.update(
        article.id,
        { slug: "hello-there" },
        { actor: ACTOR, expectedVersion: article.version },
      );

      expect(await delivery()?.resolveSlug("hello-world")).toStrictEqual({
        location: "/articles/hello-there",
        status: 308,
        type: "redirect",
      });
      expect(await delivery()?.resolveSlug("hello-there")).toMatchObject({
        canonicalPath: "/articles/hello-there",
        type: "content",
      });
    });

    it("collapses a chain: A and B both resolve straight to C", async () => {
      const article = await publishArticle({ title: "Slug a" });

      const toB = await editorial()?.update(
        article.id,
        { slug: "slug-b" },
        { actor: ACTOR, expectedVersion: article.version },
      );
      await editorial()?.update(
        article.id,
        { slug: "slug-c" },
        { actor: ACTOR, expectedVersion: toB?.version ?? 0 },
      );

      // One hop each, never A -> B -> C.
      for (const retired of ["slug-a", "slug-b"]) {
        expect(await delivery()?.resolveSlug(retired)).toStrictEqual({
          location: "/articles/slug-c",
          status: 308,
          type: "redirect",
        });
      }
      expect(await delivery()?.resolveSlug("slug-c")).toMatchObject({
        type: "content",
      });
    });

    it("keeps three rows: two retired and one current", async () => {
      const article = await publishArticle({ title: "Slug a" });
      const toB = await editorial()?.update(
        article.id,
        { slug: "slug-b" },
        { actor: ACTOR, expectedVersion: article.version },
      );
      await editorial()?.update(
        article.id,
        { slug: "slug-c" },
        { actor: ACTOR, expectedVersion: toB?.version ?? 0 },
      );

      const rows = await historyRows(article.id);

      expect(rows.map(row => row.slug)).toStrictEqual([
        "slug-a",
        "slug-b",
        "slug-c",
      ]);
      expect(rows.map(row => row.retired)).toStrictEqual([true, true, false]);
      // The database keeps the chronology; the resolver is what collapses it.
      expect(rows[0].path).toBe("/articles/slug-a");
    });

    it("stops redirecting while the record is unpublished, and starts again", async () => {
      const article = await publishArticle({ title: "Slug a" });
      const moved = await editorial()?.update(
        article.id,
        { slug: "slug-b" },
        { actor: ACTOR, expectedVersion: article.version },
      );

      const unpublished = await editorial()?.unpublish(article.id, {
        actor: ACTOR,
      });

      expect(await delivery()?.resolveSlug("slug-a")).toStrictEqual({
        type: "not_found",
      });
      expect(await delivery()?.resolveSlug("slug-b")).toStrictEqual({
        type: "not_found",
      });
      // The history survives - it is what makes the redirect come back.
      expect((await historyRows(article.id)).length).toBe(2);

      await editorial()?.publish(article.id, {
        actor: ACTOR,
        expectedVersion: unpublished?.version,
      });

      expect(await delivery()?.resolveSlug("slug-a")).toStrictEqual({
        location: "/articles/slug-b",
        status: 308,
        type: "redirect",
      });
      expect(moved?.delivery?.redirectCreated).toBe(true);
    });

    it("keeps the history but resolves nothing after a delete", async () => {
      const article = await publishArticle({ title: "Slug a" });
      const moved = await editorial()?.update(
        article.id,
        { slug: "slug-b" },
        { actor: ACTOR, expectedVersion: article.version },
      );

      await editorial()?.delete(article.id, {
        actor: ACTOR,
        expectedVersion: moved?.version ?? 0,
      });

      // Retained for audit, and never a redirect to content that is gone.
      expect((await historyRows(article.id)).length).toBe(2);
      expect(await delivery()?.resolveSlug("slug-a")).toStrictEqual({
        type: "not_found",
      });
      expect(await delivery()?.resolveSlug("slug-b")).toStrictEqual({
        type: "not_found",
      });
    });

    it("brings a slug back into service when it is restored", async () => {
      const article = await publishArticle({ title: "Original name" });
      const [original] =
        (await editorial()?.revisions.list(article.id))?.edges ?? [];

      const moved = await editorial()?.update(
        article.id,
        { slug: "new-name" },
        { actor: ACTOR, expectedVersion: article.version },
      );

      const restored = await editorial()?.restore(article.id, original.id, {
        actor: ACTOR,
        expectedVersion: moved?.version ?? 0,
      });

      expect(restored?.delivery).toMatchObject({
        canonicalPath: "/articles/original-name",
        previousPath: "/articles/new-name",
        redirectCreated: true,
        slugChanged: true,
      });

      // The two addresses have swapped roles: `new-name` now redirects to the
      // restored `original-name`.
      expect(await delivery()?.resolveSlug("new-name")).toStrictEqual({
        location: "/articles/original-name",
        status: 308,
        type: "redirect",
      });
      expect(await delivery()?.resolveSlug("original-name")).toMatchObject({
        type: "content",
      });
    });

    it("writes no history for a restore that moves no slug", async () => {
      const article = await publishArticle({ title: "Stable" });
      const [first] =
        (await editorial()?.revisions.list(article.id))?.edges ?? [];

      const edited = await editorial()?.update(
        article.id,
        { excerpt: "Changed prose" },
        { actor: ACTOR, expectedVersion: article.version },
      );

      const restored = await editorial()?.restore(article.id, first.id, {
        actor: ACTOR,
        expectedVersion: edited?.version ?? 0,
      });

      expect(restored?.delivery?.slugChanged).toBe(false);
      expect(
        (await historyRows(article.id)).map(row => row.slug),
      ).toStrictEqual(["stable"]);
    });
  });

  // -------------------------------------------------------------------------
  // Reservations
  // -------------------------------------------------------------------------

  describe("slug reservations", () => {
    it("refuses an address another record retired", async () => {
      const first = await publishArticle({ title: "Hello" });
      await editorial()?.update(
        first.id,
        { slug: "hello-world" },
        { actor: ACTOR, expectedVersion: first.version },
      );

      // `hello` is free on the content table now - the first article moved off it -
      // so the reservation is the only thing standing between the second article
      // and somebody else's incoming links.
      await expect(
        createArticle({ slug: "hello", title: "Second" }),
      ).rejects.toThrow(ContentDeliverySlugReserved);
    });

    it("names the address in the structured error", async () => {
      const first = await publishArticle({ title: "Hello" });
      await editorial()?.update(
        first.id,
        { slug: "hello-world" },
        { actor: ACTOR, expectedVersion: first.version },
      );

      const error = await createArticle({
        slug: "hello",
        title: "Second",
      }).catch((thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(ContentDeliverySlugReserved);
      expect(error).toMatchObject({ locale: null, slug: "hello" });
    });

    it("lets a record take its own retired address back", async () => {
      const article = await publishArticle({ title: "Slug a" });
      const toB = await editorial()?.update(
        article.id,
        { slug: "slug-b" },
        { actor: ACTOR, expectedVersion: article.version },
      );

      const back = await editorial()?.update(
        article.id,
        { slug: "slug-a" },
        { actor: ACTOR, expectedVersion: toB?.version ?? 0 },
      );

      expect(back?.delivery?.canonicalPath).toBe("/articles/slug-a");
      expect(await delivery()?.resolveSlug("slug-b")).toStrictEqual({
        location: "/articles/slug-a",
        status: 308,
        type: "redirect",
      });
      // Two rows, and `slug-a` is live again rather than duplicated.
      const rows = await historyRows(article.id);
      expect(rows).toHaveLength(2);
      expect(rows.find(row => row.slug === "slug-a")?.retired).toBe(false);
    });

    it("never reserves a draft's address", async () => {
      await createArticle({ slug: "wanted", title: "A draft" });

      // A draft has no public URL, so another record may still publish at that
      // address - the content table's own unique index is what stops a *live*
      // duplicate, and it fires on the create below rather than the reservation.
      const code = await pgErrorCode(
        async () => await createArticle({ slug: "wanted", title: "Another" }),
      );

      expect(code).toBe("23505");
      const [rows] = await sql<{ count: number }[]>`
        SELECT count(*)::int AS count FROM "core_content_slug_history"
      `;
      expect(rows.count).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Concurrency
  // -------------------------------------------------------------------------

  describe("concurrency", () => {
    it("lets one of two racing slug edits win and refuses the other", async () => {
      const article = await publishArticle({ title: "Original" });

      const results = await Promise.allSettled([
        editorial()?.update(
          article.id,
          { slug: "winner" },
          { actor: ACTOR, expectedVersion: article.version },
        ),
        editorial(rivalContext)?.update(
          article.id,
          { slug: "loser" },
          { actor: ACTOR, expectedVersion: article.version },
        ),
      ]);

      const rejected = results.filter(result => result.status === "rejected");
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toMatchObject({
        reason: expect.any(ContentVersionConflict),
      });

      // One winner, so exactly one retirement and one new reservation - the loser's
      // transaction rolled back and left the history as it found it.
      const rows = await historyRows(article.id);
      expect(rows).toHaveLength(2);
      expect(rows.filter(row => !row.retired)).toHaveLength(1);
      expect(rows.filter(row => row.slug === "loser")).toHaveLength(0);
    });

    it("keeps the history consistent when the write rolls back", async () => {
      const article = await publishArticle({ title: "Original" });

      // A stale expectation: the guarded UPDATE matches nothing, so the reservation
      // never runs at all.
      await expect(
        editorial()?.update(
          article.id,
          { slug: "never-written" },
          { actor: ACTOR, expectedVersion: article.version + 5 },
        ),
      ).rejects.toThrow(ContentVersionConflict);

      expect(
        (await historyRows(article.id)).map(row => row.slug),
      ).toStrictEqual(["original"]);
    });

    it("serialises two records racing for the same retired address", async () => {
      const first = await publishArticle({ title: "Contested" });
      await editorial()?.update(
        first.id,
        { slug: "moved-on" },
        { actor: ACTOR, expectedVersion: first.version },
      );

      const second = await createArticle({ slug: "second", title: "Second" });
      const third = await createArticle({ slug: "third", title: "Third" });

      const results = await Promise.allSettled([
        editorial()?.update(
          second.id,
          { slug: "contested" },
          { actor: ACTOR, expectedVersion: second.version },
        ),
        editorial(rivalContext)?.update(
          third.id,
          { slug: "contested" },
          { actor: ACTOR, expectedVersion: third.version },
        ),
      ]);

      // Both lose: the address belongs to the first article's history, and neither
      // of the two may take it.
      expect(results.every(result => result.status === "rejected")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Sitemap
  // -------------------------------------------------------------------------

  describe("sitemap", () => {
    it("lists only published records", async () => {
      const published = await publishArticle({ title: "Published one" });
      await createArticle({ title: "Still a draft" });

      const page = await delivery()?.sitemap();

      expect(page?.entries.map(entry => entry.itemId)).toStrictEqual([
        published.id,
      ]);
      expect(page?.entries[0]).toMatchObject({
        changeFrequency: "weekly",
        path: "/articles/published-one",
        priority: 0.7,
      });
    });

    it("omits a record whose publication date is in the future", async () => {
      const article = await publishArticle({ title: "Scheduled" });
      await sql`
        UPDATE "example_articles"
        SET "publishedAt" = now() + interval '1 day'
        WHERE "id" = ${article.id}
      `;

      expect((await delivery()?.sitemap())?.entries).toStrictEqual([]);
    });

    it("paginates by keyset, without duplicates or gaps", async () => {
      const ids: number[] = [];
      for (const title of ["One", "Two", "Three", "Four", "Five"]) {
        ids.push((await publishArticle({ title })).id);
      }

      const seen: number[] = [];
      let cursor: null | number | undefined = undefined;

      for (let page = 0; page < 10; page += 1) {
        // Annotated, because the optional-call chain through `deliveryService?.()`
        // loses the element type in the typed-lint program even though `tsc`
        // resolves it - and `itemId` is exactly what this test is about.
        const result: ContentDeliverySitemapPage | undefined =
          await delivery()?.sitemap({ cursor: cursor ?? undefined, limit: 2 });
        if (!result) break;

        for (const entry of result.entries) seen.push(entry.itemId);
        cursor = result.nextCursor;
        if (cursor === null) break;
      }

      // Every record exactly once, in ascending primary-key order.
      expect(seen).toStrictEqual([...ids].sort((a, b) => a - b));
      expect(new Set(seen).size).toBe(seen.length);
      expect(cursor).toBeNull();
    });

    it("moves lastModified on an ordinary edit that keeps the URL", async () => {
      const article = await publishArticle({ title: "Timestamped" });
      const first = await delivery()?.sitemap();
      const before = first?.entries[0].lastModified.getTime() ?? 0;

      // A title edit. The slug is never re-derived on update, so the URL is
      // unchanged - and the sitemap's `<lastmod>` still has to move, which is the
      // whole reason `contentChanged` cannot be "did membership change".
      await editorial()?.update(
        article.id,
        { excerpt: "A new summary." },
        { actor: ACTOR, expectedVersion: article.version },
      );

      const second = await delivery()?.sitemap();

      expect(second?.entries[0].path).toBe(first?.entries[0].path);
      expect(second?.entries[0].lastModified.getTime()).toBeGreaterThan(before);
    });

    it("reports the edit as a sitemap content change but not an index change", async () => {
      const article = await publishArticle({ title: "Timestamped two" });

      const outcome = await editorial()?.update(
        article.id,
        { excerpt: "Changed." },
        { actor: ACTOR, expectedVersion: article.version },
      );

      // The invariant the cache layer reads: the file's bytes moved, the set of files
      // did not. A stale sitemap is exactly what the first half prevents.
      expect(outcome?.delivery?.sitemap).toStrictEqual({
        contentChanged: true,
        indexChanged: false,
      });
    });

    it("reports no sitemap change for a no-op edit", async () => {
      const article = await publishArticle({ title: "Untouched" });
      const before = await delivery()?.sitemap();

      // Re-sending the stored value writes nothing, so `updatedAt` does not move and
      // the cached sitemap is still byte-correct.
      const outcome = await editorial()?.update(
        article.id,
        { title: "Untouched" },
        { actor: ACTOR, expectedVersion: article.version },
      );

      expect(outcome?.changed).toBe(false);
      expect(outcome?.delivery).toBeUndefined();

      const after = await delivery()?.sitemap();
      expect(after?.entries[0].lastModified.getTime()).toBe(
        before?.entries[0].lastModified.getTime(),
      );
    });

    it("uses the base row's updatedAt for a nonlocalized entry", async () => {
      const article = await publishArticle({ title: "Timestamped" });
      // Read through the same driver as the sitemap, never as `::text`: a
      // `timestamp` column is rendered in the session's timezone as text and parsed
      // back as an instant, so comparing the two forms compares two clocks.
      const row = await articleContent.service(context).findById(article.id);

      const page = await delivery()?.sitemap();

      expect(page?.entries[0].lastModified.toISOString()).toBe(
        row?.updatedAt.toISOString(),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  describe("delivery events", () => {
    it("emits both events after a live URL moves", async () => {
      const article = await publishArticle({ title: "Slug a" });
      emitted.length = 0;

      const outcome = await editorial()?.update(
        article.id,
        { slug: "slug-b" },
        { actor: ACTOR, expectedVersion: article.version },
      );
      if (!outcome) throw new Error("update returned nothing");

      await contentDeliveryEffects(
        context,
        articleContent.definition,
        outcome.delivery,
        { pluginId: PLUGIN },
      );

      expect(emitted.map(entry => entry.name)).toStrictEqual([
        "content.example.article.delivery_slug_changed",
        "content.example.article.delivery_redirect_created",
      ]);
      expect(emitted[0].payload).toMatchObject({
        canonicalPath: "/articles/slug-b",
        contentId: article.id,
        previousPath: "/articles/slug-a",
        previousSlug: "slug-a",
        slug: "slug-b",
      });
    });

    it("emits them alongside the ordinary update event, never instead of it", async () => {
      const article = await publishArticle({ title: "Slug a" });
      emitted.length = 0;

      const outcome = await editorial()?.update(
        article.id,
        { slug: "slug-b" },
        { actor: ACTOR, expectedVersion: article.version },
      );
      if (!outcome) throw new Error("update returned nothing");

      await contentEditorialEffects(
        context,
        articleContent.definition,
        outcome,
        {
          model: articleContent,
          pluginId: PLUGIN,
        },
      );

      expect(emitted.map(entry => entry.name)).toStrictEqual([
        "content.example.article.updated",
        "content.example.article.delivery_slug_changed",
        "content.example.article.delivery_redirect_created",
      ]);
    });

    it("emits nothing for a corrected draft", async () => {
      const article = await createArticle({ title: "Draft" });
      emitted.length = 0;

      const outcome = await editorial()?.update(
        article.id,
        { slug: "corrected" },
        { actor: ACTOR, expectedVersion: article.version },
      );
      if (!outcome) throw new Error("update returned nothing");

      await contentDeliveryEffects(
        context,
        articleContent.definition,
        outcome.delivery,
        { pluginId: PLUGIN },
      );

      // The URL moved, but it had never been live - so a listener that warms a CDN
      // or writes an edge redirect table hears about a redirect that does not exist.
      expect(
        emitted.filter(entry =>
          entry.name.includes("delivery_redirect_created"),
        ),
      ).toStrictEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Search integration
  // -------------------------------------------------------------------------

  describe("search integration", () => {
    it("indexes the current canonical URL and never a historical one", async () => {
      const article = await publishArticle({ title: "Slug a" });

      const outcome = await editorial()?.update(
        article.id,
        { slug: "slug-b" },
        { actor: ACTOR, expectedVersion: article.version },
      );
      if (!outcome) throw new Error("update returned nothing");

      indexed.length = 0;
      await contentEditorialEffects(
        context,
        articleContent.definition,
        outcome,
        {
          model: articleContent,
          pluginId: PLUGIN,
        },
      );

      // One document, pointing at the new address. A retired URL never becomes a
      // second search result competing with the page it redirects to.
      expect(indexed).toHaveLength(1);
      expect(indexed[0].url).toBe("/articles/slug-b");
      expect(
        indexed.filter(document => document.url === "/articles/slug-a"),
      ).toStrictEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Localization
  // -------------------------------------------------------------------------

  describe("localized delivery", () => {
    it("reserves one address per published language", async () => {
      const article = await publishLocalized({ pl: "Witaj swiecie" });

      const rows = await localizedHistory(article.id);

      expect(rows).toHaveLength(2);
      expect(rows.map(row => row.path).sort()).toStrictEqual([
        "/en/advanced-articles/hello-world",
        "/pl/advanced-articles/witaj-swiecie",
      ]);
      // Each carries its own language, which is what keeps the two histories apart.
      expect(new Set(rows.map(row => row.languageId)).size).toBe(2);
    });

    it("keeps an English slug change out of the Polish history", async () => {
      const article = await publishLocalized({ pl: "Witaj" });

      const before = await translationEditorial()?.update(
        article.id,
        "en",
        { slug: "hello-there" },
        { actor: ACTOR, expectedVersion: article.enVersion },
      );

      expect(before?.delivery).toMatchObject({
        canonicalPath: "/en/advanced-articles/hello-there",
        locale: "en",
        previousPath: "/en/advanced-articles/hello-world",
        redirectCreated: true,
      });

      const rows = await localizedHistory(article.id);
      const polish = rows.filter(row => row.languageId === localeIds.pl);

      // Polish gained nothing and retired nothing.
      expect(polish).toHaveLength(1);
      expect(polish[0]).toMatchObject({
        path: "/pl/advanced-articles/witaj",
        retired: false,
      });
    });

    it("redirects only inside the locale that moved", async () => {
      const article = await publishLocalized({ pl: "Witaj" });
      await translationEditorial()?.update(
        article.id,
        "en",
        { slug: "hello-there" },
        { actor: ACTOR, expectedVersion: article.enVersion },
      );

      expect(
        await advancedDelivery()?.resolvePath(
          "/en/advanced-articles/hello-world",
        ),
      ).toStrictEqual({
        location: "/en/advanced-articles/hello-there",
        status: 308,
        type: "redirect",
      });
      // The Polish URL is untouched and still canonical.
      expect(
        await advancedDelivery()?.resolvePath("/pl/advanced-articles/witaj"),
      ).toMatchObject({
        canonicalPath: "/pl/advanced-articles/witaj",
        type: "content",
      });
    });

    it("allows the same historical address in two locales", async () => {
      const first = await publishLocalized({ title: "Shared" });
      await translationEditorial()?.update(
        first.id,
        "en",
        { slug: "english-now" },
        { actor: ACTOR, expectedVersion: first.enVersion },
      );

      const second = await publishLocalized({ title: "Second" });
      await translationEditorial()?.create(
        second.id,
        "pl",
        { title: "Shared" },
        { actor: ACTOR },
      );
      const pl = await translationEditorial()?.publish(second.id, "pl", {
        actor: ACTOR,
      });
      await translationEditorial()?.update(
        second.id,
        "pl",
        { slug: "polski-teraz" },
        { actor: ACTOR, expectedVersion: pl?.version ?? 0 },
      );

      // `/en/.../shared` and `/pl/.../shared` are two URLs, so both may be retired
      // by two different records.
      const [rows] = await sql<{ count: number }[]>`
        SELECT count(*)::int AS count FROM "core_content_slug_history"
        WHERE "slug" = 'shared'
      `;
      expect(rows.count).toBe(2);
    });

    it("carries the alternates through resolveSlug, not only findById", async () => {
      const article = await publishLocalized({ pl: "Witaj" });

      const resolution = await advancedDelivery()?.resolveSlug("hello-world", {
        locale: "en",
      });

      // The public resolve route is what a frontend calls, so an empty `hreflang`
      // here would be invisible in the AdminCP and wrong on every page. It is only
      // possible because the content type exposes `id` - which `delivery` requires
      // of a localized content type for exactly this reason.
      expect(resolution).toMatchObject({
        itemId: article.id,
        type: "content",
      });
      expect(
        resolution?.type === "content" ? resolution.alternates : [],
      ).toStrictEqual([
        { locale: "en", path: "/en/advanced-articles/hello-world" },
        { locale: "pl", path: "/pl/advanced-articles/witaj" },
      ]);
    });

    it("resolves the default locale when the caller names none", async () => {
      const article = await publishLocalized();
      await translationEditorial()?.update(
        article.id,
        "en",
        { slug: "hello-there" },
        { actor: ACTOR, expectedVersion: article.enVersion },
      );

      // The public read resolves `defaultLocale` internally when no locale is given,
      // so the history lookup has to be about the same language - otherwise the live
      // branch would search `en` while the redirect branch searched the shared rows
      // and found nothing.
      expect(
        await advancedDelivery()?.resolveSlug("hello-world"),
      ).toStrictEqual({
        location: "/en/advanced-articles/hello-there",
        status: 308,
        type: "redirect",
      });
    });

    it("lists only real published translations as alternates", async () => {
      const article = await publishLocalized({ pl: "Witaj" });

      expect(await advancedDelivery()?.alternates(article.id)).toStrictEqual([
        { locale: "en", path: "/en/advanced-articles/hello-world" },
        { locale: "pl", path: "/pl/advanced-articles/witaj" },
      ]);
    });

    it("never fabricates an alternate from a draft translation", async () => {
      const article = await publishLocalized();
      // Created but deliberately not published.
      await translationEditorial()?.create(
        article.id,
        "pl",
        { title: "Wersja robocza" },
        { actor: ACTOR },
      );

      expect(await advancedDelivery()?.alternates(article.id)).toStrictEqual([
        { locale: "en", path: "/en/advanced-articles/hello-world" },
      ]);
    });

    it("reports the served locale on a fallback read", async () => {
      const article = await publishLocalized();

      const metadata = await advancedDelivery()?.findById(article.id, {
        locale: "pl",
      });

      // The Polish translation does not exist and the content type falls back to
      // English, so the canonical URL is the English one - `/pl/...` would be a
      // self-declared canonical that answers 404.
      expect(metadata).toMatchObject({
        canonicalPath: "/en/advanced-articles/hello-world",
        isFallback: true,
        locale: "en",
        requestedLocale: "pl",
      });
    });

    it("emits an x-default only when the default locale is published", async () => {
      const article = await publishLocalized({ pl: "Witaj" });

      const metadata = await advancedDelivery()?.findById(article.id, {
        locale: "pl",
      });

      expect(metadata?.hreflang).toStrictEqual({
        languages: {
          en: "/en/advanced-articles/hello-world",
          pl: "/pl/advanced-articles/witaj",
        },
        xDefault: "/en/advanced-articles/hello-world",
      });
    });

    it("stops a locale's redirects when its translation is unpublished", async () => {
      const article = await publishLocalized({ pl: "Witaj" });
      const moved = await translationEditorial()?.update(
        article.id,
        "en",
        { slug: "hello-there" },
        { actor: ACTOR, expectedVersion: article.enVersion },
      );

      await translationEditorial()?.unpublish(article.id, "en", {
        actor: ACTOR,
        expectedVersion: moved?.version,
      });

      expect(
        await advancedDelivery()?.resolvePath(
          "/en/advanced-articles/hello-world",
        ),
      ).toStrictEqual({ type: "not_found" });
      // Polish is unaffected: one language going dark is not the record going dark.
      expect(
        await advancedDelivery()?.resolvePath("/pl/advanced-articles/witaj"),
      ).toMatchObject({ type: "content" });
    });

    it("emits the localized delivery event alongside the translation one", async () => {
      const article = await publishLocalized();
      emitted.length = 0;

      const outcome = await translationEditorial()?.update(
        article.id,
        "en",
        { slug: "hello-there" },
        { actor: ACTOR, expectedVersion: article.enVersion },
      );
      if (!outcome) throw new Error("update returned nothing");

      await contentTranslationEffects(
        context,
        advancedArticleContent.definition,
        outcome,
        { model: advancedArticleContent, pluginId: PLUGIN },
      );

      const names = emitted.map(entry => entry.name);
      expect(names).toContain(
        "content.example.advanced-article.translation_updated",
      );
      expect(names).toContain(
        "content.example.advanced-article.delivery_slug_changed",
      );
      expect(
        emitted.find(entry => entry.name.includes("delivery_slug_changed"))
          ?.payload,
      ).toMatchObject({ locale: "en" });
    });
  });

  // -------------------------------------------------------------------------
  // Localized sitemap and SEO
  // -------------------------------------------------------------------------

  describe("localized sitemap", () => {
    it("lists one URL per published translation, per locale", async () => {
      const article = await publishLocalized({ pl: "Witaj" });

      const en = await advancedDelivery()?.sitemap({ locale: "en" });
      const pl = await advancedDelivery()?.sitemap({ locale: "pl" });

      expect(en?.entries.map(entry => entry.path)).toStrictEqual([
        "/en/advanced-articles/hello-world",
      ]);
      expect(pl?.entries.map(entry => entry.path)).toStrictEqual([
        "/pl/advanced-articles/witaj",
      ]);
      // `example.advanced-article` withholds `id` from its public allowlist too, but
      // a sitemap entry is built from the row rather than the projection - so the
      // identifier is there, and it is what an `xhtml:link` group is keyed by.
      expect(en?.entries[0].itemId).toBe(article.id);
    });

    it("omits a draft translation and never falls back for it", async () => {
      const article = await publishLocalized();
      await translationEditorial()?.create(
        article.id,
        "pl",
        { title: "Wersja robocza" },
        { actor: ACTOR },
      );

      // No Polish entry at all: it has no URL of its own, and listing the English
      // one under a Polish path would put the same content in the sitemap twice.
      expect(
        (await advancedDelivery()?.sitemap({ locale: "pl" }))?.entries,
      ).toStrictEqual([]);
      expect(article.id).toBeGreaterThan(0);
    });

    it("moves a translation's lastModified on an ordinary edit", async () => {
      const article = await publishLocalized();
      const before = await advancedDelivery()?.sitemap({ locale: "en" });

      const outcome = await translationEditorial()?.update(
        article.id,
        "en",
        { seo: { description: "A new summary." } },
        { actor: ACTOR, expectedVersion: article.enVersion },
      );

      const after = await advancedDelivery()?.sitemap({ locale: "en" });

      // Same URL, later timestamp - and the outcome says so, which is what expires
      // `sitemap:en` and nothing else.
      expect(after?.entries[0].path).toBe(before?.entries[0].path);
      expect(after?.entries[0].lastModified.getTime()).toBeGreaterThan(
        before?.entries[0].lastModified.getTime() ?? 0,
      );
      expect(outcome?.delivery?.sitemap).toStrictEqual({
        contentChanged: true,
        indexChanged: false,
      });
    });

    it("reports an index change when a translation is published", async () => {
      const localized = localizedService();
      if (!localized) throw new Error("no localized service");

      const created = await localized.create({
        shared: {},
        translation: { title: "Fresh" },
      });
      await advancedEditorial()?.publish(created.row.id, { actor: ACTOR });

      const outcome = await translationEditorial()?.publish(
        created.row.id,
        "en",
        { actor: ACTOR },
      );

      // A language gained a URL, so how many the index counts moved too.
      expect(outcome?.delivery?.sitemap).toStrictEqual({
        contentChanged: true,
        indexChanged: true,
      });
    });

    it("takes the later of the base and translation timestamps", async () => {
      const article = await publishLocalized();

      // A shared field moving changes what every language's page renders, even
      // though no translation row was touched.
      await sql`
        UPDATE "example_advanced_articles"
        SET "updatedAt" = now() + interval '1 hour'
        WHERE "id" = ${article.id}
      `;
      const base = await advancedArticleContent
        .service(context)
        .findById(article.id);
      const translation = await advancedArticleContent
        .translationService?.(context)
        .findByLocale(article.id, "en");

      const page = await advancedDelivery()?.sitemap({ locale: "en" });

      // The base row is now the later of the two, and that is the timestamp the
      // sitemap carries - a shared field moving has to look like a change.
      expect(base?.updatedAt.getTime()).toBeGreaterThan(
        translation?.updatedAt.getTime() ?? 0,
      );
      expect(page?.entries[0].lastModified.toISOString()).toBe(
        base?.updatedAt.toISOString(),
      );
    });

    it("excludes a record whose noIndex flag is set", async () => {
      const article = await publishLocalized();

      await sql`
        UPDATE "example_advanced_articles"
        SET "syndicationNoIndex" = true
        WHERE "id" = ${article.id}
      `;

      expect(
        (await advancedDelivery()?.sitemap({ locale: "en" }))?.entries,
      ).toStrictEqual([]);

      // And the two agree: a record absent from the sitemap reports `index: false`.
      const metadata = await advancedDelivery()?.findById(article.id, {
        locale: "en",
      });
      expect(metadata?.robots).toStrictEqual({ follow: true, index: false });
    });
  });

  describe("localized SEO projection", () => {
    it("reads each language's own SEO fields", async () => {
      const article = await publishLocalized({ pl: "Witaj" });

      await translationEditorial()?.update(
        article.id,
        "en",
        {
          seo: { description: "English summary", title: "English SEO" },
        },
        { actor: ACTOR, expectedVersion: article.enVersion },
      );

      const en = await advancedDelivery()?.findById(article.id, {
        locale: "en",
      });
      const pl = await advancedDelivery()?.findById(article.id, {
        locale: "pl",
      });

      expect(en?.seo).toStrictEqual({
        description: "English summary",
        title: "English SEO",
      });
      // Polish set none, so its title falls back to the localized `title` field -
      // its own, never English's.
      expect(pl?.seo).toStrictEqual({ description: null, title: "Witaj" });
    });

    it("never leaks a private field into the metadata", async () => {
      const article = await publishLocalized();

      const metadata = await advancedDelivery()?.findById(article.id, {
        locale: "en",
      });

      // `syndication.indexable` is a declared field that `publicApi.fields` does not
      // expose, so it is not even fetched - the projection cannot reach it.
      expect(JSON.stringify(metadata)).not.toContain("indexable");
    });
  });

  // -------------------------------------------------------------------------
  // Stage 1-7 regression
  // -------------------------------------------------------------------------

  describe("a content type without delivery", () => {
    it("has no delivery service and writes no history", async () => {
      expect(categoryContent.deliveryService).toBeUndefined();
      expect(categoryContent.definition.delivery.enabled).toBe(false);

      const outcome = await categoryContent
        .service(context)
        .create({ name: "Guides" });

      expect(outcome).toBeTruthy();
      const [rows] = await sql<{ count: number }[]>`
        SELECT count(*)::int AS count FROM "core_content_slug_history"
        WHERE "contentTypeId" = 'example.category'
      `;
      expect(rows.count).toBe(0);
    });

    it("reports no delivery outcome on its mutations", async () => {
      const outcome = await categoryContent
        .service(context)
        .create({ name: "News two" });

      expect(outcome).not.toHaveProperty("delivery");
    });
  });

  describe("preview", () => {
    it("registers no slug history and appears in no sitemap", async () => {
      const article = await createArticle({ title: "Unpublished draft" });

      // A preview reads a revision; it writes nothing. The record is still a draft,
      // so it has no reservation and no sitemap line either.
      const revisions = await editorial()?.revisions.list(article.id);
      expect(revisions?.edges.length).toBeGreaterThan(0);

      expect(await historyRows(article.id)).toStrictEqual([]);
      expect(
        (await delivery()?.sitemap())?.entries.filter(
          entry => entry.itemId === article.id,
        ),
      ).toStrictEqual([]);
      expect(await delivery()?.resolveSlug("unpublished-draft")).toStrictEqual({
        type: "not_found",
      });
    });
  });
});
