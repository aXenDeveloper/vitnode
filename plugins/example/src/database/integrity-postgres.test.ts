import type { Context } from "hono";

import {
  ContentLanguageError,
  ContentRevisionNotRestorable,
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
  pgErrorCode,
} from "./harness";
import { localizedArticleContent } from "./localized-articles";

/**
 * What the **database** guarantees, and what the engine does when a definition
 * has moved on since a revision was written.
 *
 * Two halves that look unrelated and are not: both are about a record outliving
 * the assumptions it was written under. A delete has to take exactly the rows
 * that belong to the record and refuse exactly the ones that belong to somebody
 * else; a restore has to apply a snapshot written against an older shape, or
 * refuse it whole.
 *
 * Wherever Postgres can enforce something, the assertion is against Postgres
 * rather than against the service - a check in application code is one a direct
 * `DELETE` walks straight past.
 */

let h: ContentTestHarness;
let categoryId = 0;
let seq = 0;

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

const advancedTranslations = (on: Context) => {
  const build = advancedArticleContent.translationEditorialService;
  if (!build) throw new Error("no advanced translation editorial service");

  return build(on, { pluginId: CONFIG_PLUGIN.pluginId });
};

const article = async () => {
  seq += 1;
  const outcome = await editorial(h.context).create(
    {
      category: categoryId,
      code: `integrity-${seq}`,
      title: `Integrity subject ${seq}`,
    },
    { actor: ACTOR },
  );

  return { id: outcome.row.id, version: outcome.version };
};

const countOf = async (table: string): Promise<number> => {
  const [row] = await h.sql.unsafe(
    `SELECT count(*)::int AS count FROM "${table}"`,
  );

  return Number(row.count);
};

