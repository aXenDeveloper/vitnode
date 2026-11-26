import type { Context } from "hono";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AutoTranslateResponse } from "@/content/auto-translate/schemas";
import type { RichTextDocument } from "@/content/rich-text/document";
import type { EnvVitNode } from "@/middlewares/global.middleware";
import type { PostgresTestSchema } from "@/tests/postgres";

import { autoTranslateFingerprint } from "@/content/auto-translate/source-hash";
import { defineContentType } from "@/content/define";
import { field } from "@/content/fields";
import { createContentModel } from "@/content/server/model";
import { core_ai_runs } from "@/database/ai";
import {
  core_content_ai_translation_jobs,
  core_content_translation_settings,
} from "@/database/content-translations";
import { core_languages } from "@/database/languages";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { createPostgresTestSchema, POSTGRES_TEST_URL } from "@/tests/postgres";

import { CONTENT_TRANSLATE_AI_ACTION } from "./action";
import { lookupAutoTranslations, requestAutoTranslations } from "./service";

const noteType = defineContentType({
  id: "test.queued-note",
  tableName: "test_queued_notes",
  publication: true,
  autoTranslate: {
    fields: ["summary", "body"],
    languageFrom: { summary: "body" },
  },
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    slug: field.slug({ source: "title" }),
    summary: field.richText({ required: true }),
    body: field.richText({ required: true }),
  },
  publicApi: {
    path: "queued-notes",
    fields: ["id", "title", "slug", "summary", "body", "publishedAt"],
  },
});
const notes = createContentModel(noteType);

const localizedNoteType = defineContentType({
  id: "test.localized-queued-note",
  tableName: "test_localized_queued_notes",
  publication: true,
  localization: { defaultLocale: "en", fallback: "default" },
  autoTranslate: { fields: ["body"] },
  fields: {
    title: field.text({ localized: true, required: true, maxLength: 200 }),
    slug: field.slug({ localized: true, source: "title" }),
    body: field.richText({ localized: true, required: true }),
  },
  publicApi: {
    path: "localized-queued-notes",
    fields: ["id", "title", "slug", "body"],
  },
});
const localizedNotes = createContentModel(localizedNoteType);

const doc = (text: string): RichTextDocument => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const BODY = doc(
  "Po aktualizacji nie mogę się zalogować na telefonie, czy ktoś wie co jest nie tak?",
);
const TITLE = "Problem z logowaniem";
const SUMMARY = doc(TITLE);
const jobs = core_content_ai_translation_jobs;

