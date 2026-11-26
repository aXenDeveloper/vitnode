import type { Context } from "hono";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { RichTextDocument } from "@/content/rich-text/document";
import type { EnvVitNode } from "@/middlewares/global.middleware";
import type { PostgresTestSchema } from "@/tests/postgres";

import { autoTranslateFingerprint } from "@/content/auto-translate/source-hash";
import { defineContentType } from "@/content/define";
import { field } from "@/content/fields";
import { createContentModel } from "@/content/server/model";
import { core_content_ai_translations } from "@/database/content-translations";
import { core_languages } from "@/database/languages";
import { createTestCache } from "@/tests/cache";
import { createPostgresTestSchema, POSTGRES_TEST_URL } from "@/tests/postgres";

import { cleanupContentTranslations } from "./cleanup";

const noteType = defineContentType({
  id: "test.localized-cleanup-note",
  tableName: "test_localized_cleanup_notes",
  publication: true,
  localization: { defaultLocale: "en", fallback: "default" },
  autoTranslate: { fields: ["body"] },
  fields: {
    title: field.text({ localized: true, required: true, maxLength: 200 }),
    slug: field.slug({ localized: true, source: "title" }),
    body: field.richText({ localized: true, required: true }),
  },
  publicApi: {
    path: "localized-cleanup-notes",
    fields: ["id", "title", "slug", "body"],
  },
});
const notes = createContentModel(noteType);

const doc = (text: string): RichTextDocument => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const EN_BODY = doc("After the update I cannot sign in on my phone.");
const PL_BODY = doc("Po aktualizacji nie mogę się zalogować na telefonie.");
const translations = core_content_ai_translations;

describe.skipIf(!POSTGRES_TEST_URL)(
  "cleaning up translations of localized content on PostgreSQL",
  () => {
    let schema: PostgresTestSchema;
    let recordId: string;

    const cleanup = async () => {
      const values: Record<string, unknown> = {
        cache: createTestCache(),
        core: {
          contentModels: [{ model: notes, pluginId: "@vitnode/example" }],
        },
        db: schema.db,
      };

      return await cleanupContentTranslations({
        get: (key: string) => values[key],
      } as unknown as Context<EnvVitNode>);
    };

    beforeAll(async () => {
      if (!notes.translationTable) throw new Error("Not localized.");
      schema = await createPostgresTestSchema({
        prefix: "vitnode_translate_cleanup",
        tables: { notes: notes.table, translations: notes.translationTable },
      });
      const languages = await schema.db
        .insert(core_languages)
        .values([
          { code: "en", default: true, name: "English" },
          { code: "pl", name: "Polski" },
        ])
        .returning({ code: core_languages.code, id: core_languages.id });

      const publishedAt = new Date(Date.now() - 60_000);
      const [note] = await schema.db
        .insert(notes.table)
        .values({ publishedAt, status: "published" } as never)
        .returning();
      const itemId = (note as { id: number }).id;
      recordId = String(itemId);
      await schema.db.insert(notes.translationTable).values(
        [
          { body: EN_BODY, locale: "en", slug: "sign-in", title: "Sign-in" },
          {
            body: PL_BODY,
            locale: "pl",
            slug: "logowanie",
            title: "Logowanie",
          },
        ].map(({ locale, ...values }) => ({
          ...values,
          itemId,
          languageId: languages.find(language => language.code === locale)?.id,
          publishedAt,
          status: "published",
        })) as never,
      );
    });

    afterAll(async () => {
      await schema.drop();
    });

    it.each<[string, null | string, RichTextDocument, boolean]>([
      ["the default language", "en", EN_BODY, false],
      ["another language", "pl", PL_BODY, false],
      ["an older default-language text", "en", doc("An older body."), true],
      ["the text without its served language", null, EN_BODY, true],
    ])(
      "supersedes a translation of %s only when no language reproduces it",
      async (_case, sourceLocale, value, superseded) => {
        const [row] = await schema.db
          .insert(translations)
          .values({
            contentTypeId: noteType.id,
            field: "body",
            promptVersion: 1,
            recordId,
            sourceFingerprint: autoTranslateFingerprint({
              field: "body",
              sourceLocale,
              value,
            }),
            targetLocale: "de",
            value: doc("Übersetzt"),
          })
          .returning({ id: translations.id });

        await cleanup();

        const [after] = await schema.db
          .select({ supersededAt: translations.supersededAt })
          .from(translations)
          .where(eq(translations.id, row.id));
        expect(after.supersededAt !== null).toBe(superseded);
      },
    );
  },
);
