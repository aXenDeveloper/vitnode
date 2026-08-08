import type { SearchDocument } from "@vitnode/core/api/models/search";
import type { Context } from "hono";

import {
  createContentLocalizedSearchIndexer,
  createContentSearchIndexer,
} from "@vitnode/core/content/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CONFIG_PLUGIN } from "@/const";

import type { ContentTestHarness } from "./harness";

import { advancedArticleContent } from "./advanced-articles";
import { articleContent } from "./articles";
import {
  ACTOR,
  clearContentTables,
  createContentTestHarness,
  DATABASE_TEST_URL,
} from "./harness";
import { localizedArticleContent } from "./localized-articles";

/**
 * Pagination, query counts and index use, at a scale that can tell them apart.
 *
 * Nothing here measures milliseconds. A wall-clock number in CI says more about
 * the machine than about the code, and it fails on a busy runner for reasons
 * nobody can act on. What is measured instead is **algorithmic**: how many
 * round trips one page costs, whether that number moves when the page grows,
 * and whether a lookup seeks on an index or reads the whole table.
 *
 * The dataset is deliberately modest - a few thousand rows rather than the ten
 * thousand the plan suggests - because the properties under test are visible at
 * any size above "a handful", and a suite nobody waits for is a suite nobody
 * runs. Where scale genuinely matters (a sequential scan is cheaper than an
 * index on a tiny table, so the planner picks it) the fixture is grown until
 * the planner has a real choice to make.
 */

const PAGE = 25;
/** Enough rows that the planner prefers an index over a sequential scan. */
const SCALE = 2_000;

let h: ContentTestHarness;
let categoryId = 0;

const editorial = (on: Context) => {
  const build = articleContent.editorialService;
  if (!build) throw new Error("example.article has no editorial service");

  return build(on, { pluginId: CONFIG_PLUGIN.pluginId });
};

const localizedService = (on: Context) => {
  const build = localizedArticleContent.localizedService;
  if (!build) throw new Error("no localized service");

  return build(on, { pluginId: CONFIG_PLUGIN.pluginId });
};

const translationEditorial = (on: Context) => {
  const build = localizedArticleContent.translationEditorialService;
  if (!build) throw new Error("no translation editorial service");

  return build(on, { pluginId: CONFIG_PLUGIN.pluginId });
};

/**
 * Bulk-inserts published articles straight through SQL.
 *
 * The service would write one row per statement and one revision alongside it,
 * which at this scale is minutes rather than seconds - and none of these tests
 * are about the write path.
 */
let seeded = 0;

const seedArticles = async (count: number): Promise<void> => {
  const from = seeded + 1;
  seeded += count;
  await h.sql`
    INSERT INTO "example_articles"
      ("title", "slug", "code", "category", "status", "publishedAt", "version")
    SELECT
      'Article ' || i,
      'article-' || i,
      'code-' || i,
      ${categoryId},
      'published',
      -- Ascending with the identifier, which is what a real collection looks
      -- like: rows are published roughly in the order they were created. The
      -- cursor is the identifier, so an order column that moves against it
      -- cannot page exactly - see the pagination docs.
      now() - ((100000 - i) || ' seconds')::interval,
      1
    FROM generate_series(${from}::int, ${seeded}::int) AS i
  `;
  await h.sql`ANALYZE "example_articles"`;
};

const plan = async (query: string): Promise<string> => {
  const rows = await h.sql.unsafe(`EXPLAIN ${query}`);

  return rows.map(row => String(row["QUERY PLAN"])).join("\n");
};

const indexesOn = async (table: string) =>
  await h.sql<{ indexdef: string; indexname: string }[]>`
    SELECT indexname, indexdef FROM pg_indexes WHERE tablename = ${table}
    ORDER BY indexname
  `;

/**
 * Statements the counted connection issued while `run` was in flight.
 *
 * The call is made **twice** and only the second is counted. `postgres`
 * prepares a statement the first time it sees its shape and reuses it
 * afterwards, so a cold call and a warm one legitimately issue different
 * numbers of protocol messages - and comparing a cold count against a warm one
 * would report a difference that has nothing to do with the query plan.
 */
