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
    /** Writes the canonical index rows a healthy install would hold. */
    const indexPublished = async () => {
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

    it("reports a healthy index as healthy", async () => {
      await published();
      await published();
      await indexPublished();

      const drift = await contentSearchDrift(h.context, {
        model: articleContent,
      });

      expect(drift).toMatchObject({
        contentTypeId: articleContentType.id,
        healthy: true,
      });
      expect(drift.locales).toEqual([
        { expected: 2, healthy: true, indexed: 2, locale: "" },
      ]);
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
      expect(drift.locales[0]).toMatchObject({ expected: 2, indexed: 1 });
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
      expect(drift.locales[0]).toMatchObject({ expected: 1, indexed: 2 });
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
        { expected: 1, healthy: true, indexed: 1, locale: "en" },
        { expected: 1, healthy: false, indexed: 0, locale: "pl" },
      ]);
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
});
