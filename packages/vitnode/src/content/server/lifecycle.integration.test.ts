// @vitest-environment node
import type { Context } from "hono";

import { eq } from "drizzle-orm";
import { createTranslator } from "use-intl";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  core_content_file_refs,
  core_content_revisions,
  core_content_slug_history,
} from "@/database/content";
import { core_files } from "@/database/files";
import { core_languages } from "@/database/languages";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import apiMessages from "@/locales/api/en.json";
import { createTestCache } from "@/tests/cache";
import {
  createTestDatabase,
  describePostgres,
  type TestDatabaseHandle,
} from "@/tests/postgres";

import { defineContentType } from "../define";
import { field } from "../fields";
import { createContentModel } from "./model";

// The three record-level features on one content type, the way the blog uses
// them: rich text, hiding and duplication interact only through the record, so
// this pins the contract between them rather than any one of them.
const storyContentType = defineContentType({
  id: "test.lifecycle-story",
  tableName: "test_lifecycle_stories",
  publication: { enabled: true },
  editorial: { enabled: true },
  visibility: { enabled: true },
  duplication: { enabled: true },
  fields: {
    title: field.text({ required: true, minLength: 1, maxLength: 120 }),
    slug: field.slug({ source: "title" }),
    body: field.richText({ required: true }),
  },
  publicApi: {
    enabled: true,
    path: "lifecycle-stories",
    fields: ["id", "title", "slug", "body", "publishedAt"],
  },
  admin: { titleField: "title" },
});

const stories = createContentModel(storyContentType);
const STAFF_ID = 41;
const actor = { type: "staff" as const, userId: STAFF_ID };

describePostgres(
  "rich text, hiding and duplication together (Postgres)",
  () => {
    let database: TestDatabaseHandle;

    const context = (): Context => {
      const values = new Map<string, unknown>([
        ["admin", { user: { id: STAFF_ID, roleId: 1 } }],
        ["cache", createTestCache()],
        ["core", { i18n: { defaultLocale: "en", locales: [{ code: "en" }] } }],
        ["db", database.db],
        [
          "events",
          { emit: async () => await Promise.resolve({ failures: [] }) },
        ],
        [
          "i18n",
          {
            getTranslator: async (locale: string) =>
              await Promise.resolve(
                createTranslator({ locale, messages: apiMessages }),
              ),
            resolveSupportedLocale: () => "en",
          },
        ],
        ["log", { error: async () => {}, warn: async () => {} }],
      ]);

      return {
        get: (key: string) => values.get(key),
        set: (key: string, value: unknown) => values.set(key, value),
      } as unknown as Context;
    };

    beforeAll(async () => {
      database = await createTestDatabase({
        core_content_file_refs,
        core_content_revisions,
        core_content_slug_history,
        core_files,
        core_languages,
        core_roles,
        core_users,
        stories: stories.table,
      });

      await database.db.insert(core_roles).values({ id: 1 });
      await database.db.insert(core_languages).values({
        code: "en",
        default: true,
        name: "English",
        timezone: "UTC",
      });
      await database.db.insert(core_users).values({
        avatarColor: "000000",
        email: "staff@example.com",
        id: STAFF_ID,
        ipAddress: "127.0.0.1",
        language: "en",
        name: "Staff",
        nameCode: "staff",
        roleId: 1,
      });
    }, 60_000);

    afterAll(async () => {
      await database?.drop();
    });

    it("copies a hidden, published story as a visible draft with sanitized HTML", async () => {
      const c = context();
      const editorial = stories.editorialService(c, {
        pluginId: "@vitnode/test",
      });

      const created = await editorial.create(
        {
          body: '<p onclick="steal()">Field <strong>notes</strong></p><script>alert(1)</script>',
          title: "Field notes",
        },
        { actor },
      );
      const sourceId = created.row.id;
      expect(created.row.body).toBe("<p>Field <strong>notes</strong></p>");

      await editorial.publish(sourceId, { actor });
      const hidden = await editorial.hide(sourceId, { actor });
      expect(hidden?.row.hiddenAt).toBeInstanceOf(Date);
      expect(hidden?.row.hiddenBy).toBe(STAFF_ID);

      const publicService = stories.publicService?.(c);
      expect(await publicService?.findBySlug("field-notes")).toBeNull();

      const copy = await editorial.duplicate(sourceId, { actor });
      if (!copy) throw new Error("The source story should exist.");

      expect(copy.sourceId).toBe(sourceId);
      expect(copy.row).toMatchObject({
        body: "<p>Field <strong>notes</strong></p>",
        hiddenAt: null,
        hiddenBy: null,
        publishedAt: null,
        slug: "field-notes-copy",
        status: "draft",
        title: "Field notes (Copy)",
        version: 1,
      });

      // The source keeps every bit of its own state.
      const [source] = await database.db
        .select()
        .from(stories.table)
        .where(eq(stories.table.id, sourceId));
      expect(source).toMatchObject({ status: "published" });
      expect(source?.hiddenAt).toBeInstanceOf(Date);

      // A draft copy is not public until it is published - and then it is,
      // because hiding was never copied.
      expect(await publicService?.findBySlug("field-notes-copy")).toBeNull();
      await editorial.publish(copy.row.id, { actor });
      expect(
        await stories.publicService?.(context()).findBySlug("field-notes-copy"),
      ).toMatchObject({ title: "Field notes (Copy)" });
      expect(
        await stories.publicService?.(context()).findBySlug("field-notes"),
      ).toBeNull();
    });
  },
);