const countQueries = async (run: () => Promise<unknown>): Promise<string[]> => {
  await run();
  h.counted.reset();
  await run();

  return [...h.counted.queries];
};

describe.skipIf(!DATABASE_TEST_URL)("Content Engine at scale", () => {
  beforeAll(async () => {
    h = await createContentTestHarness();
  }, 60_000);

  afterAll(async () => {
    await h?.end();
  });

  beforeEach(async () => {
    await clearContentTables(h.sql);
    h.reset();
    seeded = 0;

    const [category] = await h.sql<{ id: number }[]>`
      INSERT INTO "example_categories" ("name") VALUES ('Scale') RETURNING "id"
    `;
    categoryId = category.id;
  });

  // -------------------------------------------------------------------------
  // Cursor pagination
  // -------------------------------------------------------------------------

  describe("cursor pagination", () => {
    it("answers an empty collection without a cursor", async () => {
      const page = await articleContent.service(h.context).findMany();

      expect(page.edges).toEqual([]);
      expect(page.pageInfo).toMatchObject({
        endCursor: null,
        hasNextPage: false,
        startCursor: null,
        totalCount: 0,
      });
    });

    it("answers a single row without offering a next page", async () => {
      await seedArticles(1);

      const page = await articleContent.service(h.context).findMany();

      expect(page.edges).toHaveLength(1);
      expect(page.pageInfo.hasNextPage).toBe(false);
    });

    it("stops exactly at the page boundary", async () => {
      // The off-by-one that matters: with exactly `first` rows there is no next
      // page, and with one more there is.
      await seedArticles(PAGE);
      const exact = await articleContent
        .service(h.context)
        .findMany({ query: { first: String(PAGE) } });
      expect(exact.edges).toHaveLength(PAGE);
      expect(exact.pageInfo.hasNextPage).toBe(false);

      await seedArticles(1);
      const overflowing = await articleContent
        .service(h.context)
        .findMany({ query: { first: String(PAGE) } });
      expect(overflowing.pageInfo.hasNextPage).toBe(true);
    });

    it("walks every row exactly once across many pages", async () => {
      await seedArticles(103);
      const seen: number[] = [];
      let cursor: string | undefined;

      for (let page = 0; page < 20; page += 1) {
        const result = await articleContent.service(h.context).findMany({
          query: { cursor, first: String(PAGE) },
        });
        seen.push(...result.edges.map(row => row.id));
        if (!result.pageInfo.hasNextPage) break;
        cursor = String(result.pageInfo.endCursor);
      }

      expect(seen).toHaveLength(103);
      expect(new Set(seen).size).toBe(103);
    });

    it("never repeats a row because something was inserted between pages", async () => {
      // A cursor is a position in an ordering, not a snapshot. Rows that arrive
      // behind the cursor are simply not seen; the guarantee is that nothing
      // already returned comes back a second time.
      await seedArticles(60);
      const first = await articleContent
        .service(h.context)
        .findMany({ query: { first: String(PAGE) } });

      await seedArticles(10);

      const second = await articleContent.service(h.context).findMany({
        query: {
          cursor: String(first.pageInfo.endCursor),
          first: String(PAGE),
        },
      });

      const overlap = second.edges
        .map(row => row.id)
        .filter(id => first.edges.some(row => row.id === id));
      expect(overlap).toEqual([]);
    });

    it("does not loop forever when rows are deleted between pages", async () => {
      await seedArticles(60);
      const first = await articleContent
        .service(h.context)
        .findMany({ query: { first: String(PAGE) } });

      // The list is newest-first, so everything *after* the cursor has a
      // smaller identifier than it.
      await h.sql`
        DELETE FROM "example_articles"
        WHERE "id" < ${Number(first.pageInfo.endCursor)}
      `;

      const second = await articleContent.service(h.context).findMany({
        query: {
          cursor: String(first.pageInfo.endCursor),
          first: String(PAGE),
        },
      });

      expect(second.edges).toEqual([]);
      expect(second.pageInfo.hasNextPage).toBe(false);
    });

    it("caps a public page however large a caller asks for", async () => {
      // An anonymous caller controls `first`, so the ceiling has to be the
      // server's rather than theirs.
      await seedArticles(200);
      const service = articleContent.publicService;
      if (!service) throw new Error("no public service");

      const page = await service(h.context).findMany({
        query: { first: "10000" },
      });

      expect(page.edges.length).toBeLessThanOrEqual(100);
    });
  });

  // -------------------------------------------------------------------------
  // Query counts
  // -------------------------------------------------------------------------

  describe("query counts stay bounded per page", () => {
    /**
     * Upper bounds rather than exact numbers.
     *
     * A planner change, a different Postgres major or a Drizzle release can all
     * move the exact count by one without anything being wrong. What must never
     * move is the *shape*: a page of 25 and a page of 100 cost the same number
     * of round trips, and that is what an N+1 would break.
     */
    const boundedAcrossPageSizes = async (
      run: (size: number) => Promise<unknown>,
      bound: number,
    ) => {
      const small = await countQueries(async () => await run(5));
      const large = await countQueries(async () => await run(60));

      expect(small.length).toBeLessThanOrEqual(bound);
      expect(large.length).toBeLessThanOrEqual(bound);
      // The invariant an N+1 breaks: twelve times the rows, the same number of
      // statements.
      expect(large.length).toBe(small.length);
    };

    it("keeps the admin list bounded, labels included", async () => {
      await seedArticles(200);

      await boundedAcrossPageSizes(
        async size =>
          await articleContent
            .service(h.counted.context)
            .findMany({ query: { first: String(size) } }),
        4,
      );
    });

    it("keeps the public list bounded", async () => {
      await seedArticles(200);
      const service = articleContent.publicService;
      if (!service) throw new Error("no public service");

      await boundedAcrossPageSizes(
        async size =>
          await service(h.counted.context).findMany({
            query: { first: String(size) },
          }),
        4,
      );
    });

    it("keeps a localized public list bounded across languages", async () => {
      const service = localizedArticleContent.publicService;
      if (!service) throw new Error("no public service");
      const base = localizedArticleContent.editorialService;
      if (!base) throw new Error("no editorial service");

      for (let index = 0; index < 30; index += 1) {
        const { row } = await localizedService(h.context).create(
          {
            shared: {},
            translation: { body: `Body ${index}`, title: `Localized ${index}` },
          },
          { actor: ACTOR },
        );
        await translationEditorial(h.context).create(
          row.id,
          "pl",
          { body: `Tresc ${index}`, title: `Polski ${index}` },
          { actor: ACTOR },
        );
        await base(h.context, { pluginId: CONFIG_PLUGIN.pluginId }).publish(
          row.id,
          { actor: ACTOR },
        );
        await translationEditorial(h.context).publish(row.id, "en", {
          actor: ACTOR,
        });
        await translationEditorial(h.context).publish(row.id, "pl", {
          actor: ACTOR,
        });
      }

      await boundedAcrossPageSizes(
        async size =>
          await service(h.counted.context).findMany({
            locale: "pl",
            query: { first: String(size) },
          }),
        6,
      );
    });

    it("loads a page of advanced collections in batches, not per row", async () => {
      // The whole reason a to-many relation is absent from `ContentSelect`: a
      // list that carried one would issue a query per row.
      const service = advancedArticleContent.publicService;
      if (!service) throw new Error("no public service");
      const base = advancedArticleContent.editorialService;
      if (!base) throw new Error("no editorial service");
      const categories = await h.sql<{ id: number }[]>`
        INSERT INTO "example_categories" ("name")
        VALUES ('A'), ('B') RETURNING "id"
      `;
      const translations = advancedArticleContent.translationEditorialService;
      if (!translations) throw new Error("no translation editorial service");

      for (let index = 0; index < 20; index += 1) {
        const created = await base(h.context, {
          pluginId: CONFIG_PLUGIN.pluginId,
        }).create(
          { categories: categories.map(row => row.id) },
          {
            actor: ACTOR,
          },
        );
        await base(h.context, {
          pluginId: CONFIG_PLUGIN.pluginId,
        }).repeatable.faq.set(
          created.row.id,
          [
            { answer: "Answer one", question: `Question one ${index}` },
            { answer: "Answer two", question: `Question two ${index}` },
          ],
          { actor: ACTOR, expectedVersion: created.version },
        );
        await translations(h.context, {
          pluginId: CONFIG_PLUGIN.pluginId,
        }).create(
          created.row.id,
          "en",
          { title: `Advanced ${index}` },
          { actor: ACTOR },
        );
        await base(h.context, { pluginId: CONFIG_PLUGIN.pluginId }).publish(
          created.row.id,
          { actor: ACTOR },
        );
        await translations(h.context, {
          pluginId: CONFIG_PLUGIN.pluginId,
        }).publish(created.row.id, "en", { actor: ACTOR });
      }

      const small = await countQueries(
        async () =>
          await service(h.counted.context).findMany({
            locale: "en",
            query: { first: "3" },
          }),
      );
      const large = await countQueries(
        async () =>
          await service(h.counted.context).findMany({
            locale: "en",
            query: { first: "20" },
          }),
      );

      expect(large.length).toBe(small.length);
      // Two exposed collections - `categories` and `faq` - so two batch reads
      // for the whole page, however many rows are on it.
      expect(
        large.filter(query =>
          query.includes("example_advanced_articles_categories"),
        ),
      ).toHaveLength(1);
      expect(
        large.filter(query => query.includes("example_advanced_articles_faq")),
      ).toHaveLength(1);
    });

    it("fetches no collection the public projection does not expose", async () => {
      // `relatedArticles` is private on this content type, so a public read
      // must not touch its junction table at all - querying it to discard the
      // rows afterwards is work with no answer attached.
      const service = advancedArticleContent.publicService;
      if (!service) throw new Error("no public service");

      const queries = await countQueries(
        async () =>
          await service(h.counted.context).findMany({
            locale: "en",
            query: { first: "20" },
          }),
      );

      expect(
        queries.filter(query =>
          query.includes("example_advanced_articles_related_articles"),
        ),
      ).toEqual([]);
    });

    it("keeps a revision history page bounded", async () => {
      const created = await editorial(h.context).create(
        { category: categoryId, code: "history", title: "History subject" },
        { actor: ACTOR },
      );
      let version = created.version;
      for (let index = 0; index < 12; index += 1) {
        const outcome = await editorial(h.context).update(
          created.row.id,
          { title: `History subject ${index}` },
          { actor: ACTOR, expectedVersion: version },
        );
        version = outcome?.version ?? version;
      }

      const small = await countQueries(
        async () =>
          await editorial(h.counted.context).revisions.list(created.row.id, {
            limit: 2,
          }),
      );
      const large = await countQueries(
        async () =>
          await editorial(h.counted.context).revisions.list(created.row.id, {
            limit: 13,
          }),
      );

      expect(large.length).toBe(small.length);
      expect(large.length).toBeLessThanOrEqual(2);
    });
  });

  // -------------------------------------------------------------------------
  // Search rebuild
  // -------------------------------------------------------------------------

  describe("the search rebuild reads in batches", () => {
    it("keeps a page of the non-localized rebuild to a bounded number of queries", async () => {
      await seedArticles(200);
      const indexer = createContentSearchIndexer(articleContent, {
        pluginId: CONFIG_PLUGIN.pluginId,
      });

      const small = await countQueries(
        async () => await indexer.load(h.counted.context, 0, 5),
      );
      const large = await countQueries(
        async () => await indexer.load(h.counted.context, 0, 100),
      );

      expect(large.length).toBe(small.length);
      expect(large.length).toBeLessThanOrEqual(2);
    });

    it("loads a shared repeatable once for a page, not once per locale", async () => {
      // The localized rebuild emits one document per published translation, so
      // a record with three languages appears three times on a page. Its FAQ is
      // shared, and loading it three times would be an N+1 hiding behind a
      // correct result.
      const base = advancedArticleContent.editorialService;
      const translations = advancedArticleContent.translationEditorialService;
      if (!base || !translations) throw new Error("no editorial services");

      for (let index = 0; index < 5; index += 1) {
        const created = await base(h.context, {
          pluginId: CONFIG_PLUGIN.pluginId,
        }).create({}, { actor: ACTOR });
        await base(h.context, {
          pluginId: CONFIG_PLUGIN.pluginId,
        }).repeatable.faq.set(
          created.row.id,
          [{ answer: "Answer", question: `Question ${index}` }],
          { actor: ACTOR, expectedVersion: created.version },
        );
        for (const locale of ["en", "pl"] as const) {
          await translations(h.context, {
            pluginId: CONFIG_PLUGIN.pluginId,
          }).create(
            created.row.id,
            locale,
            { title: `Advanced ${locale} ${index}` },
            { actor: ACTOR },
          );
          await translations(h.context, {
            pluginId: CONFIG_PLUGIN.pluginId,
          }).publish(created.row.id, locale, { actor: ACTOR });
        }
        await base(h.context, { pluginId: CONFIG_PLUGIN.pluginId }).publish(
          created.row.id,
          { actor: ACTOR },
        );
      }

      const indexer = createContentLocalizedSearchIndexer(
        advancedArticleContent,
        { pluginId: CONFIG_PLUGIN.pluginId },
      );

      const queries = await countQueries(
        async () => await indexer.load(h.counted.context, 0, 50),
      );

      expect(
        queries.filter(query =>
          query.includes("example_advanced_articles_faq"),
        ),
      ).toHaveLength(1);
      expect(queries.length).toBeLessThanOrEqual(4);
    });

    it("pages the localized rebuild by translation, without repeating one", async () => {
      const base = localizedArticleContent.editorialService;
      if (!base) throw new Error("no editorial service");

      for (let index = 0; index < 6; index += 1) {
        const { row } = await localizedService(h.context).create(
          {
            shared: {},
            translation: { body: `Body ${index}`, title: `Paged ${index}` },
          },
          { actor: ACTOR },
        );
        await translationEditorial(h.context).create(
          row.id,
          "pl",
          { body: `Tresc ${index}`, title: `Polski ${index}` },
          { actor: ACTOR },
        );
        await base(h.context, { pluginId: CONFIG_PLUGIN.pluginId }).publish(
          row.id,
          { actor: ACTOR },
        );
        for (const locale of ["en", "pl"] as const) {
          await translationEditorial(h.context).publish(row.id, locale, {
            actor: ACTOR,
          });
        }
      }

      const indexer = createContentLocalizedSearchIndexer(
        localizedArticleContent,
        { pluginId: CONFIG_PLUGIN.pluginId },
      );
      const documents: SearchDocument[] = [];
      for (let offset = 0; ;) {
        const page = await indexer.load(h.context, offset, 4);
        if (page.itemsRead === 0) break;
        documents.push(...page.documents);
        offset += page.itemsRead;
      }

      const keys = documents.map(
        document => `${document.itemId}:${document.languageCode ?? ""}`,
      );
      expect(keys).toHaveLength(12);
      expect(new Set(keys).size).toBe(12);
      expect(await indexer.count?.(h.context)).toBe(12);
    });
  });

  // -------------------------------------------------------------------------
  // Indexes and plans
  // -------------------------------------------------------------------------

  describe("the generated indexes exist and are the ones the queries need", () => {
    it("indexes the slug uniquely", async () => {
      const indexes = await indexesOn("example_articles");
      const slug = indexes.find(entry => entry.indexname.includes("slug"));

      expect(slug?.indexdef).toContain("CREATE UNIQUE INDEX");
      expect(slug?.indexdef).toContain("slug");
    });

    it("indexes the publication predicate the public list orders by", async () => {
      const indexes = await indexesOn("example_articles");

      expect(
        indexes.some(
          entry =>
            entry.indexdef.includes("status") &&
            entry.indexdef.includes("publishedAt"),
        ),
      ).toBe(true);
    });

    it("indexes a revision history by record and version", async () => {
      const indexes = await indexesOn("core_content_revisions");

      expect(
        indexes.some(
          entry =>
            entry.indexname === "core_content_revisions_item_version_unique",
        ),
      ).toBe(true);
    });

    it("indexes a junction from both ends", async () => {
      const indexes = await indexesOn("example_advanced_articles_categories");

      // The primary key covers `(itemId, relatedItemId)`, which is what the
      // membership `EXISTS` seeks on; the second index covers the reverse
      // lookup, which Postgres does not create for a foreign key on its own.
      expect(indexes.some(entry => entry.indexname.endsWith("_pk"))).toBe(true);
      expect(
        indexes.some(entry => entry.indexname.endsWith("_related_item_id_idx")),
      ).toBe(true);
    });

    it("indexes a repeatable's position uniquely per parent", async () => {
      const indexes = await indexesOn("example_advanced_articles_faq");

      const position = indexes.find(entry =>
        entry.indexname.endsWith("_position_key"),
      );
      expect(position?.indexdef).toContain("CREATE UNIQUE INDEX");
      expect(position?.indexdef).toContain("position");
    });

    it("seeks rather than scans for a slug lookup", async () => {
      await seedArticles(SCALE);

      const explained = await plan(
        `SELECT "id" FROM "example_articles" WHERE "slug" = 'article-1234'`,
      );

      // A unique index over two thousand rows is not a close call for the
      // planner, which is why this one is safe to assert.
      expect(explained).toContain("Index");
      expect(explained).not.toContain("Seq Scan");
    });

    it("seeks rather than scans for a lookup by identifier", async () => {
      await seedArticles(SCALE);
      const [row] = await h.sql<{ id: number }[]>`
        SELECT "id" FROM "example_articles" LIMIT 1
      `;

      const explained = await plan(
        `SELECT "id" FROM "example_articles" WHERE "id" = ${row.id}`,
      );

      expect(explained).toContain("Index");
      expect(explained).not.toContain("Seq Scan");
    });

    it("seeks rather than scans for one record's revision history", async () => {
      await h.sql`
        INSERT INTO "core_content_revisions"
          ("pluginId", "contentTypeId", "itemId", "version", "operation", "snapshot")
        SELECT
          ${CONFIG_PLUGIN.pluginId}, 'example.article', i / 20 + 1,
          i % 20 + 1, 'update', '{}'::jsonb
        FROM generate_series(1, ${SCALE}::int) AS i
      `;
      await h.sql`ANALYZE "core_content_revisions"`;

      const explained = await plan(
        `SELECT "id" FROM "core_content_revisions"
         WHERE "contentTypeId" = 'example.article' AND "itemId" = 7
           AND "languageId" IS NULL
         ORDER BY "version" DESC LIMIT 25`,
      );

      expect(explained).not.toContain("Seq Scan");
    });
  });

  // -------------------------------------------------------------------------
  // Memory
  // -------------------------------------------------------------------------

  describe("reads stay page-bound", () => {
    it("never materialises more rows than the page asked for", async () => {
      // The property that keeps a large collection usable: a page is a page
      // whatever the table holds behind it.
      await seedArticles(SCALE);

      const page = await articleContent
        .service(h.context)
        .findMany({ query: { first: "25" } });

      expect(page.edges).toHaveLength(25);
      expect(page.pageInfo.totalCount).toBe(SCALE);
    });

    it("counts the whole collection without reading it", async () => {
      await seedArticles(SCALE);

      const queries = await countQueries(
        async () =>
          await articleContent
            .service(h.counted.context)
            .findMany({ query: { first: "5" } }),
      );

      // The count is an aggregate, not a fetch: no statement in the page's set
      // asks for every row.
      expect(queries.some(query => /count\(/i.test(query))).toBe(true);
      expect(queries.length).toBeLessThanOrEqual(4);
    });
  });
});