describe.skipIf(!POSTGRES_TEST_URL)(
  "queuing translations on PostgreSQL",
  () => {
    let schema: PostgresTestSchema;
    const users: number[] = [];
    let dispatched: number[][] = [];
    let nextNote = 0;

    const contextFor = (userId: number) => {
      const values: Record<string, unknown> = {
        ai: {
          ledger: () => ({
            loadSettings: async () =>
              await Promise.resolve({ timeZone: "UTC" }),
          }),
        },
        cache: createTestCache(),
        core: {
          contentModels: [{ model: notes, pluginId: "@vitnode/example" }],
        },
        db: schema.db,
        events: { emit: async () => await Promise.resolve({ failures: [] }) },
        queue: {
          dispatch: async (_task: unknown, payload: { jobIds: number[] }) => {
            dispatched.push(payload.jobIds);

            // No id: the worker is not started from here.
            return await Promise.resolve({ deduplicated: false, id: null });
          },
        },
        user: { id: userId },
      };

      return {
        get: (key: string) => values[key],
      } as unknown as Context<EnvVitNode>;
    };

    const settings = async (
      values: Partial<typeof core_content_translation_settings.$inferInsert>,
    ) => {
      await schema.db
        .update(core_content_translation_settings)
        .set(values)
        .where(eq(core_content_translation_settings.id, 1));
    };

    const createNote = async () => {
      nextNote++;
      const [row] = await schema.db
        .insert(notes.table)
        .values({
          body: BODY,
          publishedAt: new Date(Date.now() - 60_000),
          slug: `note-${nextNote}`,
          status: "published",
          summary: SUMMARY,
          title: TITLE,
        } as never)
        .returning();

      return String((row as { id: number }).id);
    };

    const request = async (
      userId: number,
      recordId: string,
      mode: "automatic" | "manual" = "manual",
    ) =>
      await requestAutoTranslations(contextFor(userId), {
        items: [
          {
            contentTypeId: noteType.id,
            fields: [{ name: "summary" }, { name: "body" }],
            id: recordId,
          },
        ],
        locale: "en",
        mode,
      });

    const statesOf = (response: AutoTranslateResponse) =>
      response.items[0]?.fields.map(({ name, reason, state }) => ({
        name,
        reason,
        state,
      }));

    const jobsOf = async (recordId: string) =>
      await schema.db
        .select()
        .from(jobs)
        .where(eq(jobs.recordId, recordId))
        .orderBy(jobs.field);

    const jobKey = (recordId: string, name: "body" | "summary") => ({
      contentTypeId: noteType.id,
      field: name,
      recordId,
      sourceFingerprint: autoTranslateFingerprint({
        field: name,
        value: name === "body" ? BODY : SUMMARY,
      }),
      targetLocale: "en",
    });

    beforeAll(async () => {
      schema = await createPostgresTestSchema({
        prefix: "vitnode_translate_queue",
        tables: { notes: notes.table },
      });
      await schema.db.insert(core_languages).values([
        { code: "en", name: "English" },
        { code: "pl", name: "Polski" },
      ]);
      await schema.db.insert(core_content_translation_settings).values({
        enabled: true,
        id: 1,
        locales: ["en", "pl"],
      });
      const [role] = await schema.db
        .insert(core_roles)
        .values({ updatedAt: new Date() })
        .returning({ id: core_roles.id });
      const rows = await schema.db
        .insert(core_users)
        .values(
          [1, 2, 3, 4].map(n => ({
            avatarColor: "000000",
            email: `reader${n}@example.com`,
            name: `Reader ${n}`,
            nameCode: `reader-${n}`,
            roleId: role.id,
          })),
        )
        .returning({ id: core_users.id });
      users.push(...rows.map(row => row.id));
    });

    beforeEach(async () => {
      dispatched = [];
      await settings({ monthlyBudgetUsd: "5", userHourlyLimit: 100 });
      await schema.db.delete(core_ai_runs);
    });

    afterAll(async () => {
      await schema.drop();
    });

    it("keeps one job per field for concurrent readers and dispatches it once", async () => {
      const recordId = await createNote();

      const responses = await Promise.all(
        users.slice(0, 3).map(async userId => await request(userId, recordId)),
      );

      for (const response of responses) {
        expect(statesOf(response)).toEqual([
          { name: "summary", reason: undefined, state: "pending" },
          { name: "body", reason: undefined, state: "pending" },
        ]);
      }
      const rows = await jobsOf(recordId);
      expect(rows.map(row => [row.field, row.status])).toEqual([
        ["body", "pending"],
        ["summary", "pending"],
      ]);
      const byId = (a: number, b: number) => a - b;
      expect(dispatched.flat().sort(byId)).toEqual(
        rows.map(row => row.id).sort(byId),
      );
    });

    it("re-arms a job that finished without a translation, and an automatic skip asked for by hand", async () => {
      const recordId = await createNote();
      const inAMonth = new Date(Date.now() + 30 * 24 * 3_600_000);
      await schema.db.insert(jobs).values([
        {
          ...jobKey(recordId, "summary"),
          attempts: 2,
          availableAt: new Date(Date.now() - 60_000),
          completedAt: new Date(),
          status: "completed",
        },
        {
          ...jobKey(recordId, "body"),
          availableAt: inAMonth,
          mode: "automatic",
          reason: "uncertain_language",
          status: "skipped",
        },
      ]);

      const response = await request(users[0], recordId, "manual");

      expect(statesOf(response)?.map(field => field.state)).toEqual([
        "pending",
        "pending",
      ]);
      expect(
        (await jobsOf(recordId)).map(row => ({
          attempts: row.attempts,
          field: row.field,
          mode: row.mode,
          reason: row.reason,
          status: row.status,
        })),
      ).toEqual([
        {
          attempts: 0,
          field: "body",
          mode: "manual",
          reason: null,
          status: "pending",
        },
        {
          attempts: 0,
          field: "summary",
          mode: "manual",
          reason: null,
          status: "pending",
        },
      ]);
      expect(dispatched).toHaveLength(1);
    });

    it("queues within the reader's hourly limit and refuses the rest", async () => {
      await settings({ userHourlyLimit: 1 });
      const recordId = await createNote();

      const response = await request(users[3], recordId);

      expect(statesOf(response)).toEqual([
        { name: "summary", reason: undefined, state: "pending" },
        { name: "body", reason: "limited", state: "unavailable" },
      ]);
      expect((await jobsOf(recordId)).map(row => row.field)).toEqual([
        "summary",
      ]);

      const later = await request(users[3], await createNote());
      expect(statesOf(later)?.map(field => field.reason)).toEqual([
        "limited",
        "limited",
      ]);
    });

    it("queues nothing once the month's translation budget is spent", async () => {
      await settings({ monthlyBudgetUsd: "1" });
      await schema.db.insert(core_ai_runs).values({
        actionKey: CONTENT_TRANSLATE_AI_ACTION,
        actorType: "system",
        pluginId: "@vitnode/core",
        pointsConversionVersion: 1,
        promptVersion: 1,
        reservedUsd: "1.5",
        status: "running",
      } as typeof core_ai_runs.$inferInsert);
      const recordId = await createNote();

      const response = await request(users[1], recordId);

      expect(statesOf(response)?.map(field => field.reason)).toEqual([
        "budget",
        "budget",
      ]);
      expect(await jobsOf(recordId)).toEqual([]);
      expect(dispatched).toEqual([]);
    });
  },
);

