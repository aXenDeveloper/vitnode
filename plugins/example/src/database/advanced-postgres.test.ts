import type { Context } from "hono";

import {
  ContentAdvancedInputError,
  ContentRevisionNotRestorable,
  ContentVersionConflict,
} from "@vitnode/core/content";
import { drizzle } from "drizzle-orm/postgres-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CONFIG_PLUGIN, EXAMPLE_MIGRATIONS } from "@/const";

import { advancedArticleContent } from "./advanced-articles";
import { categoryContent } from "./categories";

/**
 * Stage 6 against real Postgres.
 *
 * Everything here is about what the *database* enforces, not what the service
 * intends: a duplicate junction row is a `23505`, a category still in use is a
 * `23503`, a reorder that would collide is either atomic or it is not. None of
 * that can be shown with a mock, and all of it is what the generated
 * constraints exist for.
 *
 * Runs only with `DATABASE_TEST_URL` set, and **wipes** the database it points
 * at - so the URL has to name one with "test" in it:
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

let sql: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle>;
let context: Context;

/**
 * A second connection, for the tests that need two writers at once.
 *
 * The main client is `max: 1`, which serialises everything through one backend
 * - useless for a race, because the second statement would be waiting on the
 * first to finish being sent.
 */
let rival: ReturnType<typeof postgres>;
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

/** Categories every test can point at. Recreated per test, ids move. */
let categoryIds: number[] = [];

const createArticle = async (
  values: Record<string, unknown> = {},
): Promise<{ id: number; version: number }> => {
  const outcome = await advancedArticleContent
    .editorialService?.(context, { pluginId: CONFIG_PLUGIN.pluginId })
    .create({ ...values }, { actor: ACTOR });
  if (!outcome) throw new Error("create returned nothing");

  return { id: outcome.row.id, version: outcome.version };
};

const editorial = (target: Context = context) =>
  advancedArticleContent.editorialService?.(target, {
    pluginId: CONFIG_PLUGIN.pluginId,
  });

const service = (target: Context = context) =>
  advancedArticleContent.service(target);