describe.skipIf(!DATABASE_TEST_URL)("Content Engine integrity", () => {
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
      INSERT INTO "example_categories" ("name") VALUES ('Integrity')
      RETURNING "id"
    `;
    categoryId = category.id;
  });

  // -------------------------------------------------------------------------
  // Delete integrity
  // -------------------------------------------------------------------------

  describe("deleting a record", () => {
    it("takes its translations with it", async () => {
      const { row } = await localizedService(h.context).create(
        {
          shared: {},
          translation: { body: "Body", title: "Cascade Subject" },
        },
        { actor: ACTOR },
      );
      await translationEditorial(h.context).create(
        row.id,
        "pl",
        { body: "Tresc", title: "Polski" },
        { actor: ACTOR },
      );
      expect(await countOf("example_localized_articles_translations")).toBe(2);

      await h.sql`
        DELETE FROM "example_localized_articles" WHERE "id" = ${row.id}
      `;

      expect(await countOf("example_localized_articles_translations")).toBe(0);
    });

    it("takes its junction and child rows with it", async () => {
      const created = await advanced(h.context).create(
        { categories: [categoryId] },
        { actor: ACTOR },
      );
      await advanced(h.context).repeatable.faq.set(
        created.row.id,
        [{ answer: "An answer", question: "A question" }],
        { actor: ACTOR, expectedVersion: created.version },
      );
      expect(await countOf("example_advanced_articles_categories")).toBe(1);
      expect(await countOf("example_advanced_articles_faq")).toBe(1);

      await h.sql`
        DELETE FROM "example_advanced_articles" WHERE "id" = ${created.row.id}
      `;

      expect(await countOf("example_advanced_articles_categories")).toBe(0);
      expect(await countOf("example_advanced_articles_faq")).toBe(0);
    });

    it("keeps its history, which outlives it deliberately", async () => {
      const created = await article();

      await editorial(h.context).delete(created.id, {
        actor: ACTOR,
        expectedVersion: created.version,
      });

      const revisions = await h.sql<{ operation: string }[]>`
        SELECT "operation" FROM "core_content_revisions"
        WHERE "contentTypeId" = 'example.article' AND "itemId" = ${created.id}
        ORDER BY "version"
      `;
      // "Who removed this, and what did it say" is only answerable if the
      // history is not a foreign key to the row it describes.
      expect(revisions.map(row => row.operation)).toEqual(["create", "delete"]);
    });

    it("refuses to remove a category that content still points at", async () => {
      await article();

      const code = await pgErrorCode(
        async () =>
          await h.sql`DELETE FROM "example_categories" WHERE "id" = ${categoryId}`,
      );

      // `onDelete: "restrict"`, enforced by Postgres rather than by a check in
      // service code that a direct `DELETE` would walk past.
      expect(code).toBe(h.serverMajor >= 18 ? "23001" : "23503");
    });

    it("refuses to remove a category a to-many relation still points at", async () => {
      const created = await advanced(h.context).create(
        { categories: [categoryId] },
        { actor: ACTOR },
      );
      expect(created.row.id).toBeGreaterThan(0);

      const code = await pgErrorCode(
        async () =>
          await h.sql`DELETE FROM "example_categories" WHERE "id" = ${categoryId}`,
      );

      expect(code).toBe(h.serverMajor >= 18 ? "23001" : "23503");
    });

    it("drops a self-relation's reference when its target goes", async () => {
      // `relatedArticles` is `onDelete: "cascade"`: forgetting the reference is
      // the honest analogue of nulling a column, because a junction row has no
      // column to null.
      const source = await advanced(h.context).create({}, { actor: ACTOR });
      const target = await advanced(h.context).create({}, { actor: ACTOR });
      await advanced(h.context).relations.relatedArticles.set(
        source.row.id,
        [target.row.id],
        { actor: ACTOR, expectedVersion: source.version },
      );
      expect(await countOf("example_advanced_articles_related_articles")).toBe(
        1,
      );

      await h.sql`
        DELETE FROM "example_advanced_articles" WHERE "id" = ${target.row.id}
      `;

      expect(await countOf("example_advanced_articles_related_articles")).toBe(
        0,
      );
      // And the source record is still there: a cascade on the reference is not
      // a cascade on the record that held it.
      const [row] = await h.sql<{ id: number }[]>`
        SELECT "id" FROM "example_advanced_articles" WHERE "id" = ${source.row.id}
      `;
      expect(row).toBeDefined();
    });

    it("leaves no orphaned junction row behind, in either direction", async () => {
      const created = await advanced(h.context).create(
        { categories: [categoryId] },
        { actor: ACTOR },
      );
      await advanced(h.context).relations.relatedArticles.set(
        created.row.id,
        [created.row.id],
        { actor: ACTOR, expectedVersion: created.version },
      );

      await h.sql`
        DELETE FROM "example_advanced_articles" WHERE "id" = ${created.row.id}
      `;

      const orphans = await h.sql<{ count: number }[]>`
        SELECT (
          (SELECT count(*) FROM "example_advanced_articles_categories" j
             LEFT JOIN "example_advanced_articles" a ON a."id" = j."itemId"
           WHERE a."id" IS NULL)
          +
          (SELECT count(*) FROM "example_advanced_articles_related_articles" r
             LEFT JOIN "example_advanced_articles" a ON a."id" = r."itemId"
           WHERE a."id" IS NULL)
        )::int AS count
      `;
      expect(orphans[0].count).toBe(0);
    });

    it("clears a user reference rather than removing the record", async () => {
      // `onDelete: "set null"` on a nullable user field: an article does not
      // stop existing because its author's account did.
      const [user] = await h.sql<{ id: number }[]>`
        INSERT INTO "core_users" ("name") VALUES ('Ada') RETURNING "id"
      `;
      seq += 1;
      const created = await editorial(h.context).create(
        {
          author: user.id,
          category: categoryId,
          code: `authored-${seq}`,
          title: "Authored subject",
        },
        { actor: ACTOR },
      );

      await h.sql`DELETE FROM "core_users" WHERE "id" = ${user.id}`;

      const [row] = await h.sql<{ author: null | number }[]>`
        SELECT "author" FROM "example_articles" WHERE "id" = ${created.row.id}
      `;
      expect(row.author).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Schema evolution
  // -------------------------------------------------------------------------

  /**
   * A revision written under an older definition, applied to today's.
   *
   * The snapshots are written straight into `core_content_revisions`, which is
   * the honest way to model this: a real installation's history is full of rows
   * written by code that no longer exists, and there is no way to get one except
   * by having been there.
   */
  describe("restoring a revision written under an older definition", () => {
    /**
     * A revision row in the envelope the engine really writes.
     *
     * `fields` is the whole point: a snapshot is a versioned envelope around
     * the declared field values, and `projectRevisionSnapshot` reads that half
     * rather than the row it came from. Writing a flat object here would test a
     * shape no revision has ever had.
     */
    const writeRevision = async (
      itemId: number,
      version: number,
      fields: Record<string, unknown>,
      contentTypeId = "example.article",
    ) => {
      const snapshot = {
        contentTypeId,
        createdAt: new Date(0).toISOString(),
        fields,
        id: itemId,
        schemaVersion: 1,
        updatedAt: new Date(0).toISOString(),
        version,
      };

      const [row] = await h.sql<{ id: number }[]>`
        INSERT INTO "core_content_revisions"
          ("pluginId", "contentTypeId", "itemId", "version", "operation",
           "actorType", "snapshot")
        VALUES (
          ${CONFIG_PLUGIN.pluginId}, ${contentTypeId}, ${itemId}, ${version},
          'update', 'staff', ${JSON.stringify(snapshot)}::jsonb
        )
        RETURNING "id"
      `;

      return row.id;
    };

    it("ignores a field the content type has since dropped", async () => {
      const created = await article();
      const revisionId = await writeRevision(created.id, 900, {
        // `subtitle` was a field once. It is not one now, and a restore has to
        // drop it rather than hand it to a strict schema that will refuse it.
        subtitle: "A field that no longer exists",
        title: "Restored from an older shape",
      });

      const outcome = await editorial(h.context).restore(
        created.id,
        revisionId,
        { actor: ACTOR, expectedVersion: created.version },
      );

      expect(outcome?.changed).toBe(true);
      const [row] = await h.sql<{ title: string }[]>`
        SELECT "title" FROM "example_articles" WHERE "id" = ${created.id}
      `;
      expect(row.title).toBe("Restored from an older shape");
    });

    it("leaves a field added since the snapshot exactly as it stands", async () => {
      // The update schema is partial, so a field the snapshot never carried is
      // simply not written - which is the only answer that does not invent a
      // value nobody chose.
      const created = await article();
      await editorial(h.context).update(
        created.id,
        { excerpt: "Written after the snapshot" },
        { actor: ACTOR, expectedVersion: created.version },
      );
      const revisionId = await writeRevision(created.id, 901, {
        title: "Older still",
      });

      await editorial(h.context).restore(created.id, revisionId, {
        actor: ACTOR,
        expectedVersion: created.version + 1,
      });

      const [row] = await h.sql<{ excerpt: null | string; title: string }[]>`
        SELECT "title", "excerpt" FROM "example_articles" WHERE "id" = ${created.id}
      `;
      expect(row.title).toBe("Older still");
      expect(row.excerpt).toBe("Written after the snapshot");
    });

    it("refuses a snapshot whose value no longer validates, and writes nothing", async () => {
      const created = await article();
      const before = await h.sql<{ title: string; version: number }[]>`
        SELECT "title", "version" FROM "example_articles" WHERE "id" = ${created.id}
      `;
      const revisionId = await writeRevision(created.id, 902, {
        // `title` has a three-character minimum today. It did not always.
        title: "No",
      });

      await expect(
        editorial(h.context).restore(created.id, revisionId, {
          actor: ACTOR,
          expectedVersion: created.version,
        }),
      ).rejects.toBeInstanceOf(ContentRevisionNotRestorable);

      // All or nothing: the record is byte-identical to what it was.
      const after = await h.sql<{ title: string; version: number }[]>`
        SELECT "title", "version" FROM "example_articles" WHERE "id" = ${created.id}
      `;
      expect(after).toEqual(before);
    });

    it("names the field, and nothing internal, when it refuses", async () => {
      const created = await article();
      const revisionId = await writeRevision(created.id, 903, {
        title: "No",
      });

      try {
        await editorial(h.context).restore(created.id, revisionId, {
          actor: ACTOR,
          expectedVersion: created.version,
        });
        throw new Error("Expected the restore to be refused.");
      } catch (error) {
        expect(error).toBeInstanceOf(ContentRevisionNotRestorable);
        const refusal = error as ContentRevisionNotRestorable;
        expect(refusal.fields).toEqual(["title"]);
        // Never a Zod issue tree: it names internal paths, and the route's
        // OpenAPI schema already describes the contract.
        expect(JSON.stringify(refusal.fields)).not.toContain("_zod");
      }
    });

    it("refuses when a relation target in the snapshot is gone", async () => {
      const created = await advanced(h.context).create(
        { categories: [categoryId] },
        { actor: ACTOR },
      );
      const [spare] = await h.sql<{ id: number }[]>`
        INSERT INTO "example_categories" ("name") VALUES ('Doomed') RETURNING "id"
      `;
      const revisionId = await writeRevision(
        created.row.id,
        904,
        { categories: [spare.id] },
        "example.advanced-article",
      );
      await h.sql`DELETE FROM "example_categories" WHERE "id" = ${spare.id}`;

      await expect(
        advanced(h.context).restore(created.row.id, revisionId, {
          actor: ACTOR,
          expectedVersion: created.version,
        }),
      ).rejects.toBeInstanceOf(ContentRevisionNotRestorable);

      // Nothing partial: the relation it *could* have restored is untouched.
      const rows = await h.sql<{ relatedItemId: number }[]>`
        SELECT "relatedItemId" FROM "example_advanced_articles_categories"
        WHERE "itemId" = ${created.row.id}
      `;
      expect(rows.map(row => row.relatedItemId)).toEqual([categoryId]);
    });

    it("recreates a repeatable child whose identifier is gone", async () => {
      // The other rule, and the reason the two kinds differ: a child's values
      // are all in the snapshot, so recreating it loses nothing but its
      // identifier. A relation target's values were never there to begin with.
      const created = await advanced(h.context).create({}, { actor: ACTOR });
      const seeded = await advanced(h.context).repeatable.faq.set(
        created.row.id,
        [{ answer: "The answer", question: "The question" }],
        { actor: ACTOR, expectedVersion: created.version },
      );
      const [child] = await h.sql<{ id: number }[]>`
        SELECT "id" FROM "example_advanced_articles_faq"
        WHERE "itemId" = ${created.row.id}
      `;

      await advanced(h.context).repeatable.faq.delete(
        created.row.id,
        child.id,
        { actor: ACTOR, expectedVersion: seeded?.version ?? created.version },
      );

      const revisionId = await writeRevision(
        created.row.id,
        905,
        {
          faq: [
            { answer: "The answer", id: child.id, question: "The question" },
          ],
        },
        "example.advanced-article",
      );

      const [current] = await h.sql<{ version: number }[]>`
        SELECT "version" FROM "example_advanced_articles"
        WHERE "id" = ${created.row.id}
      `;
      const outcome = await advanced(h.context).restore(
        created.row.id,
        revisionId,
        { actor: ACTOR, expectedVersion: current.version },
      );

      expect(outcome?.changed).toBe(true);
      const rows = await h.sql<{ id: number; question: string }[]>`
        SELECT "id", "question" FROM "example_advanced_articles_faq"
        WHERE "itemId" = ${created.row.id}
      `;
      expect(rows).toHaveLength(1);
      expect(rows[0].question).toBe("The question");
      // A new identifier, because the old row is gone. The values came back;
      // the identity did not, and could not.
      expect(rows[0].id).not.toBe(child.id);
    });

    it("keeps the restored-from revision untouched", async () => {
      const created = await article();
      const revisionId = await writeRevision(created.id, 906, {
        title: "Immutable source",
      });
      const [before] = await h.sql<{ snapshot: unknown; version: number }[]>`
        SELECT "snapshot", "version" FROM "core_content_revisions"
        WHERE "id" = ${revisionId}
      `;

      await editorial(h.context).restore(created.id, revisionId, {
        actor: ACTOR,
        expectedVersion: created.version,
      });

      const [after] = await h.sql<{ snapshot: unknown; version: number }[]>`
        SELECT "snapshot", "version" FROM "core_content_revisions"
        WHERE "id" = ${revisionId}
      `;
      expect(after).toEqual(before);
    });

    it("moves the record forward rather than backward", async () => {
      const created = await article();
      const revisionId = await writeRevision(created.id, 907, {
        title: "Rolled forward",
      });

      const outcome = await editorial(h.context).restore(
        created.id,
        revisionId,
        { actor: ACTOR, expectedVersion: created.version },
      );

      // A restore is an edit, not a rewind: the version increases and the
      // history gains an entry rather than losing one.
      expect(outcome?.version).toBe(created.version + 1);
      expect(outcome?.restoredFromRevisionId).toBe(revisionId);
    });
  });

  // -------------------------------------------------------------------------
  // Disabled locales
  // -------------------------------------------------------------------------

  /**
   * The Stage 5 policy, unchanged and now pinned on both kinds of localized
   * content type:
   *
   * | create | update | restore | publish | unpublish | delete | read |
   * | ------ | ------ | ------- | ------- | --------- | ------ | ---- |
   * | refuse | refuse | refuse  | refuse  | allow     | allow  | allow|
   *
   * The asymmetry is the point. Switching a language off must stop new content
   * going into it, and must **not** trap the content that is already there:
   * taking a page down and deleting it are exactly the operations an
   * administrator needs after switching the language off.
   */
  describe("a locale the installation has switched off", () => {
    const DISABLED = "de";

    /** A record with a `de` translation already written, before the switch-off. */
    const withGermanTranslation = async () => {
      const { row } = await localizedService(h.context).create(
        { shared: {}, translation: { body: "Body", title: "Locale Policy" } },
        { actor: ACTOR },
      );
      const [german] = await h.sql<{ id: number }[]>`
        SELECT "id" FROM "core_languages" WHERE "code" = ${DISABLED}
      `;
      await h.sql`
        INSERT INTO "example_localized_articles_translations"
          ("itemId", "languageId", "title", "slug", "body", "version", "status")
        VALUES (${row.id}, ${german.id}, 'Deutsch', 'deutsch', 'Körper', 1, 'published')
      `;

      return { itemId: row.id, languageId: german.id };
    };

    const isDisabled = (error: unknown): boolean =>
      error instanceof ContentLanguageError && error.reason === "disabled";

    it("refuses a create", async () => {
      const { row } = await localizedService(h.context).create(
        { shared: {}, translation: { body: "Body", title: "Refused Create" } },
        { actor: ACTOR },
      );

      await expect(
        translationEditorial(h.context).create(
          row.id,
          DISABLED,
          { body: "Körper", title: "Deutsch" },
          { actor: ACTOR },
        ),
      ).rejects.toSatisfy(isDisabled);
    });

    it("refuses an update", async () => {
      const { itemId } = await withGermanTranslation();

      await expect(
        translationEditorial(h.context).update(
          itemId,
          DISABLED,
          { title: "Deutsch Neu" },
          { actor: ACTOR, expectedVersion: 1 },
        ),
      ).rejects.toSatisfy(isDisabled);
    });

    it("refuses a publish", async () => {
      const { itemId } = await withGermanTranslation();

      await expect(
        translationEditorial(h.context).publish(itemId, DISABLED, {
          actor: ACTOR,
        }),
      ).rejects.toSatisfy(isDisabled);
    });

    it("refuses a restore", async () => {
      const { itemId, languageId } = await withGermanTranslation();
      const [revision] = await h.sql<{ id: number }[]>`
        INSERT INTO "core_content_revisions"
          ("pluginId", "contentTypeId", "itemId", "languageId", "version",
           "operation", "actorType", "snapshot")
        VALUES (
          ${CONFIG_PLUGIN.pluginId}, 'example.localized-article', ${itemId},
          ${languageId}, 1, 'create', 'staff',
          ${JSON.stringify({ body: "Alt", slug: "alt", title: "Alt", version: 1 })}::jsonb
        )
        RETURNING "id"
      `;

      await expect(
        translationEditorial(h.context).restore(itemId, DISABLED, revision.id, {
          actor: ACTOR,
          expectedVersion: 1,
        }),
      ).rejects.toSatisfy(isDisabled);
    });

    it("still allows an unpublish, which is how a page comes down", async () => {
      const { itemId } = await withGermanTranslation();

      const outcome = await translationEditorial(h.context).unpublish(
        itemId,
        DISABLED,
        { actor: ACTOR },
      );

      expect(outcome?.changed).toBe(true);
    });

    it("still allows a delete", async () => {
      const { itemId } = await withGermanTranslation();

      const outcome = await translationEditorial(h.context).delete(
        itemId,
        DISABLED,
        { actor: ACTOR, expectedVersion: 1 },
      );

      expect(outcome?.changed).toBe(true);
      const rows = await h.sql<{ count: number }[]>`
        SELECT count(*)::int AS count
        FROM "example_localized_articles_translations"
        WHERE "itemId" = ${itemId}
      `;
      expect(rows[0].count).toBe(1);
    });

    it("still allows a read and a history read", async () => {
      const { itemId } = await withGermanTranslation();
      const build = localizedArticleContent.translationService;
      if (!build) throw new Error("no translation service");

      const translation = await build(h.context).findByLocale(itemId, DISABLED);
      const history = await translationEditorial(h.context).listRevisions(
        itemId,
        DISABLED,
      );

      expect(translation?.locale).toBe(DISABLED);
      expect(history.edges).toEqual([]);
    });

    it("applies the same policy to an advanced localized content type", async () => {
      // The rule is the language resolver's, not the content type's - so a
      // content type with groups and repeatables gets exactly the same answers.
      const created = await advanced(h.context).create({}, { actor: ACTOR });

      await expect(
        advancedTranslations(h.context).create(
          created.row.id,
          DISABLED,
          { title: "Deutsch" },
          { actor: ACTOR },
        ),
      ).rejects.toSatisfy(isDisabled);
    });
  });
});
