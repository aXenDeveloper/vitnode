import type { SearchDocument } from "@vitnode/core/api/models/search";
import type { Context } from "hono";

import { executeContentSchedule } from "@vitnode/core/api/modules/content/helpers/execute-content-schedule";
import {
  contentEditorialEffects,
  contentEngineDiagnostics,
  contentSearchDrift,
  createContentLocalizedSearchIndexer,
  createContentSearchIndexer,
  runContentScheduleEffects,
  syncContentSearch,
} from "@vitnode/core/content/server";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { CONFIG_PLUGIN } from "@/const";
import { articleContentType } from "@/content/article";

import type { ContentTestHarness } from "./harness";

import { articleContent } from "./articles";
import {
  ACTOR,
  clearContentTables,
  createContentTestHarness,
  DATABASE_TEST_URL,
} from "./harness";
import { localizedArticleContent } from "./localized-articles";

/**
 * What happens to a **committed** mutation when the things it has to tell go
 * down.
 *
 * The rule the whole stage rests on: a database write that committed did commit.
 * No event transport, search engine or cache origin may undo it, and none of
 * them may make the engine report it as having failed. What they *may* do is
 * leave the announcement outstanding - and Stage 7's job is to make that
 * outstanding state visible and repairable rather than silent.
 *
 * The three downstream systems fail in different ways, so they are tested
 * separately and then together:
 *
 * | System   | Fails by                       | Repaired by                    |
 * | -------- | ------------------------------ | ------------------------------ |
 * | events   | reporting `failures`           | nothing - at-least-once        |
 * | search   | throwing from `index`/`delete` | the next write, or a rebuild   |
 * | cache    | an origin refusing the POST    | the effects task's own retry   |
 */

let h: ContentTestHarness;
let categoryId = 0;
let seq = 0;

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

const article = async () => {
  seq += 1;
  const outcome = await editorial(h.context).create(
    {
      category: categoryId,
      code: `resilient-${seq}`,
      title: `Resilient subject ${seq}`,
    },
    { actor: ACTOR },
  );

  return { id: outcome.row.id, version: outcome.version };
};

const rowOf = async (id: number) => {
  const [row] = await h.sql<
    { publishedAt: Date | null; status: string; version: number }[]
  >`
    SELECT "status", "publishedAt", "version" FROM "example_articles"
    WHERE "id" = ${id}
  `;

  return row;
};

/** A published article, ready for the index. */
const published = async () => {
  const created = await article();
  const outcome = await editorial(h.context).publish(created.id, {
    actor: ACTOR,
  });

  return { id: created.id, version: outcome?.version ?? created.version };
};

/**
 * Writes the canonical index rows a healthy install would hold.
 *
 * Shared, because "search is fine" is the baseline several tests need before
 * they can say anything about a *different* dimension of health.
 */
const indexPublished = async (): Promise<void> => {
  const rows = await h.sql<{ id: number; title: string }[]>`
    SELECT "id", "title" FROM "example_articles"
    WHERE "status" = 'published' AND "publishedAt" IS NOT NULL
  `;
  for (const row of rows) {
    await h.sql`
      INSERT INTO "core_search_index"
        ("pluginId", "itemType", "itemId", "languageCode", "title", "content", "createdAt")
      VALUES (
        ${CONFIG_PLUGIN.pluginId}, ${articleContentType.id}, ${row.id},
        '', ${row.title}, ${row.title}, now()
      )
    `;
  }
};

const DEAD_LISTENER = {
  error: "Service unavailable",
  listener: "send-notification",
  module: "notifications",
  pluginId: CONFIG_PLUGIN.pluginId,
};