const EN_BODY = doc(
  "After the update I cannot sign in on my phone, does anyone know what is wrong?",
);

describe.skipIf(!POSTGRES_TEST_URL)(
  "looking up translations of localized content on PostgreSQL",
  () => {
    let schema: PostgresTestSchema;
    let recordId: string;

    const lookup = async (locale: string, fingerprint?: string) => {
      const values: Record<string, unknown> = {
        cache: createTestCache(),
        core: {
          contentModels: [
            { model: localizedNotes, pluginId: "@vitnode/example" },
          ],
        },
        db: schema.db,
      };
      const response = await lookupAutoTranslations(
        { get: (key: string) => values[key] } as unknown as Context<EnvVitNode>,
        {
          items: [
            {
              contentTypeId: localizedNoteType.id,
              fields: [{ fingerprint, name: "body" }],
              id: recordId,
            },
          ],
          locale,
        },
      );

      return response.items[0]?.fields[0];
    };

    beforeAll(async () => {
      if (!localizedNotes.translationTable) throw new Error("Not localized.");
      schema = await createPostgresTestSchema({
        prefix: "vitnode_translate_localized",
        tables: {
          notes: localizedNotes.table,
          translations: localizedNotes.translationTable,
        },
      });
      const languages = await schema.db
        .insert(core_languages)
        .values([
          { code: "en", default: true, name: "English" },
          { code: "pl", name: "Polski" },
          { code: "de", name: "Deutsch" },
        ])
        .returning({ code: core_languages.code, id: core_languages.id });
      const languageId = (code: string) =>
        languages.find(language => language.code === code)?.id;
      await schema.db.insert(core_content_translation_settings).values({
        enabled: true,
        id: 1,
        locales: ["en", "pl", "de"],
      });

      const publishedAt = new Date(Date.now() - 60_000);
      const [note] = await schema.db
        .insert(localizedNotes.table)
        .values({ publishedAt, status: "published" } as never)
        .returning();
      recordId = String((note as { id: number }).id);
      await schema.db.insert(localizedNotes.translationTable).values(
        [
          { body: EN_BODY, locale: "en", slug: "sign-in", title: "Sign-in" },
          { body: BODY, locale: "pl", slug: "logowanie", title: TITLE },
        ].map(({ locale, ...values }) => ({
          ...values,
          itemId: (note as { id: number }).id,
          languageId: languageId(locale),
          publishedAt,
          status: "published",
        })) as never,
      );
    });

    afterAll(async () => {
      await schema.drop();
    });

    const served = (sourceLocale: string, value: unknown) =>
      autoTranslateFingerprint({ field: "body", sourceLocale, value });

    it.each<[string, string, string | undefined, Record<string, unknown>]>([
      [
        "an editorial translation as the original",
        "pl",
        undefined,
        {
          fingerprint: served("pl", BODY),
          sourceLocale: "pl",
          state: "original",
        },
      ],
      [
        "the default language as the original",
        "en",
        undefined,
        {
          fingerprint: served("en", EN_BODY),
          sourceLocale: "en",
          state: "original",
        },
      ],
      [
        "the default language served in place of a missing translation as missing",
        "de",
        served("en", EN_BODY),
        { fingerprint: served("en", EN_BODY), state: "missing" },
      ],
      [
        "a fingerprint taken without the served language as stale",
        "de",
        autoTranslateFingerprint({ field: "body", value: EN_BODY }),
        { state: "stale" },
      ],
    ])(
      "treats %s for a reader in %s",
      async (_case, locale, fingerprint, result) => {
        expect(await lookup(locale, fingerprint)).toMatchObject(result);
      },
    );
  },
);
