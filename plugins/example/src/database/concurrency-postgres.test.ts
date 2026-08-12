import type { Context } from "hono";

import { executeContentSchedule } from "@vitnode/core/api/modules/content/helpers/execute-content-schedule";
import {
  ContentTranslationVersionConflict,
  ContentVersionConflict,
} from "@vitnode/core/content";
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
  fulfilledCount,
  race,
  reasons,
} from "./harness";
import { localizedArticleContent } from "./localized-articles";

/**
 * The Stage 7 concurrency matrix, against real Postgres.
 *
 * Every test here runs two writers on two separate connections at the same
 * moment. That is the only way any of it can be shown: a mock cannot produce a
 * lock wait, a guarded `UPDATE` that matches nothing, or a `DELETE` that commits
 * between another transaction's read and its write.
 *
 * The invariants, stated once so each test can be read against them:
 *
 * - **exactly one winner** wherever both writers carry the same
 *   `expectedVersion`, and the loser is told which version it lost to;
 * - **no resurrection** - a record deleted by one writer is never brought back
 *   by another's write, and neither is a translation;
 * - **no partial state** - a losing writer leaves the collections exactly as it
 *   found them, because the version guard runs before a single junction or child
 *   row is touched;
 * - **monotonic versions** - a race produces one increment, not two, and never
 *   two revisions at the same version.
 */

let h: ContentTestHarness;

const editorial = (on: Context) => {
  const build = articleContent.editorialService;
  if (!build) throw new Error("example.article has no editorial service");

  return build(on, { pluginId: CONFIG_PLUGIN.pluginId });
};

const advanced = (on: Context) => {
  const build = advancedArticleContent.editorialService;
  if (!build) throw new Error("no advanced editorial service");

  return build(on, { pluginId: CONFIG_PLUGIN.pluginId });
};

const plainAdvanced = (on: Context) => advancedArticleContent.service(on);

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

let categoryId = 0;
let seq = 0;

/** A published-ready article, at version 1 with one `create` revision. */
const article = async (overrides: Record<string, unknown> = {}) => {
  seq += 1;
  const outcome = await editorial(h.context).create(
    {
      category: categoryId,
      code: `race-${seq}`,
      title: `Race subject ${seq}`,
      ...overrides,
    },
    { actor: ACTOR },
  );

  return { id: outcome.row.id, version: outcome.version };
};

const rowOf = async (id: number) => {
  const [row] = await h.sql<
    { status: string; title: string; version: number }[]
  >`
    SELECT "title", "status", "version" FROM "example_articles" WHERE "id" = ${id}
  `;

  return row;
};

const revisionsOf = async (id: number) =>
  await h.sql<{ operation: string; version: number }[]>`
    SELECT "operation", "version" FROM "core_content_revisions"
    WHERE "contentTypeId" = 'example.article' AND "itemId" = ${id}
    ORDER BY "version"
  `;

const isVersionConflict = (error: unknown): boolean =>
  error instanceof ContentVersionConflict;

/**
 * How many of a race's sides actually **changed** something.
 *
 * Not the same as how many succeeded: a collection mutation whose computed next
 * state equals the stored one is a successful no-op, and a no-op deliberately
 * does not check `expectedVersion` - there is nothing to overwrite, so there is
 * nothing to conflict about. Counting real mutations is what pins "one race,
 * one version increment".
 */
const changedCount = (
  results: readonly PromiseSettledResult<unknown>[],
): number =>
  results.filter(
    entry =>
      entry.status === "fulfilled" &&
      (entry.value as null | { changed?: boolean })?.changed === true,
  ).length;