describe.skipIf(!DATABASE_TEST_URL)("Content Engine failure resilience", () => {
  beforeAll(async () => {
    h = await createContentTestHarness();
  }, 60_000);

  afterAll(async () => {
    await h?.end();
    vi.unstubAllGlobals();
  });

  beforeEach(async () => {
    await clearContentTables(h.sql);
    h.reset();
    // A web origin that accepts everything, by default. `originsFor` falls back
    // to `NEXT_PUBLIC_WEB_URL` when none is configured, so without this the
    // bridge would try to reach a real host and every scheduled run would fail
    // on the cache rather than on the thing under test.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => await Promise.resolve(new Response("ok", { status: 200 })),
      ),
    );

    const [category] = await h.sql<{ id: number }[]>`
      INSERT INTO "example_categories" ("name") VALUES ('Resilience')
      RETURNING "id"
    `;
    categoryId = category.id;
  });

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  describe("a dead event listener", () => {
    it("leaves the write committed and reports the failure", async () => {
      h.behaviour.eventFailures = [DEAD_LISTENER];
      const { id, version } = await published();

      const outcome = await editorial(h.context).update(
        id,
        { title: "Edited despite the outage" },
        { actor: ACTOR, expectedVersion: version },
      );
      if (!outcome) throw new Error("Expected an outcome.");

      const result = await contentEditorialEffects(
        h.context,
        articleContentType,
        outcome,
        { model: articleContent, pluginId: CONFIG_PLUGIN.pluginId },
      );

      // Committed, and readable.
      expect((await rowOf(id)).version).toBe(version + 1);
      // Visible, rather than swallowed.
      expect(result.event?.failures).toHaveLength(1);
      expect(h.logs.some(line => line.includes("[content-effects]"))).toBe(
        true,
      );
      expect(h.logs.join("\n")).toContain("send-notification");
    });

    it("still writes the search document", async () => {
      // Two independent systems: one being down is not a reason to skip the
      // other, and by the time either runs the row is already committed.
      h.behaviour.eventFailures = [DEAD_LISTENER];
      const { id, version } = await published();

      const outcome = await editorial(h.context).update(
        id,
        { title: "Still indexed" },
        { actor: ACTOR, expectedVersion: version },
      );
      if (!outcome) throw new Error("Expected an outcome.");

      await contentEditorialEffects(h.context, articleContentType, outcome, {
        model: articleContent,
        pluginId: CONFIG_PLUGIN.pluginId,
      });

      expect(h.indexed.map(document => document.itemId)).toContain(id);
    });

    it("logs nothing when every listener received it", async () => {
      const { id, version } = await published();
      const outcome = await editorial(h.context).update(
        id,
        { title: "Quiet" },
        { actor: ACTOR, expectedVersion: version },
      );
      if (!outcome) throw new Error("Expected an outcome.");

      await contentEditorialEffects(h.context, articleContentType, outcome, {
        model: articleContent,
        pluginId: CONFIG_PLUGIN.pluginId,
      });

      expect(h.logs.filter(line => line.includes("[content-effects]"))).toEqual(
        [],
      );
    });
  });

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

  describe("a search engine that is down", () => {
    it("never rolls the database write back", async () => {
      const { id, version } = await published();
      h.behaviour.searchError = new Error("elasticsearch unreachable");

      const outcome = await editorial(h.context).update(
        id,
        { title: "Written while search was down" },
        { actor: ACTOR, expectedVersion: version },
      );

      expect(outcome?.changed).toBe(true);
      const [row] = await h.sql<{ title: string }[]>`
        SELECT "title" FROM "example_articles" WHERE "id" = ${id}
      `;
      expect(row.title).toBe("Written while search was down");
    });

    it("reports the failure on the outcome and in the log", async () => {
      const { id } = await published();
      h.behaviour.searchError = new Error("elasticsearch unreachable");

      const result = await syncContentSearch(h.context, articleContentType, {
        changedFields: ["title"],
        operation: "update",
        pluginId: CONFIG_PLUGIN.pluginId,
        row: { ...(await rowOf(id)), id, slug: "x", title: "T" },
      });

      expect(result.error?.message).toBe("elasticsearch unreachable");
      expect(h.logs.some(line => line.includes("[content-search]"))).toBe(true);
    });

    it("is repaired by the next successful write", async () => {
      // "Eventually consistent, bounded by the next publish or the next
      // rebuild" - the first half of that, shown.
      const { id, version } = await published();
      h.behaviour.searchError = new Error("down");

      const first = await editorial(h.context).update(
        id,
        { title: "Lost to the outage" },
        { actor: ACTOR, expectedVersion: version },
      );
      await syncContentSearch(h.context, articleContentType, {
        changedFields: first?.changedFields,
        operation: "update",
        pluginId: CONFIG_PLUGIN.pluginId,
        row: first?.row ?? {},
      });
      expect(h.indexed).toHaveLength(0);

      h.behaviour.searchError = null;
      const second = await editorial(h.context).update(
        id,
        { title: "Recovered" },
        { actor: ACTOR, expectedVersion: first?.version ?? version },
      );
      await syncContentSearch(h.context, articleContentType, {
        changedFields: second?.changedFields,
        operation: "update",
        pluginId: CONFIG_PLUGIN.pluginId,
        row: second?.row ?? {},
      });

      expect(h.indexed.at(-1)?.title).toBe("Recovered");
    });
  });

  // -------------------------------------------------------------------------
  // Scheduled effects, where all three meet
  // -------------------------------------------------------------------------

  describe("scheduled effects", () => {
    const schedules = (on: Context) => {
      const model = editorial(on).schedules;
      if (!model) throw new Error("example.article has no scheduling");

      return model;
    };

    /** Books a publish that is already due, runs it, and returns the payload. */
    const runTransition = async () => {
      const created = await article();
      const booked = await schedules(h.context).schedule({
        action: "publish",
        actorUserId: null,
        itemId: created.id,
        scheduledFor: new Date(Date.now() - 1000),
      });

      await executeContentSchedule(h.context, {
        generation: booked.generation,
        scheduleId: booked.id,
      });

      const [queued] = await h.sql<{ payload: Record<string, unknown> }[]>`
        SELECT "payload" FROM "core_queue"
        WHERE "name" = 'content-schedule-effects'
        ORDER BY "id" DESC LIMIT 1
      `;

      return {
        id: created.id,
        payload: queued.payload as Parameters<
          typeof runContentScheduleEffects
        >[1],
        scheduleId: booked.id,
      };
    };

    const effectsErrorOf = async (scheduleId: number) => {
      const [row] = await h.sql<{ effectsError: null | string }[]>`
        SELECT "effectsError" FROM "core_content_schedules"
        WHERE "id" = ${scheduleId}
      `;

      return row.effectsError;
    };

    it("delivers everything on a healthy run and records no error", async () => {
      const { payload, scheduleId } = await runTransition();

      const outcome = await runContentScheduleEffects(h.context, payload);

      expect(outcome.status).toBe("delivered");
      expect(await effectsErrorOf(scheduleId)).toBeNull();
      expect(h.emitted.map(entry => entry.name)).toContain(
        "content.example.article.published",
      );
    });

    it("fails the run and records why when the event transport reports a failure", async () => {
      const { payload, scheduleId } = await runTransition();
      h.behaviour.eventFailures = [DEAD_LISTENER];

      await expect(
        runContentScheduleEffects(h.context, payload),
      ).rejects.toThrow(/committed, but its effects did not/);

      const error = await effectsErrorOf(scheduleId);
      expect(error).toContain("event:");
      expect(error).toContain("send-notification");
    });

    it("fails the run when the search write is refused", async () => {
      const { payload, scheduleId } = await runTransition();
      h.behaviour.searchError = new Error("index refused");

      await expect(
        runContentScheduleEffects(h.context, payload),
      ).rejects.toThrow();

      expect(await effectsErrorOf(scheduleId)).toContain("search:");
    });

    it("reports every outstanding failure, not just the first", async () => {
      // The whole point of combining them: an operator looking at one line has
      // to see everything that is still outstanding, or they will fix one
      // system, retry, and discover the next.
      const { payload, scheduleId } = await runTransition();
      h.behaviour.eventFailures = [DEAD_LISTENER];
      h.behaviour.searchError = new Error("index refused");
      h.behaviour.revalidateOrigins = ["http://web-a.invalid"];
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            await Promise.resolve(new Response("no", { status: 500 })),
        ),
      );

      await expect(
        runContentScheduleEffects(h.context, payload),
      ).rejects.toThrow();

      const error = await effectsErrorOf(scheduleId);
      expect(error).toContain("event:");
      expect(error).toContain("search:");
      expect(error).toContain("cache:");
    });

    it("treats a partial cache delivery as a failure, not a success", async () => {
      // Two web apps behind one API: one of them accepting an unpublish while
      // the other does not leaves the withdrawn page cached and readable.
      const { payload, scheduleId } = await runTransition();
      h.behaviour.revalidateOrigins = [
        "http://web-a.invalid",
        "http://web-b.invalid",
      ];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: string | URL) => {
          const url = input instanceof URL ? input.href : input;

          return await Promise.resolve(
            url.includes("web-a")
              ? new Response("ok", { status: 200 })
              : new Response("no", { status: 500 }),
          );
        }),
      );

      await expect(
        runContentScheduleEffects(h.context, payload),
      ).rejects.toThrow();

      expect(await effectsErrorOf(scheduleId)).toContain(
        "1/2 web origins accepted",
      );
    });

    it("never re-runs the transition when the effects are retried", async () => {
      const { id, payload, scheduleId } = await runTransition();
      const before = await rowOf(id);

      h.behaviour.searchError = new Error("index refused");
      await expect(
        runContentScheduleEffects(h.context, payload),
      ).rejects.toThrow();

      h.behaviour.searchError = null;
      const retried = await runContentScheduleEffects(h.context, payload);

      expect(retried.status).toBe("delivered");
      // Same version, same publication timestamp: the retry announced the
      // transition again, it did not perform it again.
      expect(await rowOf(id)).toEqual(before);
      expect(await effectsErrorOf(scheduleId)).toBeNull();

      const revisions = await h.sql<{ id: number }[]>`
        SELECT "id" FROM "core_content_revisions"
        WHERE "itemId" = ${id} AND "operation" = 'publish'
      `;
      expect(revisions).toHaveLength(1);
    });

    it("re-emits the event on a retry, which is why delivery is at-least-once", async () => {
      const { payload } = await runTransition();

      h.behaviour.searchError = new Error("index refused");
      await expect(
        runContentScheduleEffects(h.context, payload),
      ).rejects.toThrow();

      h.behaviour.searchError = null;
      await runContentScheduleEffects(h.context, payload);

      const published = h.emitted.filter(
        entry => entry.name === "content.example.article.published",
      );
      // Twice, with the same `scheduleId` both times - which is the key a
      // listener that must act once uses. There is no outbox and no
      // exactly-once claim.
      expect(published).toHaveLength(2);
      expect(
        published.map(
          entry => (entry.payload as { scheduleId: number }).scheduleId,
        ),
      ).toEqual([payload.scheduleId, payload.scheduleId]);
    });

    it("indexes the same document on a retry, so the repeat is harmless", async () => {
      const { payload } = await runTransition();

      h.behaviour.eventFailures = [DEAD_LISTENER];
      await expect(
        runContentScheduleEffects(h.context, payload),
      ).rejects.toThrow();
      const first = h.indexed.at(-1);

      h.behaviour.eventFailures = [];
      await runContentScheduleEffects(h.context, payload);
      const second = h.indexed.at(-1);

      // An upsert is the same operation however many times it runs, and the
      // document it writes is byte-identical.
      expect(second).toEqual(first);
    });

    it("gives up rather than retrying forever when the content type is gone", async () => {
      const { payload, scheduleId } = await runTransition();

      const outcome = await runContentScheduleEffects(h.context, {
        ...payload,
        contentTypeId: "example.removed-by-an-uninstall",
      });

      expect(outcome.status).toBe("unregistered");
      expect(await effectsErrorOf(scheduleId)).toContain(
        "no longer registered",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Idempotency
  // -------------------------------------------------------------------------

  describe("idempotency", () => {
    it("makes a second publish a no-op with no revision and no event", async () => {
      const { id } = await published();
      h.reset();

      const outcome = await editorial(h.context).publish(id, { actor: ACTOR });
      await contentEditorialEffects(
        h.context,
        articleContentType,
        outcome ?? ({} as never),
        { model: articleContent, pluginId: CONFIG_PLUGIN.pluginId },
      );

      expect(outcome?.changed).toBe(false);
      expect(outcome?.revisionId).toBeNull();
      expect(h.emitted).toEqual([]);
      expect(h.indexed).toEqual([]);
    });

    it("makes a second unpublish a no-op", async () => {
      const { id } = await published();
      await editorial(h.context).unpublish(id, { actor: ACTOR });
      const before = await rowOf(id);
      h.reset();

      const outcome = await editorial(h.context).unpublish(id, {
        actor: ACTOR,
      });

      expect(outcome?.changed).toBe(false);
      expect(await rowOf(id)).toEqual(before);
      expect(h.emitted).toEqual([]);
    });

    it("makes a restore to the values already stored a no-op", async () => {
      const created = await article();
      const history = await editorial(h.context).revisions.list(created.id);
      const only = history.edges[0];

      const outcome = await editorial(h.context).restore(created.id, only.id, {
        actor: ACTOR,
        expectedVersion: created.version,
      });

      expect(outcome?.changed).toBe(false);
      expect(outcome?.revisionId).toBeNull();
      expect((await rowOf(created.id)).version).toBe(created.version);
    });

    it("bumps no version for a relation add that is already there", async () => {
      const created = await article();

      const outcome = await editorial(h.context).update(
        created.id,
        { title: `Resilient subject ${seq}` },
        { actor: ACTOR, expectedVersion: created.version },
      );

      expect(outcome?.changed).toBe(false);
      expect((await rowOf(created.id)).version).toBe(created.version);
    });
  });

  // -------------------------------------------------------------------------
  // Search consistency
  // -------------------------------------------------------------------------

  describe("live synchronisation and rebuild agree", () => {
    const indexer = () =>
      createContentSearchIndexer(articleContent, {
        pluginId: CONFIG_PLUGIN.pluginId,
      });

    const rebuild = async (limit = 50): Promise<SearchDocument[]> => {
      const documents: SearchDocument[] = [];
      const build = indexer();
      for (let offset = 0; ;) {
        const page = await build.load(h.context, offset, limit);
        if (page.itemsRead === 0) break;
        documents.push(...page.documents);
        offset += page.itemsRead;
      }

      return documents;
    };

    it("reproduces the live document byte for byte", async () => {
      const created = await article();
      const outcome = await editorial(h.context).publish(created.id, {
        actor: ACTOR,
      });
      // The live path is the effects layer, not the transition: publishing
      // writes the row, and the announcement writes the document.
      await contentEditorialEffects(
        h.context,
        articleContentType,
        outcome ?? ({} as never),
        { model: articleContent, pluginId: CONFIG_PLUGIN.pluginId },
      );
      const id = created.id;
      const live = h.indexed.find(document => document.itemId === id);
      expect(live).toBeDefined();

      // The live path indexes on publish; the rebuild reads the same row
      // through a different query. Equality is the invariant.
      const rebuilt = (await rebuild()).find(
        document => document.itemId === id,
      );

      expect(rebuilt).toEqual(live);
    });

    it("pages a rebuild without skipping or repeating a record", async () => {
      const ids: number[] = [];
      for (let index = 0; index < 7; index += 1) {
        const { id } = await published();
        ids.push(id);
      }

      const documents = await rebuild(2);

      const ascending = (a: number, b: number) => a - b;
      expect(
        documents.map(document => document.itemId).sort(ascending),
      ).toEqual([...ids].sort(ascending));
      expect(new Set(documents.map(document => document.itemId)).size).toBe(
        ids.length,
      );
    });

    /**
     * The rebuild walks by key, not by offset.
     *
     * `OFFSET` counts rows in a set that is *moving*: a record unpublished after
     * page one shifts everything behind it forward by one, and the next
     * `OFFSET 100` steps straight over a row nobody ever indexed. A rebuild that
     * silently misses rows is the failure a rebuild exists to fix.
     */
    describe("while the collection changes underneath it", () => {
      /** Reads one page at a time so the fixture can mutate between them. */
      const pager = () => {
        const build = indexer();
        let offset = 0;

        return async (limit: number) => {
          const page = await build.load(h.context, offset, limit);
          offset += page.itemsRead;

          return page;
        };
      };

      it("visits every remaining row when an already-read one is unpublished", async () => {
        // The regression, exactly: page one is read, one of *its* rows goes
        // away, and the walk continues. With `OFFSET` the next page would start
        // one row too far in and skip an untouched record forever.
        const ids: number[] = [];
        for (let index = 0; index < 10; index += 1) {
          const { id } = await published();
          ids.push(id);
        }

        const next = pager();
        const first = await next(5);
        expect(first.itemsRead).toBe(5);

        // A row from the page just read is withdrawn.
        await h.sql`
          UPDATE "example_articles" SET "status" = 'draft'
          WHERE "id" = ${ids[2]}
        `;

        const seen = first.documents.map(document => document.itemId);
        for (let page = 0; page < 10; page += 1) {
          const result = await next(5);
          if (result.itemsRead === 0) break;
          seen.push(...result.documents.map(document => document.itemId));
        }

        // Every row, exactly once. The withdrawn one is in there because page
        // one had already read it - the live unpublish is what removes its
        // document, and that is a different mechanism. What matters here is
        // that nothing *else* moved: with `OFFSET` the shift would have stepped
        // over an untouched record and lost it for the whole rebuild.
        expect(seen.sort((a, b) => a - b)).toEqual(
          [...ids].sort((a, b) => a - b),
        );
        expect(new Set(seen).size).toBe(ids.length);
      });

      it("simply never reaches a row unpublished before it got there", async () => {
        const ids: number[] = [];
        for (let index = 0; index < 10; index += 1) {
          const { id } = await published();
          ids.push(id);
        }

        const next = pager();
        await next(4);

        // Withdrawn while it is still ahead of the cursor.
        await h.sql`
          UPDATE "example_articles" SET "status" = 'draft'
          WHERE "id" = ${ids[8]}
        `;

        const seen: number[] = [];
        for (let page = 0; page < 10; page += 1) {
          const result = await next(4);
          if (result.itemsRead === 0) break;
          seen.push(...result.documents.map(document => document.itemId));
        }

        expect(seen).not.toContain(ids[8]);
        // And nothing near it was disturbed.
        expect(seen).toContain(ids[9]);
        expect(seen).toContain(ids[7]);
      });

      /**
       * A row published mid-rebuild with a **higher** identifier is picked up by
       * the same pass, because the cursor has not reached it yet. One with a
       * lower identifier is not - the walk is already past that point.
       *
       * That is the honest consequence of a keyset walk, and it is stated here
       * rather than described as a snapshot: a rebuild is not one.
       */
      it("picks up a row published ahead of the cursor, and not one behind it", async () => {
        const ids: number[] = [];
        for (let index = 0; index < 6; index += 1) {
          const { id } = await published();
          ids.push(id);
        }

        const next = pager();
        const first = await next(3);
        expect(first.itemsRead).toBe(3);

        // One behind the cursor, one ahead of it.
        const behind = await article();
        await h.sql`
          UPDATE "example_articles"
          SET "status" = 'published', "publishedAt" = now(), "id" = ${ids[0] - 1}
          WHERE "id" = ${behind.id}
        `;
        const ahead = await published();

        const seen: number[] = [];
        for (let page = 0; page < 10; page += 1) {
          const result = await next(3);
          if (result.itemsRead === 0) break;
          seen.push(...result.documents.map(document => document.itemId));
        }

        expect(seen).toContain(ahead.id);
        expect(seen).not.toContain(ids[0] - 1);
      });

      it("issues no SQL OFFSET at all", async () => {
        // The property, asserted against the statements the driver really sent.
        await published();
        await published();
        await published();

        const build = createContentSearchIndexer(articleContent, {
          pluginId: CONFIG_PLUGIN.pluginId,
        });

        h.counted.reset();
        let offset = 0;
        for (let page = 0; page < 5; page += 1) {
          const result = await build.load(h.counted.context, offset, 2);
          if (result.itemsRead === 0) break;
          offset += result.itemsRead;
        }

        expect(h.counted.queries).not.toHaveLength(0);
        expect(
          h.counted.queries.filter(query => /\boffset\b/i.test(query)),
        ).toEqual([]);
        // And it does seek by key instead.
        expect(
          h.counted.queries.some(query => /"id"\s*>\s*\$/.test(query)),
        ).toBe(true);
      });

      it("restarts from the beginning when a fresh rebuild begins", async () => {
        // `offset === 0` is the contract's only "this is a new pass" signal.
        const ids: number[] = [];
        for (let index = 0; index < 4; index += 1) {
          const { id } = await published();
          ids.push(id);
        }

        const build = indexer();
        await build.load(h.context, 0, 2);
        await build.load(h.context, 2, 2);

        const restarted = await build.load(h.context, 0, 2);

        expect(restarted.documents.map(document => document.itemId)).toEqual(
          ids.slice(0, 2),
        );
      });
    });

    it("counts exactly the records it would index", async () => {
      await published();
      await published();
      await article(); // a draft, which is never indexed

      expect(await indexer().count?.(h.context)).toBe(2);
      expect(await rebuild()).toHaveLength(2);
    });
  });

  describe("stale documents are cleaned up", () => {
    it("removes a record's document when it is unpublished", async () => {
      const { id, version } = await published();
      h.reset();

      const outcome = await editorial(h.context).unpublish(id, {
        actor: ACTOR,
        expectedVersion: version,
      });
      await contentEditorialEffects(
        h.context,
        articleContentType,
        outcome ?? ({} as never),
        { model: articleContent, pluginId: CONFIG_PLUGIN.pluginId },
      );

      expect(h.deleted).toContainEqual({
        itemId: id,
        itemType: articleContentType.id,
        locale: undefined,
      });
    });

    it("removes it when the record is deleted", async () => {
      const { id, version } = await published();
      h.reset();

      const outcome = await editorial(h.context).delete(id, {
        actor: ACTOR,
        expectedVersion: version,
      });
      await contentEditorialEffects(
        h.context,
        articleContentType,
        outcome ?? ({} as never),
        { model: articleContent, pluginId: CONFIG_PLUGIN.pluginId },
      );

      expect(h.deleted.map(entry => entry.itemId)).toContain(id);
    });

    it("removes only the language a translation was taken down in", async () => {
      const { row } = await localizedService(h.context).create(
        {
          shared: {},
          translation: { body: "English body", title: "Stale Cleanup" },
        },
        { actor: ACTOR },
      );
      await translationEditorial(h.context).create(
        row.id,
        "pl",
        { body: "Tresc", title: "Polski" },
        { actor: ACTOR },
      );
      const base = localizedArticleContent.editorialService;
      if (!base) throw new Error("no editorial service");
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
      h.reset();

      const outcome = await translationEditorial(h.context).unpublish(
        row.id,
        "pl",
        { actor: ACTOR },
      );
      const { contentTranslationEffects } =
        await import("@vitnode/core/content/server");
      await contentTranslationEffects(
        h.context,
        localizedArticleContent.definition,
        outcome ?? ({} as never),
        {
          model: localizedArticleContent,
          pluginId: CONFIG_PLUGIN.pluginId,
        },
      );

      // One language out, the other left exactly where it was.
      expect(h.deleted).toEqual([
        {
          itemId: row.id,
          itemType: localizedArticleContent.definition.id,
          locale: "pl",
        },
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // Drift diagnostics
  // -------------------------------------------------------------------------

  describe("index drift is diagnosable", () => {
    it("reports a healthy index as healthy", async () => {
      await published();
      await published();
      await indexPublished();

      const drift = await contentSearchDrift(h.context, {
        model: articleContent,
      });

      expect(drift).toMatchObject({
        canonicalHealthy: true,
        canonicalIndexedTotal: 2,
        contentTypeId: articleContentType.id,
        expectedTotal: 2,
        healthy: true,
      });
      expect(drift.provider.indexedTotal).toBe(2);
      expect(drift.locales).toEqual([
        {
          canonicalHealthy: true,
          canonicalIndexed: 2,
          expected: 2,
          locale: "",
          providerHealthy: true,
          providerIndexed: 2,
        },
      ]);
    });

    it("reports the bundled provider as verified without counting twice", async () => {
      // Its store *is* `core_search_index`, so the canonical counts are its
      // counts - asking the same table again would cost a query to learn
      // something already known.
      await published();
      await indexPublished();

      const drift = await contentSearchDrift(h.context, {
        model: articleContent,
      });

      expect(drift.provider).toEqual({
        healthy: true,
        // Reused from the canonical count rather than queried again.
        indexedTotal: 1,
        name: "postgres",
        verified: true,
      });
    });

    it("reports a document the index never received", async () => {
      await published();
      await published();
      await indexPublished();
      // A live sync that threw, simulated at the row level.
      await h.sql`DELETE FROM "core_search_index" WHERE "id" = (
        SELECT MIN("id") FROM "core_search_index"
      )`;

      const drift = await contentSearchDrift(h.context, {
        model: articleContent,
      });

      expect(drift.healthy).toBe(false);
      expect(drift.canonicalHealthy).toBe(false);
      expect(drift.locales[0]).toMatchObject({
        canonicalIndexed: 1,
        expected: 2,
      });
    });

    it("reports a document that outlived its record", async () => {
      await published();
      await indexPublished();
      await h.sql`
        INSERT INTO "core_search_index"
          ("pluginId", "itemType", "itemId", "languageCode", "title", "content", "createdAt")
        VALUES (
          ${CONFIG_PLUGIN.pluginId}, ${articleContentType.id}, 999999,
          '', 'Ghost', 'Ghost', now()
        )
      `;

      const drift = await contentSearchDrift(h.context, {
        model: articleContent,
      });

      // More documents than records is drift in the other direction, and it is
      // reported as measured rather than clamped - a stale document is exactly
      // what an operator needs to see.
      expect(drift.healthy).toBe(false);
      expect(drift.locales[0]).toMatchObject({
        canonicalIndexed: 2,
        expected: 1,
      });
    });

    /**
     * The regression the whole provider split exists for.
     *
     * `SearchModel.index` writes the canonical row and *then* hands the document
     * to the provider. An Elasticsearch that refuses the second half leaves a
     * canonical table that is perfectly correct and a search box that is missing
     * results - and a diagnostic that only ever looked at the canonical table
     * would call that healthy.
     */
    it("reports the provider unhealthy when only the provider is missing a document", async () => {
      await published();
      await published();
      await indexPublished();

      h.behaviour.providerName = "elasticsearch";
      h.behaviour.providerCounts = { byLocale: new Map([["", 1]]), total: 1 };

      const drift = await contentSearchDrift(h.context, {
        model: articleContent,
      });

      expect(drift.canonicalHealthy).toBe(true);
      expect(drift.locales[0]).toMatchObject({
        canonicalHealthy: true,
        canonicalIndexed: 2,
        expected: 2,
        providerHealthy: false,
        providerIndexed: 1,
      });
      expect(drift.provider).toMatchObject({
        healthy: false,
        name: "elasticsearch",
        verified: true,
      });
      // The part that used to be wrong: a healthy canonical table is not a
      // healthy search.
      expect(drift.healthy).toBe(false);
    });

    /**
     * The other direction, and the one per-locale counts cannot see.
     *
     * Deletion runs canonical-first: `SearchModel.delete` removes the row and
     * then asks the provider. If the provider's half fails, the document
     * survives in a locale that no longer appears in the database *or* the
     * canonical table - so the locale list, which is built from those two, never
     * thinks to ask about it. Only an unfiltered total can find it.
     */
    describe("a document that exists only in the provider", () => {
      it("is caught on a content type with nothing in it at all", async () => {
        // The empty case matters on its own: a localized content type with no
        // published translations enumerates *no* locales, so `[].every(...)` is
        // `true` and a ghost would sail straight through on the per-locale
        // checks alone.
        h.behaviour.providerName = "elasticsearch";
        h.behaviour.providerCounts = { byLocale: new Map(), total: 1 };

        const drift = await contentSearchDrift(h.context, {
          model: localizedArticleContent,
        });

        expect(drift.locales).toEqual([]);
        expect(drift.expectedTotal).toBe(0);
        expect(drift.canonicalIndexedTotal).toBe(0);
        expect(drift.canonicalHealthy).toBe(true);
        expect(drift.provider).toMatchObject({
          healthy: false,
          indexedTotal: 1,
          verified: true,
        });
        expect(drift.healthy).toBe(false);
      });

      it("is caught on a non-localized content type with no rows either", async () => {
        // Here one locale *is* enumerated - the empty one - and it agrees on
        // both sides. The total is still the thing that catches the ghost.
        h.behaviour.providerName = "elasticsearch";
        h.behaviour.providerCounts = { byLocale: new Map(), total: 1 };

        const drift = await contentSearchDrift(h.context, {
          model: articleContent,
        });

        expect(drift.locales).toEqual([
          {
            canonicalHealthy: true,
            canonicalIndexed: 0,
            expected: 0,
            locale: "",
            providerHealthy: true,
            providerIndexed: 0,
          },
        ]);
        expect(drift.provider).toMatchObject({
          healthy: false,
          indexedTotal: 1,
        });
        expect(drift.healthy).toBe(false);
      });

      it("is caught when every locale it does enumerate agrees", async () => {
        // The proof that the total is doing the work: `""` matches on both
        // sides, so per-locale parity is perfect and the total is not.
        await published();
        await indexPublished();

        h.behaviour.providerName = "elasticsearch";
        h.behaviour.providerCounts = {
          byLocale: new Map([["", 1]]),
          total: 2,
        };

        const drift = await contentSearchDrift(h.context, {
          model: articleContent,
        });

        expect(drift.locales).toEqual([
          {
            canonicalHealthy: true,
            canonicalIndexed: 1,
            expected: 1,
            locale: "",
            providerHealthy: true,
            providerIndexed: 1,
          },
        ]);
        expect(drift.canonicalHealthy).toBe(true);
        expect(drift.provider).toMatchObject({
          healthy: false,
          indexedTotal: 2,
        });
        expect(drift.healthy).toBe(false);
      });

      it("is caught in a locale the content type no longer has", async () => {
        // EN is published and agrees everywhere. PL exists only in the
        // provider - no translation, no canonical row, no expectation - so it
        // is never enumerated, and the total is the only thing that sees it.
        const { row } = await localizedService(h.context).create(
          {
            shared: {},
            translation: { body: "English body", title: "Ghost Subject" },
          },
          { actor: ACTOR },
        );
        const base = localizedArticleContent.editorialService;
        if (!base) throw new Error("no editorial service");
        await base(h.context, { pluginId: CONFIG_PLUGIN.pluginId }).publish(
          row.id,
          { actor: ACTOR },
        );
        await translationEditorial(h.context).publish(row.id, "en", {
          actor: ACTOR,
        });
        await h.sql`
          INSERT INTO "core_search_index"
            ("pluginId", "itemType", "itemId", "languageCode", "title", "content", "createdAt")
          VALUES (
            ${CONFIG_PLUGIN.pluginId}, ${localizedArticleContent.definition.id},
            ${row.id}, 'en', 'Ghost Subject', 'Ghost Subject', now()
          )
        `;

        h.behaviour.providerName = "elasticsearch";
        h.behaviour.providerCounts = {
          // Only `en` is ever asked for, and it agrees.
          byLocale: new Map([["en", 1]]),
          total: 2,
        };

        const drift = await contentSearchDrift(h.context, {
          model: localizedArticleContent,
        });

        expect(drift.locales.map(entry => entry.locale)).toEqual(["en"]);
        expect(drift.locales[0].providerHealthy).toBe(true);
        expect(drift.canonicalHealthy).toBe(true);
        expect(drift.expectedTotal).toBe(1);
        expect(drift.provider.indexedTotal).toBe(2);
        expect(drift.provider.healthy).toBe(false);
        expect(drift.healthy).toBe(false);
      });

      it("makes the whole engine report unhealthy", async () => {
        h.behaviour.providerName = "elasticsearch";
        h.behaviour.providerCounts = { byLocale: new Map(), total: 1 };

        const report = await contentEngineDiagnostics(h.context);
        expect(report.contentTypes).not.toHaveLength(0);

        expect(report.searchHealthy).toBe(false);
        expect(report.healthy).toBe(false);
      });

      it("still reports healthy when the total agrees as well", async () => {
        // The control: same provider, same enumeration, honest total.
        await published();
        await indexPublished();

        h.behaviour.providerName = "elasticsearch";
        h.behaviour.providerCounts = {
          byLocale: new Map([["", 1]]),
          total: 1,
        };

        const drift = await contentSearchDrift(h.context, {
          model: articleContent,
        });

        expect(drift.provider).toMatchObject({
          healthy: true,
          indexedTotal: 1,
          verified: true,
        });
        expect(drift.healthy).toBe(true);
      });
    });

    it("reports a canonical row in a locale nothing expects", async () => {
      // The canonical side has the same failure mode, and the grouped query
      // already sees every locale the table holds - so the total closes it too.
      await published();
      await indexPublished();
      await h.sql`
        INSERT INTO "core_search_index"
          ("pluginId", "itemType", "itemId", "languageCode", "title", "content", "createdAt")
        VALUES (
          ${CONFIG_PLUGIN.pluginId}, ${articleContentType.id}, 424242,
          'de', 'Ghost', 'Ghost', now()
        )
      `;

      const drift = await contentSearchDrift(h.context, {
        model: articleContent,
      });

      expect(drift.expectedTotal).toBe(1);
      expect(drift.canonicalIndexedTotal).toBe(2);
      expect(drift.canonicalHealthy).toBe(false);
      expect(drift.healthy).toBe(false);
    });

    it("reports a provider that cannot be counted as unverified, not healthy", async () => {
      await published();
      await indexPublished();

      h.behaviour.providerName = "custom-search";
      h.behaviour.providerCounts = "unsupported";

      const drift = await contentSearchDrift(h.context, {
        model: articleContent,
      });

      expect(drift.canonicalHealthy).toBe(true);
      expect(drift.locales[0].providerHealthy).toBeNull();
      expect(drift.locales[0].providerIndexed).toBeNull();
      expect(drift.provider).toEqual({
        healthy: null,
        indexedTotal: null,
        name: "custom-search",
        verified: false,
      });
      // Absence of evidence is not a clean bill of health.
      expect(drift.healthy).toBe(false);
    });

    it("stays usable when the provider itself is unavailable", async () => {
      await published();
      await indexPublished();

      h.behaviour.providerName = "elasticsearch";
      h.behaviour.providerCounts = { byLocale: new Map([["", 1]]), total: 1 };
      h.behaviour.providerCountError = new Error("connect ECONNREFUSED");

      const drift = await contentSearchDrift(h.context, {
        model: articleContent,
      });

      // It answers rather than throwing: a diagnostic that crashes when the
      // thing it diagnoses is broken is a diagnostic nobody can use.
      expect(drift.canonicalHealthy).toBe(true);
      expect(drift.provider).toMatchObject({
        error: "connect ECONNREFUSED",
        healthy: false,
        verified: true,
      });
      expect(drift.healthy).toBe(false);
      expect(h.logs.some(line => line.includes("[content-diagnostics]"))).toBe(
        true,
      );
    });

    it("keeps the whole status route answering when the provider is down", async () => {
      await published();
      await indexPublished();
      h.behaviour.providerCounts = { byLocale: new Map([["", 1]]), total: 1 };
      h.behaviour.providerCountError = new Error("elasticsearch unavailable");

      const report = await contentEngineDiagnostics(h.context);

      expect(report.contentTypes).not.toHaveLength(0);
      expect(report.searchHealthy).toBe(false);
      expect(report.healthy).toBe(false);
    });

    it("counts a localized content type per locale", async () => {
      const { row } = await localizedService(h.context).create(
        {
          shared: {},
          translation: { body: "English body", title: "Drift Subject" },
        },
        { actor: ACTOR },
      );
      const base = localizedArticleContent.editorialService;
      if (!base) throw new Error("no editorial service");
      await translationEditorial(h.context).create(
        row.id,
        "pl",
        { body: "Tresc", title: "Polski Drift" },
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

      // Only English made it into the index.
      await h.sql`
        INSERT INTO "core_search_index"
          ("pluginId", "itemType", "itemId", "languageCode", "title", "content", "createdAt")
        VALUES (
          ${CONFIG_PLUGIN.pluginId}, ${localizedArticleContent.definition.id},
          ${row.id}, 'en', 'Drift Subject', 'Drift Subject', now()
        )
      `;

      const drift = await contentSearchDrift(h.context, {
        model: localizedArticleContent,
      });

      expect(drift.healthy).toBe(false);
      expect(drift.locales).toEqual([
        {
          canonicalHealthy: true,
          canonicalIndexed: 1,
          expected: 1,
          locale: "en",
          providerHealthy: true,
          providerIndexed: 1,
        },
        {
          canonicalHealthy: false,
          canonicalIndexed: 0,
          expected: 1,
          locale: "pl",
          providerHealthy: false,
          providerIndexed: 0,
        },
      ]);
    });

    it("reports one locale unhealthy when only that locale is missing from the provider", async () => {
      // The localized shape of the same regression: English agrees everywhere,
      // Polish is in the canonical table and absent from the provider. A single
      // total cannot show that; a per-locale provider count can.
      const { row } = await localizedService(h.context).create(
        {
          shared: {},
          translation: { body: "English body", title: "Locale Drift" },
        },
        { actor: ACTOR },
      );
      const base = localizedArticleContent.editorialService;
      if (!base) throw new Error("no editorial service");
      await translationEditorial(h.context).create(
        row.id,
        "pl",
        { body: "Tresc", title: "Polski Locale" },
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
        await h.sql`
          INSERT INTO "core_search_index"
            ("pluginId", "itemType", "itemId", "languageCode", "title", "content", "createdAt")
          VALUES (
            ${CONFIG_PLUGIN.pluginId}, ${localizedArticleContent.definition.id},
            ${row.id}, ${locale}, 'Locale Drift', 'Locale Drift', now()
          )
        `;
      }

      h.behaviour.providerName = "elasticsearch";
      h.behaviour.providerCounts = {
        byLocale: new Map([
          ["en", 1],
          ["pl", 0],
        ]),
        total: 1,
      };

      const drift = await contentSearchDrift(h.context, {
        model: localizedArticleContent,
      });

      expect(drift.canonicalHealthy).toBe(true);
      expect(
        drift.locales.map(entry => [entry.locale, entry.providerHealthy]),
      ).toEqual([
        ["en", true],
        ["pl", false],
      ]);
      expect(drift.healthy).toBe(false);
    });

    it("agrees with the localized rebuild about how many documents there should be", async () => {
      const { row } = await localizedService(h.context).create(
        {
          shared: {},
          translation: { body: "English body", title: "Parity Subject" },
        },
        { actor: ACTOR },
      );
      const base = localizedArticleContent.editorialService;
      if (!base) throw new Error("no editorial service");
      await translationEditorial(h.context).create(
        row.id,
        "pl",
        { body: "Tresc", title: "Polski Parity" },
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

      const build = createContentLocalizedSearchIndexer(
        localizedArticleContent,
        { pluginId: CONFIG_PLUGIN.pluginId },
      );
      const drift = await contentSearchDrift(h.context, {
        model: localizedArticleContent,
      });

      // The diagnostic and the indexer have to agree about "published", or the
      // health check would be measuring something the rebuild does not produce.
      expect(
        drift.locales.reduce((sum, entry) => sum + entry.expected, 0),
      ).toBe(await build.count?.(h.context));
    });

    it("summarises every registered content type, with schedule failures", async () => {
      const { id } = await published();
      const model = editorial(h.context).schedules;
      if (!model) throw new Error("no scheduling");
      const booked = await model.schedule({
        action: "unpublish",
        actorUserId: null,
        itemId: id,
        scheduledFor: new Date(Date.now() + 3_600_000),
      });
      await h.sql`
        UPDATE "core_content_schedules"
        SET "effectsError" = 'search: down'
        WHERE "id" = ${booked.id}
      `;

      const report = await contentEngineDiagnostics(h.context);
      const entry = report.contentTypes.find(
        item => item.contentTypeId === articleContentType.id,
      );

      expect(report.contentTypes.map(item => item.contentTypeId)).toEqual([
        "example.advanced-article",
        "example.article",
        "example.category",
        "example.localized-article",
      ]);
      expect(entry?.features).toMatchObject({
        editorial: true,
        localization: false,
        publicApi: true,
        scheduling: true,
        search: true,
      });
      expect(entry?.schedules).toEqual({
        failedEffects: 1,
        pending: 1,
        withErrors: 0,
      });
      // A content type with no search indexes nothing, so it has no drift to
      // report rather than a drift of zero.
      expect(
        report.contentTypes.find(
          item => item.contentTypeId === "example.category",
        )?.search,
      ).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Overall health
  // -------------------------------------------------------------------------

  /**
   * `healthy: true` beside `failedEffects: 15` is worse than no answer - it
   * tells an operator to stop looking. So the report carries the two dimensions
   * separately and derives the headline from them.
   */
  describe("overall health", () => {
    const bookSchedule = async (itemId: number) => {
      const model = editorial(h.context).schedules;
      if (!model) throw new Error("no scheduling");

      return await model.schedule({
        action: "unpublish",
        actorUserId: null,
        itemId,
        scheduledFor: new Date(Date.now() + 3_600_000),
      });
    };

    it("is healthy when search agrees and nothing is outstanding", async () => {
      const report = await contentEngineDiagnostics(h.context);

      expect(report).toMatchObject({
        effectsHealthy: true,
        healthy: true,
        searchHealthy: true,
      });
    });

    it("treats a pending schedule as normal rather than unhealthy", async () => {
      // It has not fired yet. Nothing is wrong.
      const { id } = await published();
      await indexPublished();
      await bookSchedule(id);

      const report = await contentEngineDiagnostics(h.context);

      expect(report.effectsHealthy).toBe(true);
      expect(report.healthy).toBe(true);
      expect(
        report.contentTypes.find(
          item => item.contentTypeId === articleContentType.id,
        )?.schedules?.pending,
      ).toBe(1);
    });

    it("treats a pending schedule whose last attempt threw as still pending", async () => {
      // The transition has not happened and the queue is retrying it, so this
      // is visible - `withErrors` - without being a failure of the engine.
      const { id } = await published();
      await indexPublished();
      const booked = await bookSchedule(id);
      await h.sql`
        UPDATE "core_content_schedules"
        SET "lastError" = 'connection reset'
        WHERE "id" = ${booked.id}
      `;

      const report = await contentEngineDiagnostics(h.context);

      expect(report.effectsHealthy).toBe(true);
      expect(report.healthy).toBe(true);
      expect(
        report.contentTypes.find(
          item => item.contentTypeId === articleContentType.id,
        )?.schedules?.withErrors,
      ).toBe(1);
    });

    it("is unhealthy when a committed transition was never announced", async () => {
      // The record *is* published and nobody was told. No amount of waiting
      // fixes that on its own, so it is the one that moves the headline.
      const { id } = await published();
      await indexPublished();
      const booked = await bookSchedule(id);
      await h.sql`
        UPDATE "core_content_schedules"
        SET "effectsError" = 'search: down'
        WHERE "id" = ${booked.id}
      `;

      const report = await contentEngineDiagnostics(h.context);

      expect(report).toMatchObject({
        effectsHealthy: false,
        healthy: false,
        // Search is fine; the headline is not, and the two are separable.
        searchHealthy: true,
      });
    });

    it("is unhealthy when search drifts even though nothing is outstanding", async () => {
      await published();
      // Nothing indexed at all, so the canonical table disagrees.

      const report = await contentEngineDiagnostics(h.context);

      expect(report).toMatchObject({
        effectsHealthy: true,
        healthy: false,
        searchHealthy: false,
      });
    });
  });
});
