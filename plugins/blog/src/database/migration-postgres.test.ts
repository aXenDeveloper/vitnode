import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { BlogTestHarness } from "./harness";

import { categoryContent } from "./categories";
import {
  BLOG_MIGRATION,
  createBlogTestHarness,
  DATABASE_TEST_URL,
  LEGACY_BLOG_SCHEMA,
  readMigration,
} from "./harness";
import { postContent } from "./posts";

/**
 * The blog's move onto the Content Engine, run over a database that already has
 * a blog in it.
 *
 * The seed below is a pre-migration install: two categories with different
 * colours, three articles across them, an author, rich bodies, existing slugs
 * and Polish translations of one article - all stored the way the plugin used to
 * store them, in `core_languages_words`. Everything after `migrate` reads the
 * same data back through the **Content Engine's** services, which is the only
 * proof that matters: the rows did not merely survive, they arrived somewhere
 * the new code can actually see.
 */

let h: BlogTestHarness;

const seed = async (): Promise<{
  authorId: number;
  categoryIds: number[];
  postIds: number[];
}> => {
  const [author] = await h.sql<{ id: number }[]>`
    INSERT INTO "core_users" ("name") VALUES ('Ada Lovelace') RETURNING "id"
  `;

  const categories = await h.sql<{ id: number }[]>`
    INSERT INTO "blog_categories" ("color", "createdAt", "updatedAt") VALUES
      ('#3260c0', '2024-01-01 10:00:00', '2024-01-02 10:00:00'),
      (NULL,      '2024-01-03 10:00:00', '2024-01-04 10:00:00')
    RETURNING "id"
  `;

  const posts = await h.sql<{ id: number }[]>`
    INSERT INTO "blog_posts" ("categoryId", "authorId", "createdAt", "updatedAt")
    VALUES
      (${categories[0].id}, ${author.id}, '2024-02-01 09:00:00', '2024-02-05 09:00:00'),
      (${categories[0].id}, NULL,         '2024-02-02 09:00:00', '2024-02-06 09:00:00'),
      (${categories[1].id}, ${author.id}, '2024-02-03 09:00:00', '2024-02-07 09:00:00')
    RETURNING "id"
  `;

  const word = (
    tableName: string,
    variable: string,
    itemId: number,
    languageCode: string,
    value: string,
  ) => ({
    itemId,
    languageCode,
    pluginCode: "@vitnode/blog",
    tableName,
    value,
    variable,
  });

  await h.sql`
    INSERT INTO "core_languages_words"
      ${h.sql([
        word("blog_categories", "title", categories[0].id, "en", "Engineering"),
        word("blog_categories", "title", categories[0].id, "pl", "Inżynieria"),
        word("blog_categories", "title", categories[1].id, "en", "Culture"),

        word("blog_posts", "title", posts[0].id, "en", "Hello world"),
        word(
          "blog_posts",
          "content",
          posts[0].id,
          "en",
          "<p>The <strong>first</strong> article.</p>",
        ),
        word("blog_posts", "friendlyUrl", posts[0].id, "en", "hello-world"),
        word("blog_posts", "title", posts[0].id, "pl", "Witaj świecie"),
        word(
          "blog_posts",
          "content",
          posts[0].id,
          "pl",
          "<p>Pierwszy artykuł.</p>",
        ),
        word("blog_posts", "friendlyUrl", posts[0].id, "pl", "witaj-swiecie"),

        word("blog_posts", "title", posts[1].id, "en", "Second article"),
        word("blog_posts", "content", posts[1].id, "en", "<p>Body two.</p>"),
        word("blog_posts", "friendlyUrl", posts[1].id, "en", "second-article"),

        // Only Polish, and no English at all - the record the default-locale
        // backfill has to rescue rather than leave without a translation.
        word("blog_posts", "title", posts[2].id, "pl", "Tylko po polsku"),
        word("blog_posts", "content", posts[2].id, "pl", "<p>Trzeci.</p>"),
        word("blog_posts", "friendlyUrl", posts[2].id, "pl", "tylko-po-polsku"),
      ])}
  `;

  return {
    authorId: author.id,
    categoryIds: categories.map(row => row.id),
    postIds: posts.map(row => row.id),
  };
};