describe.skipIf(!url)("Stage 6 advanced modeling against Postgres", () => {
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
    await sql`
      INSERT INTO "core_languages" ("code", "name", "default") VALUES
        ('en', 'English', true),
        ('pl', 'Polski', false)
    `;

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
          if (key === "core") {
            return {
              contentModels: [
                {
                  model: advancedArticleContent,
                  pluginId: CONFIG_PLUGIN.pluginId,
                },
                { model: categoryContent, pluginId: CONFIG_PLUGIN.pluginId },
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
    await sql`DELETE FROM "example_advanced_articles"`;
    await sql`DELETE FROM "core_content_revisions"`;
    await sql`DELETE FROM "example_categories"`;

    const rows = await sql<{ id: number }[]>`
      INSERT INTO "example_categories" ("name")
      VALUES ('News'), ('Guides'), ('Releases')
      RETURNING "id"
    `;
    categoryIds = rows.map(row => row.id);
  });

  // -------------------------------------------------------------------------
  // Constraints
  // -------------------------------------------------------------------------

  describe("generated constraints", () => {
    it("refuses two junction rows for the same pair", async () => {
      const article = await createArticle();

      await sql`
        INSERT INTO "example_advanced_articles_categories"
          ("itemId", "relatedItemId", "position")
        VALUES (${article.id}, ${categoryIds[0]}, 0)
      `;

      const code = await pgErrorCode(
        async () =>
          await sql`
            INSERT INTO "example_advanced_articles_categories"
              ("itemId", "relatedItemId", "position")
            VALUES (${article.id}, ${categoryIds[0]}, 1)
          `,
      );

      expect(code).toBe("23505");
    });

    it("refuses two junction rows in the same position", async () => {
      const article = await createArticle();

      await sql`
        INSERT INTO "example_advanced_articles_categories"
          ("itemId", "relatedItemId", "position")
        VALUES (${article.id}, ${categoryIds[0]}, 0)
      `;

      const code = await pgErrorCode(
        async () =>
          await sql`
            INSERT INTO "example_advanced_articles_categories"
              ("itemId", "relatedItemId", "position")
            VALUES (${article.id}, ${categoryIds[1]}, 0)
          `,
      );

      expect(code).toBe("23505");
    });

    it("refuses a junction row pointing at nothing", async () => {
      const article = await createArticle();

      const code = await pgErrorCode(
        async () =>
          await sql`
            INSERT INTO "example_advanced_articles_categories"
              ("itemId", "relatedItemId", "position")
            VALUES (${article.id}, 999999, 0)
          `,
      );

      expect(code).toBe("23503");
    });

    it("refuses to delete a category that is still related", async () => {
      const article = await createArticle({ categories: [categoryIds[0]] });

      const code = await pgErrorCode(
        async () =>
          await sql`DELETE FROM "example_categories" WHERE "id" = ${categoryIds[0]}`,
      );

      // `onDelete: "restrict"` on the field, enforced by Postgres rather than by
      // a check in service code that a direct DELETE would walk past.
      expect(code).toBe("23503");
      expect(article.id).toBeGreaterThan(0);
    });

    it("takes the junction and child rows with the record", async () => {
      const article = await createArticle({
        categories: [categoryIds[0]],
        faq: [{ answer: "A", question: "Question?" }],
      });

      await sql`DELETE FROM "example_advanced_articles" WHERE "id" = ${article.id}`;

      const [junction] = await sql<{ count: number }[]>`
        SELECT count(*)::int AS count FROM "example_advanced_articles_categories"
      `;
      const [children] = await sql<{ count: number }[]>`
        SELECT count(*)::int AS count FROM "example_advanced_articles_faq"
      `;

      expect(junction.count).toBe(0);
      expect(children.count).toBe(0);
    });

    it("refuses two children in the same position", async () => {
      const article = await createArticle({
        faq: [{ answer: "A", question: "Question?" }],
      });

      const code = await pgErrorCode(
        async () =>
          await sql`
            INSERT INTO "example_advanced_articles_faq"
              ("itemId", "position", "question", "answer")
            VALUES (${article.id}, 0, 'Second', 'Also')
          `,
      );

      expect(code).toBe("23505");
    });

    it("scopes a localized slug to its language", async () => {
      const localized = advancedArticleContent.localizedService?.(context, {
        pluginId: CONFIG_PLUGIN.pluginId,
      });
      if (!localized) throw new Error("no localized service");

      await localized.create({
        shared: {},
        translation: { title: "Shared Title" },
      });

      const second = await localized.create({
        shared: {},
        translation: { title: "Another" },
      });

      const translations = advancedArticleContent.translationService?.(context);
      if (!translations) throw new Error("no translation service");

      // `/en/shared-title` already exists, so a second English one is a clash -
      // while the same slug in Polish is not.
      await expect(
        translations.update(
          second.row.id,
          "en",
          { slug: "shared-title" },
          { expectedVersion: 1 },
        ),
      ).rejects.toThrow();

      await expect(
        translations.create(second.row.id, "pl", {
          slug: "shared-title",
          title: "Polski",
        }),
      ).resolves.toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Reads and writes
  // -------------------------------------------------------------------------

  describe("relations", () => {
    it("stores an unordered set in ascending target order", async () => {
      const article = await createArticle();

      await service().relations.categories.set(
        article.id,
        [categoryIds[2], categoryIds[0], categoryIds[1]],
        { expectedVersion: article.version },
      );

      await expect(
        service().relations.categories.get(article.id),
      ).resolves.toStrictEqual([...categoryIds].sort((a, b) => a - b));
    });

    it("keeps the author's order for an ordered relation", async () => {
      const first = await createArticle();
      const second = await createArticle();
      const third = await createArticle();

      await editorial()?.update(
        first.id,
        { relatedArticles: [third.id, second.id] },
        { actor: ACTOR, expectedVersion: first.version },
      );

      await expect(
        service().relations.relatedArticles.get(first.id),
      ).resolves.toStrictEqual([third.id, second.id]);
    });

    it("reorders without ever colliding on a position", async () => {
      const article = await createArticle({ categories: categoryIds });
      const current = await service().relations.relatedArticles.get(article.id);

      expect(current).toStrictEqual([]);

      const others = [await createArticle(), await createArticle()];
      const [a, b] = others.map(row => row.id);

      const set = await editorial()?.update(
        article.id,
        { relatedArticles: [a, b] },
        { actor: ACTOR, expectedVersion: 1 },
      );
      if (!set) throw new Error("update returned nothing");

      // The interesting direction: every row moves at once, which a naive
      // per-row UPDATE would break against `UNIQUE (itemId, position)`.
      await editorial()?.update(
        article.id,
        { relatedArticles: [b, a] },
        { actor: ACTOR, expectedVersion: set.version },
      );

      await expect(
        service().relations.relatedArticles.get(article.id),
      ).resolves.toStrictEqual([b, a]);
    });

    it("refuses a target that does not exist", async () => {
      const article = await createArticle();

      await expect(
        service().relations.categories.set(article.id, [999999], {
          expectedVersion: article.version,
        }),
      ).rejects.toBeInstanceOf(ContentAdvancedInputError);
    });

    it("treats a reorder to the current order as a no-op", async () => {
      const article = await createArticle({ categories: categoryIds });
      const stored = await service().relations.categories.get(article.id);

      const result = await service().relations.categories.reorder(
        article.id,
        stored,
        { expectedVersion: 1 },
      );

      expect(result?.changedFields).toStrictEqual([]);

      const [row] = await sql<{ version: number }[]>`
        SELECT "version" FROM "example_advanced_articles" WHERE "id" = ${article.id}
      `;
      // No version bump, so no revision and no event either.
      expect(row.version).toBe(1);
    });

    it("refuses a reorder that is not a permutation", async () => {
      const article = await createArticle({ categories: categoryIds });

      await expect(
        service().relations.categories.reorder(article.id, [categoryIds[0]]),
      ).rejects.toThrow(/exactly the target ids/);
    });

    it("filters by membership with an indexed EXISTS", async () => {
      const matching = await createArticle({ categories: [categoryIds[1]] });
      await createArticle({ categories: [categoryIds[0]] });

      const found = await service().findMany({
        filters: { categories: { contains: categoryIds[1] } },
      });

      expect(found.edges.map(edge => edge.id)).toStrictEqual([matching.id]);
    });
  });

  describe("repeatables", () => {
    it("gives every child a stable id that survives a reorder", async () => {
      const article = await createArticle({
        faq: [
          { answer: "First answer", question: "First?" },
          { answer: "Second answer", question: "Second?" },
        ],
      });

      const before = await service().repeatable.faq.list(article.id);
      const ids = before.map(row => row.id as number);

      await service().repeatable.faq.reorder(article.id, [ids[1], ids[0]], {
        expectedVersion: 1,
      });

      const after = await service().repeatable.faq.list(article.id);

      expect(after.map(row => row.id)).toStrictEqual([ids[1], ids[0]]);
      expect(after.map(row => row.question)).toStrictEqual([
        "Second?",
        "First?",
      ]);
    });

    it("replaces the whole list in one write", async () => {
      const article = await createArticle({
        faq: [
          { answer: "A", question: "Keep?" },
          { answer: "B", question: "Drop?" },
        ],
      });

      const current = await service().repeatable.faq.list(article.id);
      const keptId = current[0].id as number;

      const result = await service().repeatable.faq.set(
        article.id,
        [
          { answer: "A revised", id: keptId, question: "Keep?" },
          { answer: "C", question: "New?" },
        ],
        { expectedVersion: 1 },
      );

      expect(result?.changedFields).toStrictEqual(["faq"]);

      const after = await service().repeatable.faq.list(article.id);

      expect(after).toHaveLength(2);
      // Identity preserved for the kept row, fresh for the new one.
      expect(after[0].id).toBe(keptId);
      expect(after[0].answer).toBe("A revised");
      expect(after[1].question).toBe("New?");
      expect(after[1].id).not.toBe(keptId);
    });

    it("refuses a child that belongs to another record", async () => {
      const mine = await createArticle({
        faq: [{ answer: "A", question: "Question?" }],
      });
      const theirs = await createArticle({
        faq: [{ answer: "B", question: "Rival?" }],
      });
      const [stolen] = await service().repeatable.faq.list(theirs.id);

      await expect(
        service().repeatable.faq.set(
          mine.id,
          [{ answer: "A", id: stolen.id, question: "Question?" }],
          { expectedVersion: 1 },
        ),
      ).rejects.toBeInstanceOf(ContentAdvancedInputError);
    });

    it("treats identical values, order and identities as a no-op", async () => {
      const article = await createArticle({
        faq: [{ answer: "A", question: "Question?" }],
      });
      const current = await service().repeatable.faq.list(article.id);

      const result = await service().repeatable.faq.set(
        article.id,
        current.map(row => ({ ...row })),
        { expectedVersion: 1 },
      );

      expect(result?.changedFields).toStrictEqual([]);

      const [row] = await sql<{ version: number }[]>`
        SELECT "version" FROM "example_advanced_articles" WHERE "id" = ${article.id}
      `;
      expect(row.version).toBe(1);
    });

    it("keeps positions contiguous from zero", async () => {
      const article = await createArticle({
        faq: [
          { answer: "A", question: "One?" },
          { answer: "B", question: "Two?" },
          { answer: "C", question: "Three?" },
        ],
      });

      const rows = await sql<{ position: number }[]>`
        SELECT "position" FROM "example_advanced_articles_faq"
        WHERE "itemId" = ${article.id} ORDER BY "position"
      `;

      expect(rows.map(row => row.position)).toStrictEqual([0, 1, 2]);
    });
  });

  describe("structured groups", () => {
    it("moves one leaf without disturbing its neighbours", async () => {
      const article = await createArticle({
        syndication: { indexable: false, priority: 9 },
      });

      const result = await editorial()?.update(
        article.id,
        { syndication: { priority: 3 } },
        { actor: ACTOR, expectedVersion: article.version },
      );

      expect(result?.changedFields).toStrictEqual(["syndication.priority"]);

      const row = await service().findById(article.id);

      expect(row?.syndication).toStrictEqual({
        indexable: false,
        priority: 3,
      });
    });

    it("stores the leaves as real, queryable columns", async () => {
      await createArticle({ syndication: { priority: 8 } });
      await createArticle({ syndication: { priority: 2 } });

      const rows = await sql<{ syndicationPriority: number }[]>`
        SELECT "syndicationPriority" FROM "example_advanced_articles"
        WHERE "syndicationPriority" > 5
      `;

      expect(rows).toHaveLength(1);
      expect(rows[0].syndicationPriority).toBe(8);
    });

    it("reads a nullable localized group back as null when it is empty", async () => {
      const localized = advancedArticleContent.localizedService?.(context, {
        pluginId: CONFIG_PLUGIN.pluginId,
      });
      if (!localized) throw new Error("no localized service");

      const created = await localized.create({
        shared: {},
        translation: { title: "No SEO Here" },
      });

      const translation = await advancedArticleContent
        .translationService?.(context)
        .findByLocale(created.row.id, "en");

      expect(translation?.values.seo).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Concurrency
  // -------------------------------------------------------------------------

  describe("concurrency", () => {
    it("lets exactly one of two racing relation writers win", async () => {
      const article = await createArticle({ categories: [categoryIds[0]] });

      const results = await Promise.allSettled([
        editorial()?.update(
          article.id,
          { categories: [categoryIds[1]] },
          { actor: ACTOR, expectedVersion: article.version },
        ),
        editorial(rivalContext)?.update(
          article.id,
          { categories: [categoryIds[2]] },
          { actor: ACTOR, expectedVersion: article.version },
        ),
      ]);

      const won = results.filter(result => result.status === "fulfilled");
      const lost = results.filter(result => result.status === "rejected");

      expect(won).toHaveLength(1);
      expect(lost).toHaveLength(1);
      expect(lost[0].reason).toBeInstanceOf(ContentVersionConflict);

      // The loser wrote nothing at all: exactly one category, from one writer.
      const stored = await service().relations.categories.get(article.id);
      expect(stored).toHaveLength(1);
      expect([categoryIds[1], categoryIds[2]]).toContain(stored[0]);
    });

    it("lets a relation write and a scalar write race for the same version", async () => {
      const article = await createArticle();

      const results = await Promise.allSettled([
        editorial()?.update(
          article.id,
          { categories: [categoryIds[0]] },
          { actor: ACTOR, expectedVersion: article.version },
        ),
        editorial(rivalContext)?.update(
          article.id,
          { syndication: { priority: 1 } },
          { actor: ACTOR, expectedVersion: article.version },
        ),
      ]);

      expect(
        results.filter(result => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.filter(result => result.status === "rejected"),
      ).toHaveLength(1);

      const [row] = await sql<{ version: number }[]>`
        SELECT "version" FROM "example_advanced_articles" WHERE "id" = ${article.id}
      `;
      // One increment, not two: a lost update is a lost update whichever kind
      // of value it would have written.
      expect(row.version).toBe(2);
    });

    it("lets exactly one of two racing repeatable writers win", async () => {
      const article = await createArticle({
        faq: [{ answer: "A", question: "Question?" }],
      });

      const results = await Promise.allSettled([
        editorial()?.update(
          article.id,
          { faq: [{ answer: "Mine", question: "Mine?" }] },
          { actor: ACTOR, expectedVersion: 1 },
        ),
        editorial(rivalContext)?.update(
          article.id,
          { faq: [{ answer: "Theirs", question: "Theirs?" }] },
          { actor: ACTOR, expectedVersion: 1 },
        ),
      ]);

      expect(
        results.filter(result => result.status === "fulfilled"),
      ).toHaveLength(1);

      const stored = await service().repeatable.faq.list(article.id);

      // No partial child mutation survived: one writer's whole list, not a mix.
      expect(stored).toHaveLength(1);
      expect(["Mine?", "Theirs?"]).toContain(stored[0].question);
    });

    it("never leaves two children in the same position after racing reorders", async () => {
      const article = await createArticle({
        faq: [
          { answer: "A", question: "One?" },
          { answer: "B", question: "Two?" },
          { answer: "C", question: "Three?" },
        ],
      });
      const stored = await service().repeatable.faq.list(article.id);
      const at = (index: number) => ({
        answer: String(stored[index].answer),
        id: Number(stored[index].id),
        question: String(stored[index].question),
      });

      await Promise.allSettled([
        editorial()?.update(
          article.id,
          { faq: [at(2), at(1), at(0)] },
          { actor: ACTOR, expectedVersion: 1 },
        ),
        editorial(rivalContext)?.update(
          article.id,
          { faq: [at(1), at(0), at(2)] },
          { actor: ACTOR, expectedVersion: 1 },
        ),
      ]);

      const rows = await sql<{ position: number }[]>`
        SELECT "position" FROM "example_advanced_articles_faq"
        WHERE "itemId" = ${article.id} ORDER BY "position"
      `;

      expect(rows.map(row => row.position)).toStrictEqual([0, 1, 2]);
    });

    it("keeps two different records independent", async () => {
      const first = await createArticle();
      const second = await createArticle();

      const results = await Promise.all([
        editorial()?.update(
          first.id,
          { categories: [categoryIds[0]] },
          { actor: ACTOR, expectedVersion: first.version },
        ),
        editorial(rivalContext)?.update(
          second.id,
          { categories: [categoryIds[1]] },
          { actor: ACTOR, expectedVersion: second.version },
        ),
      ]);

      expect(results.every(result => result?.changed)).toBe(true);
      await expect(
        service().relations.categories.get(first.id),
      ).resolves.toStrictEqual([categoryIds[0]]);
      await expect(
        service().relations.categories.get(second.id),
      ).resolves.toStrictEqual([categoryIds[1]]);
    });
  });

  // -------------------------------------------------------------------------
  // Revisions and restore
  // -------------------------------------------------------------------------

  describe("revisions and restore", () => {
    it("records relation identity and repeatable children, never expanded rows", async () => {
      const article = await createArticle({
        categories: [categoryIds[0], categoryIds[1]],
        faq: [{ answer: "A", question: "Question?" }],
      });

      const latest = await editorial()?.revisions.latest(article.id);
      if (!latest) throw new Error("no revision");

      const revision = await editorial()?.revisions.findById(
        article.id,
        latest.id,
      );
      const snapshot = revision?.snapshot as unknown as {
        fields: Record<string, unknown>;
      };

      expect(snapshot.fields.categories).toStrictEqual(
        [categoryIds[0], categoryIds[1]].sort((a, b) => a - b),
      );
      expect(snapshot.fields.faq).toStrictEqual([
        { answer: "A", id: expect.any(Number), question: "Question?" },
      ]);
      // Nested, never the flattened column names.
      expect(snapshot.fields.syndication).toStrictEqual({
        indexable: true,
        priority: 5,
      });
    });

    it("restores an ordered relation to its historical order", async () => {
      const article = await createArticle();
      const others = [await createArticle(), await createArticle()];
      const [a, b] = others.map(row => row.id);

      const first = await editorial()?.update(
        article.id,
        { relatedArticles: [a, b] },
        { actor: ACTOR, expectedVersion: 1 },
      );
      if (!first) throw new Error("update returned nothing");

      const target = first.revisionId;
      if (target === null) throw new Error("no revision");

      const second = await editorial()?.update(
        article.id,
        { relatedArticles: [b, a] },
        { actor: ACTOR, expectedVersion: first.version },
      );
      if (!second) throw new Error("update returned nothing");

      await editorial()?.restore(article.id, target, {
        actor: ACTOR,
        expectedVersion: second.version,
      });

      await expect(
        service().relations.relatedArticles.get(article.id),
      ).resolves.toStrictEqual([a, b]);
    });

    it("recreates a repeatable child that was removed since", async () => {
      const article = await createArticle({
        faq: [
          { answer: "A", question: "One?" },
          { answer: "B", question: "Two?" },
        ],
      });
      const original = await editorial()?.revisions.latest(article.id);
      if (!original) throw new Error("no revision");

      const removed = await editorial()?.update(
        article.id,
        { faq: [] },
        { actor: ACTOR, expectedVersion: 1 },
      );
      if (!removed) throw new Error("update returned nothing");

      await expect(
        service().repeatable.faq.list(article.id),
      ).resolves.toStrictEqual([]);

      await editorial()?.restore(article.id, original.id, {
        actor: ACTOR,
        expectedVersion: removed.version,
      });

      const restored = await service().repeatable.faq.list(article.id);

      expect(restored.map(row => row.question)).toStrictEqual(["One?", "Two?"]);
      // Recreated rather than matched: the ids are gone, the values are not.
      expect(restored.every(row => typeof row.id === "number")).toBe(true);
    });

    it("refuses to restore a relation whose target is gone", async () => {
      const article = await createArticle({ categories: [categoryIds[0]] });
      const original = await editorial()?.revisions.latest(article.id);
      if (!original) throw new Error("no revision");

      const cleared = await editorial()?.update(
        article.id,
        { categories: [] },
        { actor: ACTOR, expectedVersion: 1 },
      );
      if (!cleared) throw new Error("update returned nothing");

      await sql`DELETE FROM "example_categories" WHERE "id" = ${categoryIds[0]}`;

      await expect(
        editorial()?.restore(article.id, original.id, {
          actor: ACTOR,
          expectedVersion: cleared.version,
        }),
      ).rejects.toBeInstanceOf(ContentRevisionNotRestorable);

      // Nothing was partially applied.
      await expect(
        service().relations.categories.get(article.id),
      ).resolves.toStrictEqual([]);
    });

    it("restores a nested group leaf without touching its neighbour", async () => {
      const article = await createArticle({
        syndication: { indexable: true, priority: 7 },
      });
      const original = await editorial()?.revisions.latest(article.id);
      if (!original) throw new Error("no revision");

      const changed = await editorial()?.update(
        article.id,
        { syndication: { indexable: false, priority: 1 } },
        { actor: ACTOR, expectedVersion: 1 },
      );
      if (!changed) throw new Error("update returned nothing");

      await editorial()?.restore(article.id, original.id, {
        actor: ACTOR,
        expectedVersion: changed.version,
      });

      const row = await service().findById(article.id);

      expect(row?.syndication).toStrictEqual({
        indexable: true,
        priority: 7,
      });
    });
  });

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  describe("public projection", () => {
    const publish = async (id: number, version: number) =>
      await editorial()?.publish(id, {
        actor: ACTOR,
        expectedVersion: version,
      });

    it("exposes the named leaves and nothing else", async () => {
      const localized = advancedArticleContent.localizedService?.(context, {
        pluginId: CONFIG_PLUGIN.pluginId,
      });
      if (!localized) throw new Error("no localized service");

      const created = await localized.create({
        shared: {
          categories: [categoryIds[0]],
          faq: [{ answer: "Public answer", question: "Public question?" }],
          syndication: { indexable: false, priority: 4 },
        },
        translation: {
          seo: { description: "Public description", title: "Public SEO" },
          title: "Public Article",
        },
      });

      // `localizedService.create` is typed against the erased definition, so
      // its row comes back widened - narrowed here rather than at every use.
      const itemId = created.row.id;

      await publish(itemId, created.row.version);
      await advancedArticleContent
        .translationEditorialService?.(context, {
          pluginId: CONFIG_PLUGIN.pluginId,
        })
        .publish(itemId, "en", { actor: ACTOR });

      const row = await advancedArticleContent
        .publicService?.(context)
        .findById(itemId, { locale: "en" });

      expect(row).toMatchObject({
        categories: [categoryIds[0]],
        faq: [{ answer: "Public answer", question: "Public question?" }],
        locale: "en",
        seo: { description: "Public description", title: "Public SEO" },
        syndication: { priority: 4 },
        title: "Public Article",
      });

      // The private leaf is absent from the response *and* from the SELECT.
      expect(
        (row as unknown as { syndication: Record<string, unknown> })
          .syndication,
      ).not.toHaveProperty("indexable");
      // A private collection is absent altogether.
      expect(row).not.toHaveProperty("relatedArticles");
    });
  });
});