describe.skipIf(!DATABASE_TEST_URL)("Content Engine concurrency", () => {
  beforeAll(async () => {
    h = await createContentTestHarness();
  }, 60_000);

  afterAll(async () => {
    await h?.end();
  });

  beforeEach(async () => {
    await clearContentTables(h.sql);
    h.reset();

    const [category] = await h.sql<{ id: number }[]>`
      INSERT INTO "example_categories" ("name") VALUES ('Races') RETURNING "id"
    `;
    categoryId = category.id;
  });

  // -------------------------------------------------------------------------
  // Base record races
  // -------------------------------------------------------------------------

  describe("update against update", () => {
    it("lets exactly one writer win and tells the other which version it lost to", async () => {
      const { id } = await article();

      const results = await race(
        async () =>
          await editorial(h.context).update(
            id,
            { title: "Writer A" },
            { actor: ACTOR, expectedVersion: 1 },
          ),
        async () =>
          await editorial(h.rivalContext).update(
            id,
            { title: "Writer B" },
            { actor: ACTOR, expectedVersion: 1 },
          ),
      );

      expect(fulfilledCount(results)).toBe(1);
      expect(reasons(results).every(isVersionConflict)).toBe(true);
      expect(
        (reasons(results)[0] as ContentVersionConflict).currentVersion,
      ).toBe(2);

      const row = await rowOf(id);
      expect(row.version).toBe(2);
      expect(["Writer A", "Writer B"]).toContain(row.title);

      // One increment and one revision, not two of either. The loser wrote
      // nothing at all, so there is no partial mutation to find.
      expect((await revisionsOf(id)).map(entry => entry.operation)).toEqual([
        "create",
        "update",
      ]);
    });
  });

  /**
   * Two writers, one of which removes the record.
   *
   * The order decides which of two shapes the loser sees, and both are stated
   * rather than accepted as "either":
   *
   * - the **update** commits first, so the delete's guarded `DELETE` matches
   *   nothing and the follow-up read finds version 2: a conflict;
   * - the **delete** commits first, so the update's read finds no row at all:
   *   `null`, which the route turns into a 404.
   *
   * What never happens is a resurrection - the update's `UPDATE` is guarded by
   * both the id and the version, so it cannot recreate a row - and a revision
   * for a state that never existed.
   */
  describe("update against delete", () => {
    it("either refuses the delete or answers the update with nothing", async () => {
      const { id } = await article();

      const results = await race(
        async () =>
          await editorial(h.context).update(
            id,
            { title: "Edited" },
            { actor: ACTOR, expectedVersion: 1 },
          ),
        async () =>
          await editorial(h.rivalContext).delete(id, {
            actor: ACTOR,
            expectedVersion: 1,
          }),
      );

      const [updateResult, deleteResult] = results;

      if (deleteResult.status === "fulfilled" && deleteResult.value) {
        // The delete won. The update either lost the guard (a conflict) or
        // found nothing (`null`) - never a row it went on to rewrite.
        expect(await rowOf(id)).toBeUndefined();
        if (updateResult.status === "fulfilled") {
          expect(updateResult.value).toBeNull();
        } else {
          expect(isVersionConflict(updateResult.reason)).toBe(true);
        }

        return;
      }

      // The update won, so the delete was refused on the version rather than
      // silently removing a record somebody had just edited.
      expect(updateResult.status).toBe("fulfilled");
      expect(deleteResult.status).toBe("rejected");
      expect(
        isVersionConflict(
          deleteResult.status === "rejected" ? deleteResult.reason : null,
        ),
      ).toBe(true);
      expect((await rowOf(id)).title).toBe("Edited");
    });

    it("never leaves a revision describing a record that was never in that state", async () => {
      const { id } = await article();

      await race(
        async () =>
          await editorial(h.context).update(
            id,
            { title: "Edited" },
            { actor: ACTOR, expectedVersion: 1 },
          ),
        async () =>
          await editorial(h.rivalContext).delete(id, {
            actor: ACTOR,
            expectedVersion: 1,
          }),
      );

      const history = await revisionsOf(id);
      // Strictly increasing, with no version written twice - which is what the
      // partial unique index enforces and what a lost race must not disturb.
      expect(history.map(entry => entry.version)).toEqual(
        [...history.map(entry => entry.version)].sort((a, b) => a - b),
      );
      expect(new Set(history.map(entry => entry.version)).size).toBe(
        history.length,
      );
    });
  });

  /**
   * A field edit against a publication.
   *
   * Publishing takes an **optional** `expectedVersion`, because it overwrites no
   * field value: requiring one would fail the publish button whenever a
   * colleague had fixed a typo, for no protection against a lost update. Both
   * halves of that decision are pinned here.
   */
  describe("update against publish", () => {
    it("lets exactly one win when both carry the same expected version", async () => {
      const { id } = await article();

      const results = await race(
        async () =>
          await editorial(h.context).update(
            id,
            { title: "Edited first" },
            { actor: ACTOR, expectedVersion: 1 },
          ),
        async () =>
          await editorial(h.rivalContext).publish(id, {
            actor: ACTOR,
            expectedVersion: 1,
          }),
      );

      expect(fulfilledCount(results)).toBe(1);
      expect(reasons(results).every(isVersionConflict)).toBe(true);
      expect((await rowOf(id)).version).toBe(2);
    });

    it("overwrites no field value when the publish carries no version", async () => {
      // The documented behaviour: an unguarded publish moves `status` and
      // nothing else, so a concurrent edit either lands before it or is
      // refused - but the title it wrote is never reverted by the publish.
      const { id } = await article();

      const results = await race(
        async () =>
          await editorial(h.context).update(
            id,
            { title: "Edited alongside" },
            { actor: ACTOR, expectedVersion: 1 },
          ),
        async () =>
          await editorial(h.rivalContext).publish(id, { actor: ACTOR }),
      );

      const row = await rowOf(id);
      expect(row.status).toBe("published");

      const [updateResult] = results;
      if (updateResult.status === "fulfilled" && updateResult.value?.changed) {
        expect(row.title).toBe("Edited alongside");
        expect(row.version).toBe(3);

        return;
      }

      // Refused, and the title it never wrote is not on the row.
      expect(row.title).not.toBe("Edited alongside");
      expect(row.version).toBe(2);
    });
  });

  /**
   * A restore is the widest overwrite the engine has - it rewrites many fields
   * at once from a source the editor did not type - so it carries the same
   * required `expectedVersion` an ordinary update does.
   */
  describe("restore against update", () => {
    it("never overwrites a newer edit silently", async () => {
      const { id } = await article({ title: "Original" });
      await editorial(h.context).update(
        id,
        { title: "Second" },
        { actor: ACTOR, expectedVersion: 1 },
      );

      const history = await editorial(h.context).revisions.list(id);
      const first = history.edges.find(entry => entry.operation === "create");
      if (!first) throw new Error("Expected a create revision.");

      const results = await race(
        async () =>
          await editorial(h.context).restore(id, first.id, {
            actor: ACTOR,
            expectedVersion: 2,
          }),
        async () =>
          await editorial(h.rivalContext).update(
            id,
            { title: "Third" },
            { actor: ACTOR, expectedVersion: 2 },
          ),
      );

      expect(fulfilledCount(results)).toBe(1);
      expect(reasons(results).every(isVersionConflict)).toBe(true);

      const row = await rowOf(id);
      expect(row.version).toBe(3);
      // Whichever won, the record holds exactly that writer's value - never a
      // mixture, and never the loser's.
      expect(["Original", "Third"]).toContain(row.title);
    });

    it("writes exactly one new revision, never rewriting the one it restored from", async () => {
      const { id } = await article({ title: "Original" });
      await editorial(h.context).update(
        id,
        { title: "Second" },
        { actor: ACTOR, expectedVersion: 1 },
      );

      const history = await editorial(h.context).revisions.list(id);
      const first = history.edges.find(entry => entry.operation === "create");
      if (!first) throw new Error("Expected a create revision.");
      const before = await editorial(h.context).revisions.findById(
        id,
        first.id,
      );

      await race(
        async () =>
          await editorial(h.context).restore(id, first.id, {
            actor: ACTOR,
            expectedVersion: 2,
          }),
        async () =>
          await editorial(h.rivalContext).update(
            id,
            { title: "Third" },
            { actor: ACTOR, expectedVersion: 2 },
          ),
      );

      const after = await editorial(h.context).revisions.findById(id, first.id);
      expect(after?.snapshot).toEqual(before?.snapshot);
      expect(after?.version).toBe(before?.version);
      expect((await revisionsOf(id)).length).toBe(3);
    });
  });

  describe("restore against delete", () => {
    it("never recreates a record a concurrent delete removed", async () => {
      const { id } = await article({ title: "Original" });
      await editorial(h.context).update(
        id,
        { title: "Second" },
        { actor: ACTOR, expectedVersion: 1 },
      );
      const history = await editorial(h.context).revisions.list(id);
      const first = history.edges.find(entry => entry.operation === "create");
      if (!first) throw new Error("Expected a create revision.");

      const results = await race(
        async () =>
          await editorial(h.context).restore(id, first.id, {
            actor: ACTOR,
            expectedVersion: 2,
          }),
        async () =>
          await editorial(h.rivalContext).delete(id, {
            actor: ACTOR,
            expectedVersion: 2,
          }),
      );

      const [restoreResult, deleteResult] = results;

      if (deleteResult.status === "fulfilled" && deleteResult.value) {
        // Gone, and it stays gone: a restore reads the live row before it
        // writes, so there is no row for it to resurrect.
        expect(await rowOf(id)).toBeUndefined();
        if (restoreResult.status === "fulfilled") {
          expect(restoreResult.value).toBeNull();
        } else {
          expect(isVersionConflict(restoreResult.reason)).toBe(true);
        }

        return;
      }

      expect(restoreResult.status).toBe("fulfilled");
      expect((await rowOf(id)).title).toBe("Original");
    });
  });

  // -------------------------------------------------------------------------
  // Scheduled against manual
  // -------------------------------------------------------------------------

  describe("a scheduled transition against a manual one", () => {
    const schedules = (on: Context) => {
      const model = editorial(on).schedules;
      if (!model) throw new Error("example.article has no scheduling");

      return model;
    };

    const book = async (id: number, action: "publish" | "unpublish") =>
      await schedules(h.context).schedule({
        action,
        actorUserId: null,
        itemId: id,
        // Inside the past tolerance, so it is due on this tick.
        scheduledFor: new Date(Date.now() - 1000),
      });

    it("does nothing when the manual publish got there first", async () => {
      const { id } = await article();
      const booked = await book(id, "publish");

      await editorial(h.context).publish(id, { actor: ACTOR });
      const outcome = await executeContentSchedule(h.context, {
        generation: booked.generation,
        scheduleId: booked.id,
      });

      // Skipped rather than executed: the state guard on the transition is what
      // makes a scheduled publish idempotent, and idempotent is what stops a
      // second revision and a second announcement.
      expect(outcome).toMatchObject({
        reason: "already in that state",
        status: "skipped",
      });
      expect(
        (await revisionsOf(id)).filter(entry => entry.operation === "publish"),
      ).toHaveLength(1);

      const effects = await h.sql`
        SELECT "id" FROM "core_queue" WHERE "name" = 'content-schedule-effects'
      `;
      expect(effects).toHaveLength(0);
    });

    it("does not un-publish a record the editor published after booking the unpublish", async () => {
      const { id } = await article();
      await editorial(h.context).publish(id, { actor: ACTOR });
      const booked = await book(id, "unpublish");

      // Manual unpublish first; the stale booking then finds nothing to do.
      await editorial(h.context).unpublish(id, { actor: ACTOR });
      const outcome = await executeContentSchedule(h.context, {
        generation: booked.generation,
        scheduleId: booked.id,
      });

      expect(outcome.status).toBe("skipped");
      expect(
        (await revisionsOf(id)).filter(
          entry => entry.operation === "unpublish",
        ),
      ).toHaveLength(1);
    });

    it("settles the booking either way, so it never runs twice", async () => {
      const { id } = await article();
      const booked = await book(id, "publish");
      await editorial(h.context).publish(id, { actor: ACTOR });

      await executeContentSchedule(h.context, {
        generation: booked.generation,
        scheduleId: booked.id,
      });

      const [schedule] = await h.sql<{ status: string }[]>`
        SELECT "status" FROM "core_content_schedules" WHERE "id" = ${booked.id}
      `;
      expect(schedule.status).toBe("completed");

      // A second delivery of the same queue row is a no-op: the claim refuses
      // anything that is not still `pending`.
      const again = await executeContentSchedule(h.context, {
        generation: booked.generation,
        scheduleId: booked.id,
      });
      expect(again.status).toBe("skipped");
    });

    it("keeps a scheduled publish and a concurrent edit to one version each", async () => {
      const { id } = await article();
      const booked = await book(id, "publish");

      const results = await race(
        async () =>
          await executeContentSchedule(h.context, {
            generation: booked.generation,
            scheduleId: booked.id,
          }),
        async () =>
          await editorial(h.rivalContext).update(
            id,
            { title: "Edited while publishing" },
            { actor: ACTOR, expectedVersion: 1 },
          ),
      );

      const row = await rowOf(id);
      const history = await revisionsOf(id);

      // However they interleaved: no version was written twice, and the row's
      // version equals the highest revision.
      expect(new Set(history.map(entry => entry.version)).size).toBe(
        history.length,
      );
      expect(row.version).toBe(
        Math.max(...history.map(entry => entry.version)),
      );

      // The publish either committed or was rolled back whole - never half.
      const published = history.some(entry => entry.operation === "publish");
      expect(row.status).toBe(published ? "published" : "draft");
      expect(fulfilledCount(results)).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Translations
  // -------------------------------------------------------------------------

  describe("translations", () => {
    const guide = async (title: string) => {
      const { row } = await localizedService(h.context).create(
        { shared: {}, translation: { body: `Body of ${title}`, title } },
        { actor: ACTOR },
      );

      return row.id;
    };

    const translationRows = async (itemId: number) =>
      await h.sql<{ languageId: number; title: string; version: number }[]>`
        SELECT "languageId", "title", "version"
        FROM "example_localized_articles_translations"
        WHERE "itemId" = ${itemId}
        ORDER BY "languageId"
      `;

    it("lets exactly one of two writers on the same locale win", async () => {
      const itemId = await guide("Same Locale");
      await translationEditorial(h.context).create(
        itemId,
        "pl",
        { body: "Tresc", title: "Polski" },
        { actor: ACTOR },
      );

      const results = await race(
        async () =>
          await translationEditorial(h.context).update(
            itemId,
            "pl",
            { title: "Polski A" },
            { actor: ACTOR, expectedVersion: 1 },
          ),
        async () =>
          await translationEditorial(h.rivalContext).update(
            itemId,
            "pl",
            { title: "Polski B" },
            { actor: ACTOR, expectedVersion: 1 },
          ),
      );

      expect(fulfilledCount(results)).toBe(1);
      expect(
        reasons(results).every(
          error => error instanceof ContentTranslationVersionConflict,
        ),
      ).toBe(true);

      const rows = await translationRows(itemId);
      expect(rows.find(row => row.languageId === 2)?.version).toBe(2);
    });

    it("lets two locales be written at the same time, independently", async () => {
      const itemId = await guide("Two Locales");
      await translationEditorial(h.context).create(
        itemId,
        "pl",
        { body: "Tresc", title: "Polski" },
        { actor: ACTOR },
      );

      const results = await race(
        async () =>
          await translationEditorial(h.context).update(
            itemId,
            "pl",
            { title: "Polski Nowy" },
            { actor: ACTOR, expectedVersion: 1 },
          ),
        async () =>
          await translationEditorial(h.rivalContext).update(
            itemId,
            "en",
            { title: "English New" },
            { actor: ACTOR, expectedVersion: 1 },
          ),
      );

      // Two version domains, so both win: somebody editing Polish must never be
      // told the English copy moved.
      expect(fulfilledCount(results)).toBe(2);

      const rows = await translationRows(itemId);
      expect(rows.map(row => row.version)).toEqual([2, 2]);
      expect(rows.map(row => row.title).sort()).toEqual([
        "English New",
        "Polski Nowy",
      ]);
    });

    it("lets a locale write and a shared write both succeed", async () => {
      const itemId = await guide("Shared And Local");
      await translationEditorial(h.context).create(
        itemId,
        "pl",
        { body: "Tresc", title: "Polski" },
        { actor: ACTOR },
      );

      const results = await race(
        async () =>
          await translationEditorial(h.context).update(
            itemId,
            "pl",
            { title: "Polski Zmieniony" },
            { actor: ACTOR, expectedVersion: 1 },
          ),
        async () =>
          await h.rivalDb.execute(
            // The shared half, written straight through SQL: what matters here
            // is that the two version columns are on two different rows, so
            // neither guard can see the other's write.
            `UPDATE "example_localized_articles" SET "featured" = true WHERE "id" = ${itemId}`,
          ),
      );

      expect(fulfilledCount(results)).toBe(2);

      const [base] = await h.sql<{ featured: boolean }[]>`
        SELECT "featured" FROM "example_localized_articles" WHERE "id" = ${itemId}
      `;
      expect(base.featured).toBe(true);
      expect(
        (await translationRows(itemId)).find(row => row.languageId === 2)
          ?.title,
      ).toBe("Polski Zmieniony");
    });

    it("never resurrects a translation a concurrent delete removed", async () => {
      const itemId = await guide("Delete Race");
      await translationEditorial(h.context).create(
        itemId,
        "pl",
        { body: "Tresc", title: "Polski" },
        { actor: ACTOR },
      );

      const results = await race(
        async () =>
          await translationEditorial(h.context).delete(itemId, "pl", {
            actor: ACTOR,
            expectedVersion: 1,
          }),
        async () =>
          await translationEditorial(h.rivalContext).update(
            itemId,
            "pl",
            { title: "Stale" },
            { actor: ACTOR, expectedVersion: 1 },
          ),
      );

      const rows = await translationRows(itemId);
      const polish = rows.find(row => row.languageId === 2);

      const [deleteResult] = results;
      if (deleteResult.status === "fulfilled" && deleteResult.value) {
        expect(polish).toBeUndefined();

        return;
      }

      // The update won, so the delete was refused - and the translation holds
      // the update's value rather than a mixture.
      expect(polish?.title).toBe("Stale");
    });

    /**
     * The composite AdminCP save, against a real database.
     *
     * One form, one Save button, and underneath it a base row plus one
     * translation row per language - each with its own version. The property
     * that matters is all-or-nothing: a conflict in one language must not leave
     * the shared fields and another language already written, because the
     * person pressing the button was told the save failed.
     */
    describe("a composite save across shared fields and two locales", () => {
      const sharedAndTwoLocales = async (
        on: Context,
        itemId: number,
        versions: { en: number; pl: number },
        titles: { en: string; pl: string },
        polishConflicts = false,
      ) =>
        await h.db.transaction(async tx => {
          await editorialFor(on).update(
            itemId,
            { featured: true },
            { actor: ACTOR, expectedVersion: 1, tx },
          );
          await translationEditorial(on).update(
            itemId,
            "en",
            { title: titles.en },
            { actor: ACTOR, expectedVersion: versions.en, tx },
          );
          await translationEditorial(on).update(
            itemId,
            "pl",
            { title: titles.pl },
            {
              actor: ACTOR,
              // A deliberately stale precondition, standing in for a colleague
              // who saved this language while the form was open.
              expectedVersion: polishConflicts ? 99 : versions.pl,
              tx,
            },
          );
        });

      const editorialFor = (on: Context) => {
        const build = localizedArticleContent.editorialService;
        if (!build) throw new Error("no localized editorial service");

        return build(on, { pluginId: CONFIG_PLUGIN.pluginId });
      };

      const setup = async () => {
        const itemId = await guide("Composite");
        await translationEditorial(h.context).create(
          itemId,
          "pl",
          { body: "Tresc", title: "Polski" },
          { actor: ACTOR },
        );

        return itemId;
      };

      it("commits the base row and both languages together", async () => {
        const itemId = await setup();

        await sharedAndTwoLocales(
          h.context,
          itemId,
          { en: 1, pl: 1 },
          { en: "English v2", pl: "Polski v2" },
        );

        const [base] = await h.sql<{ featured: boolean; version: number }[]>`
          SELECT "featured", "version" FROM "example_localized_articles"
          WHERE "id" = ${itemId}
        `;
        expect(base.featured).toBe(true);
        expect(base.version).toBe(2);
        expect((await translationRows(itemId)).map(row => row.title)).toEqual([
          "English v2",
          "Polski v2",
        ]);
      });

      it("rolls the shared write and the other language back on a conflict", async () => {
        const itemId = await setup();

        await expect(
          sharedAndTwoLocales(
            h.context,
            itemId,
            { en: 1, pl: 1 },
            { en: "English v2", pl: "Polski v2" },
            true,
          ),
        ).rejects.toBeInstanceOf(ContentTranslationVersionConflict);

        // Nothing moved. "Shared saved, English saved, Polish conflicted" is
        // exactly the state a single Save button must never leave behind.
        const [base] = await h.sql<{ featured: boolean; version: number }[]>`
          SELECT "featured", "version" FROM "example_localized_articles"
          WHERE "id" = ${itemId}
        `;
        expect(base.featured).toBe(false);
        expect(base.version).toBe(1);

        const rows = await translationRows(itemId);
        expect(rows.map(row => row.version)).toEqual([1, 1]);
        expect(rows.map(row => row.title).sort()).toEqual([
          "Composite",
          "Polski",
        ]);
      });

      it("leaves the other language alone when only one changed", async () => {
        const itemId = await setup();

        await translationEditorial(h.context).update(
          itemId,
          "pl",
          { title: "Tylko polski" },
          { actor: ACTOR, expectedVersion: 1 },
        );

        // The Polish-only save the AdminCP sends: no shared values, no English
        // entry. So no base version bump and no English version bump.
        const [base] = await h.sql<{ version: number }[]>`
          SELECT "version" FROM "example_localized_articles" WHERE "id" = ${itemId}
        `;
        expect(base.version).toBe(1);

        const rows = await translationRows(itemId);
        expect(rows.find(row => row.languageId === 1)?.version).toBe(1);
        expect(rows.find(row => row.languageId === 2)?.version).toBe(2);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Advanced collections
  // -------------------------------------------------------------------------

  describe("advanced collections", () => {
    let categories: number[] = [];

    const advancedArticle = async () => {
      // `title` is localized on this content type, so it is not a shared field
      // and never appears in a base create payload.
      const outcome = await advanced(h.context).create(
        { categories: [] },
        { actor: ACTOR },
      );

      return { id: outcome.row.id, version: outcome.version };
    };

    const junctionRows = async (id: number) =>
      await h.sql<{ position: number; relatedItemId: number }[]>`
        SELECT "relatedItemId", "position"
        FROM "example_advanced_articles_categories"
        WHERE "itemId" = ${id}
        ORDER BY "position"
      `;

    const relatedRows = async (id: number) =>
      await h.sql<{ position: number; relatedItemId: number }[]>`
        SELECT "relatedItemId", "position"
        FROM "example_advanced_articles_related_articles"
        WHERE "itemId" = ${id}
        ORDER BY "position"
      `;

    const versionOfAdvanced = async (id: number) => {
      const [row] = await h.sql<{ version: number }[]>`
        SELECT "version" FROM "example_advanced_articles" WHERE "id" = ${id}
      `;

      return row.version;
    };

    const faqRows = async (id: number) =>
      await h.sql<{ id: number; position: number; question: string }[]>`
        SELECT "id", "position", "question"
        FROM "example_advanced_articles_faq"
        WHERE "itemId" = ${id}
        ORDER BY "position"
      `;

    beforeEach(async () => {
      const rows = await h.sql<{ id: number }[]>`
        INSERT INTO "example_categories" ("name")
        VALUES ('One'), ('Two'), ('Three') RETURNING "id"
      `;
      categories = rows.map(row => row.id);
    });

    it("refuses one of two racing adds and leaves no half-written set", async () => {
      const { id, version } = await advancedArticle();

      const results = await race(
        async () =>
          await advanced(h.context).relations.categories.add(
            id,
            categories[0],
            { actor: ACTOR, expectedVersion: version },
          ),
        async () =>
          await advanced(h.rivalContext).relations.categories.add(
            id,
            categories[1],
            { actor: ACTOR, expectedVersion: version },
          ),
      );

      expect(fulfilledCount(results)).toBe(1);

      // Exactly one target, at position 0 - never two rows written by two
      // writers who each thought the set was empty.
      const rows = await junctionRows(id);
      expect(rows).toHaveLength(1);
      expect(rows[0].position).toBe(0);
    });

    it("refuses a remove racing an add", async () => {
      const { id, version } = await advancedArticle();
      const seeded = await advanced(h.context).relations.categories.set(
        id,
        [categories[0]],
        { actor: ACTOR, expectedVersion: version },
      );
      const at = seeded?.version ?? version;

      const results = await race(
        async () =>
          await advanced(h.context).relations.categories.remove(
            id,
            categories[0],
            { actor: ACTOR, expectedVersion: at },
          ),
        async () =>
          await advanced(h.rivalContext).relations.categories.add(
            id,
            categories[1],
            { actor: ACTOR, expectedVersion: at },
          ),
      );

      expect(fulfilledCount(results)).toBe(1);

      const rows = await junctionRows(id);
      // Either the removal happened (empty) or the addition did (two targets) -
      // never the removal's result with the addition's row in it.
      expect([0, 2]).toContain(rows.length);
      expect(rows.map(row => row.position)).toEqual(
        rows.map((_row, index) => index),
      );
    });

    /**
     * A reorder needs an **ordered** relation to be a mutation at all.
     *
     * `categories` is unordered: the engine stores it in ascending target order,
     * so `reorder` there computes the list that is already stored and is a no-op
     * by construction. `relatedArticles` is `ordered: true`, which is what makes
     * the author's sequence a fact the database holds - and what makes racing a
     * reorder against something else a real contest.
     */
    it("keeps positions contiguous when a reorder races an add", async () => {
      const { id, version } = await advancedArticle();
      const first = await advancedArticle();
      const second = await advancedArticle();
      const third = await advancedArticle();

      const seeded = await advanced(h.context).relations.relatedArticles.set(
        id,
        [first.id, second.id],
        { actor: ACTOR, expectedVersion: version },
      );
      const at = seeded?.version ?? version;

      const results = await race(
        async () =>
          await advanced(h.context).relations.relatedArticles.reorder(
            id,
            [second.id, first.id],
            { actor: ACTOR, expectedVersion: at },
          ),
        async () =>
          await advanced(h.rivalContext).relations.relatedArticles.add(
            id,
            third.id,
            { actor: ACTOR, expectedVersion: at },
          ),
      );

      // Exactly one real mutation, so exactly one version increment. The loser
      // either lost the guard or found its own computation was a no-op; neither
      // writes a junction row.
      expect(changedCount(results)).toBe(1);
      expect(await versionOfAdvanced(id)).toBe(at + 1);

      const rows = await relatedRows(id);
      expect(rows.map(row => row.position)).toEqual(
        rows.map((_row, index) => index),
      );
      expect(new Set(rows.map(row => row.relatedItemId)).size).toBe(
        rows.length,
      );
    });

    it("keeps positions contiguous when a reorder races a remove", async () => {
      const { id, version } = await advancedArticle();
      const first = await advancedArticle();
      const second = await advancedArticle();
      const third = await advancedArticle();

      const seeded = await advanced(h.context).relations.relatedArticles.set(
        id,
        [first.id, second.id, third.id],
        { actor: ACTOR, expectedVersion: version },
      );
      const at = seeded?.version ?? version;

      const results = await race(
        async () =>
          await advanced(h.context).relations.relatedArticles.reorder(
            id,
            [third.id, second.id, first.id],
            { actor: ACTOR, expectedVersion: at },
          ),
        async () =>
          await advanced(h.rivalContext).relations.relatedArticles.remove(
            id,
            first.id,
            { actor: ACTOR, expectedVersion: at },
          ),
      );

      expect(changedCount(results)).toBe(1);
      expect(await versionOfAdvanced(id)).toBe(at + 1);

      const rows = await relatedRows(id);
      expect([2, 3]).toContain(rows.length);
      expect(rows.map(row => row.position)).toEqual(
        rows.map((_row, index) => index),
      );
    });

    it("refuses a repeatable delete racing an update of the same child", async () => {
      const { id, version } = await advancedArticle();
      const seeded = await advanced(h.context).repeatable.faq.set(
        id,
        [
          { answer: "A1", question: "Question one" },
          { answer: "A2", question: "Question two" },
        ],
        { actor: ACTOR, expectedVersion: version },
      );
      const at = seeded?.version ?? version;
      const children = await faqRows(id);

      const results = await race(
        async () =>
          await advanced(h.context).repeatable.faq.delete(id, children[0].id, {
            actor: ACTOR,
            expectedVersion: at,
          }),
        async () =>
          await advanced(h.rivalContext).repeatable.faq.update(
            id,
            children[0].id,
            { question: "Question one edited" },
            { actor: ACTOR, expectedVersion: at },
          ),
      );

      // At most one *real* mutation. The loser either lost the version guard or
      // discovered its own computation was a no-op - editing a child that is
      // already gone changes nothing, and a no-op is deliberately not a
      // conflict, because there is nothing to overwrite.
      expect(changedCount(results)).toBe(1);
      expect(await versionOfAdvanced(id)).toBe(at + 1);

      const rows = await faqRows(id);
      // Either the child is gone or it holds the edit - never a resurrected row
      // carrying the pre-edit values.
      const first = rows.find(row => row.id === children[0].id);
      if (first) expect(first.question).toBe("Question one edited");
      expect(rows.map(row => row.position)).toEqual(
        rows.map((_row, index) => index),
      );
    });

    it("refuses a child update racing a reorder", async () => {
      const { id, version } = await advancedArticle();
      const seeded = await advanced(h.context).repeatable.faq.set(
        id,
        [
          { answer: "A1", question: "Question one" },
          { answer: "A2", question: "Question two" },
        ],
        { actor: ACTOR, expectedVersion: version },
      );
      const at = seeded?.version ?? version;
      const children = await faqRows(id);

      const results = await race(
        async () =>
          await advanced(h.context).repeatable.faq.update(
            id,
            children[0].id,
            { question: "Question one edited" },
            { actor: ACTOR, expectedVersion: at },
          ),
        async () =>
          await advanced(h.rivalContext).repeatable.faq.reorder(
            id,
            [children[1].id, children[0].id],
            { actor: ACTOR, expectedVersion: at },
          ),
      );

      expect(fulfilledCount(results)).toBe(1);

      const rows = await faqRows(id);
      expect(rows).toHaveLength(2);
      expect(rows.map(row => row.position)).toEqual([0, 1]);
      // Identity survived whichever way it went: both children are still the
      // rows they were, not recreated ones.
      expect(new Set(rows.map(row => row.id))).toEqual(
        new Set(children.map(row => row.id)),
      );
    });

    it("refuses a collection write racing a scalar write on the same version", async () => {
      const { id, version } = await advancedArticle();

      const results = await race(
        async () =>
          await advanced(h.context).relations.categories.add(
            id,
            categories[0],
            { actor: ACTOR, expectedVersion: version },
          ),
        async () =>
          await advanced(h.rivalContext).update(
            id,
            { syndication: { indexable: false, priority: 3 } },
            { actor: ACTOR, expectedVersion: version },
          ),
      );

      expect(fulfilledCount(results)).toBe(1);

      const [row] = await h.sql<
        { syndicationPriority: number; version: number }[]
      >`
        SELECT "version", "syndicationPriority" FROM "example_advanced_articles"
        WHERE "id" = ${id}
      `;
      expect(row.version).toBe(version + 1);

      const junction = await junctionRows(id);
      // One or the other, never both halves of two different writers.
      if (junction.length > 0) {
        expect(row.syndicationPriority).toBe(5);
      } else {
        expect(row.syndicationPriority).toBe(3);
      }
    });

    it("keeps two different records independent under load", async () => {
      const first = await advancedArticle();
      const second = await advancedArticle();

      const results = await race(
        async () =>
          await advanced(h.context).relations.categories.add(
            first.id,
            categories[0],
            { actor: ACTOR, expectedVersion: first.version },
          ),
        async () =>
          await advanced(h.rivalContext).relations.categories.add(
            second.id,
            categories[1],
            { actor: ACTOR, expectedVersion: second.version },
          ),
      );

      // The lock is per row, so two records never contend.
      expect(fulfilledCount(results)).toBe(2);
      expect(await junctionRows(first.id)).toHaveLength(1);
      expect(await junctionRows(second.id)).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // The plain service, which merges rather than arbitrating
  // -------------------------------------------------------------------------

  describe("the plain service serialises instead of conflicting", () => {
    let categories: number[] = [];

    beforeEach(async () => {
      const rows = await h.sql<{ id: number }[]>`
        INSERT INTO "example_categories" ("name")
        VALUES ('Plain One'), ('Plain Two') RETURNING "id"
      `;
      categories = rows.map(row => row.id);
    });

    it("keeps both concurrent additions", async () => {
      // No version column to guard on, so the row lock does the job instead:
      // the second `add` waits, then reads what the first committed.
      const outcome = await advanced(h.context).create(
        { categories: [] },
        { actor: ACTOR },
      );
      const id = outcome.row.id;

      const results = await race(
        async () =>
          await plainAdvanced(h.context).relations.categories.add(
            id,
            categories[0],
          ),
        async () =>
          await plainAdvanced(h.rivalContext).relations.categories.add(
            id,
            categories[1],
          ),
      );

      expect(fulfilledCount(results)).toBe(2);

      const rows = await h.sql<{ position: number }[]>`
        SELECT "position" FROM "example_advanced_articles_categories"
        WHERE "itemId" = ${id} ORDER BY "position"
      `;
      expect(rows.map(row => row.position)).toEqual([0, 1]);
    });
  });
});