describe.skipIf(!DATABASE_TEST_URL)("blog -> Content Engine migration", () => {
  let seeded: Awaited<ReturnType<typeof seed>>;

  beforeAll(async () => {
    h = await createBlogTestHarness();
    await h.migrate(LEGACY_BLOG_SCHEMA);
    seeded = await seed();
    await h.migrate(readMigration(BLOG_MIGRATION));
  }, 60_000);

  afterAll(async () => {
    await h.end();
  });

  describe("the records themselves", () => {
    it("keeps every category, its id and its colour", async () => {
      const rows = await h.sql<{ color: null | string; id: number }[]>`
        SELECT "id", "color" FROM "blog_categories" ORDER BY "id"
      `;

      expect(rows).toEqual([
        { color: "#3260c0", id: seeded.categoryIds[0] },
        { color: null, id: seeded.categoryIds[1] },
      ]);
    });

    it("keeps every article, its id, its category and its author", async () => {
      const rows = await h.sql<
        { authorId: null | number; categoryId: number; id: number }[]
      >`
        SELECT "id", "categoryId", "authorId" FROM "blog_posts" ORDER BY "id"
      `;

      expect(rows).toEqual([
        {
          authorId: seeded.authorId,
          categoryId: seeded.categoryIds[0],
          id: seeded.postIds[0],
        },
        {
          authorId: null,
          categoryId: seeded.categoryIds[0],
          id: seeded.postIds[1],
        },
        {
          authorId: seeded.authorId,
          categoryId: seeded.categoryIds[1],
          id: seeded.postIds[2],
        },
      ]);
    });

    it("keeps the timestamps rather than stamping the migration's own", async () => {
      const [row] = await h.sql<{ createdAt: string; updatedAt: string }[]>`
        SELECT "createdAt", "updatedAt" FROM "blog_posts"
        WHERE "id" = ${seeded.postIds[0]}
      `;

      expect(row.createdAt).toContain("2024-02-01");
      expect(row.updatedAt).toContain("2024-02-05");
    });
  });

  describe("publication", () => {
    it("publishes every article that was publicly readable before", async () => {
      const rows = await h.sql<
        { publishedAt: null | string; status: string }[]
      >`SELECT "status", "publishedAt" FROM "blog_posts" ORDER BY "id"`;

      expect(rows.map(row => row.status)).toEqual([
        "published",
        "published",
        "published",
      ]);
      expect(rows.every(row => row.publishedAt !== null)).toBe(true);
    });

    it("dates the publication from the record rather than from the upgrade", async () => {
      const [row] = await h.sql<{ publishedAt: string }[]>`
        SELECT "publishedAt" FROM "blog_posts" WHERE "id" = ${seeded.postIds[0]}
      `;

      expect(row.publishedAt).toContain("2024-02-01");
    });

    it("starts every record at version 1, inventing no history", async () => {
      const [{ versions }] = await h.sql<{ versions: number[] }[]>`
        SELECT array_agg(DISTINCT "version") AS versions FROM "blog_posts"
      `;
      const [{ count }] = await h.sql<{ count: number }[]>`
        SELECT count(*)::int AS count FROM "core_content_revisions"
      `;

      expect(versions).toEqual([1]);
      expect(count).toBe(0);
    });
  });

  describe("translations", () => {
    it("moves every language of an article into the translation table", async () => {
      const rows = await h.sql<
        {
          content: string;
          friendlyUrl: string;
          locale: string;
          title: string;
        }[]
      >`
        SELECT l."code" AS locale, t."title", t."friendlyUrl", t."content"
        FROM "blog_posts_translations" t
        JOIN "core_languages" l ON l."id" = t."languageId"
        WHERE t."itemId" = ${seeded.postIds[0]}
        ORDER BY l."code"
      `;

      expect(rows).toEqual([
        {
          content: "<p>The <strong>first</strong> article.</p>",
          friendlyUrl: "hello-world",
          locale: "en",
          title: "Hello world",
        },
        {
          content: "<p>Pierwszy artykuł.</p>",
          friendlyUrl: "witaj-swiecie",
          locale: "pl",
          title: "Witaj świecie",
        },
      ]);
    });

    it("does not invent a translation for a language nobody wrote", async () => {
      const rows = await h.sql<{ locale: string }[]>`
        SELECT l."code" AS locale
        FROM "blog_categories_translations" t
        JOIN "core_languages" l ON l."id" = t."languageId"
        WHERE t."itemId" = ${seeded.categoryIds[1]}
      `;

      // Only the English title existed, and the default-locale backfill has
      // nothing to add on top of it.
      expect(rows).toEqual([{ locale: "en" }]);
    });

    it("gives a record with no default-locale translation one built from what it has", async () => {
      const rows = await h.sql<{ locale: string; title: string }[]>`
        SELECT l."code" AS locale, t."title"
        FROM "blog_posts_translations" t
        JOIN "core_languages" l ON l."id" = t."languageId"
        WHERE t."itemId" = ${seeded.postIds[2]}
        ORDER BY l."code"
      `;

      expect(rows).toEqual([
        { locale: "en", title: "Tylko po polsku" },
        { locale: "pl", title: "Tylko po polsku" },
      ]);
    });

    it("keeps the category names, in every language they had", async () => {
      const rows = await h.sql<{ locale: string; name: string }[]>`
        SELECT l."code" AS locale, t."name"
        FROM "blog_categories_translations" t
        JOIN "core_languages" l ON l."id" = t."languageId"
        WHERE t."itemId" = ${seeded.categoryIds[0]}
        ORDER BY l."code"
      `;

      expect(rows).toEqual([
        { locale: "en", name: "Engineering" },
        { locale: "pl", name: "Inżynieria" },
      ]);
    });

    it("empties the storage it migrated out of", async () => {
      const [{ count }] = await h.sql<{ count: number }[]>`
        SELECT count(*)::int AS count FROM "core_languages_words"
        WHERE "pluginCode" = '@vitnode/blog'
      `;

      expect(count).toBe(0);
    });
  });

  describe("read back through the Content Engine", () => {
    it("lists the articles the AdminCP list would show", async () => {
      const { edges, pageInfo } = await postContent
        .service(h.context)
        .findMany();

      expect(pageInfo.totalCount).toBe(3);
      expect(edges.map(edge => edge.id).sort((a, b) => a - b)).toEqual(
        seeded.postIds,
      );
    });

    it("reads one article the way the edit page does", async () => {
      const row = await postContent
        .service(h.context)
        .findRowById(seeded.postIds[0]);

      expect(row?.categoryId).toBe(seeded.categoryIds[0]);
      expect(row?.authorId).toBe(seeded.authorId);
      expect(row?.status).toBe("published");
    });

    it("reads a translation the way the locale tab does", async () => {
      const translation = await postContent
        .translationService?.(h.context)
        .findByLocale(seeded.postIds[0], "pl");

      expect(translation?.locale).toBe("pl");
      expect(translation?.status).toBe("published");
      expect(translation?.values).toEqual({
        content: "<p>Pierwszy artykuł.</p>",
        friendlyUrl: "witaj-swiecie",
        title: "Witaj świecie",
      });
    });

    it("keeps the category relation usable as a relation", async () => {
      const rows = await h.sql<{ count: number }[]>`
        SELECT count(*)::int AS count FROM "blog_posts"
        WHERE "categoryId" = ${seeded.categoryIds[0]}
      `;

      expect(rows[0].count).toBe(2);
    });

    it("refuses to delete a category that still has articles", async () => {
      let code: string | undefined;
      try {
        await h.sql`
          DELETE FROM "blog_categories" WHERE "id" = ${seeded.categoryIds[0]}
        `;
      } catch (error) {
        const cause = (error as { cause?: { code?: string } }).cause;
        code = cause?.code ?? (error as { code?: string }).code;
      }

      expect(code).toBe("23503");
    });

    it("edits a migrated article through the engine and nothing else", async () => {
      const service = categoryContent.service(h.context);
      const updated = await service.update(seeded.categoryIds[0], {
        color: "#112233",
      });

      expect(updated?.changedFields).toEqual(["color"]);
      expect(updated?.row.color).toBe("#112233");
    });
  });
});
