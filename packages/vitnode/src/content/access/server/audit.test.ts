import type { Context } from "hono";

import { describe, expect, it } from "vitest";

import type { ContentDatabase } from "@/content/server/service";

import { defineContentType } from "@/content/define";
import { field } from "@/content/fields";
import { createContentModel } from "@/content/server/model";
import { core_audit_logs } from "@/database/audit";
import { core_languages } from "@/database/languages";
import {
  ACCESS_PLUGIN_ID,
  createAccessWorld,
  testAccessBoards,
  USER,
} from "@/tests/content-access";
import { createMemoryDb } from "@/tests/memory-db";

import {
  recordContentAccessFilesProtected,
  recordContentAccessUpdate,
} from "./audit";
import { findContentAccessFamily } from "./families";

const ADMIN = { id: USER.ROOT, name: "Admin" };

const localizedCategories = createContentModel(
  defineContentType({
    id: "test.access-localized-category",
    tableName: "test_access_localized_categories",
    localization: { defaultLocale: "en" },
    fields: {
      title: field.text({ localized: true, required: true, maxLength: 100 }),
    },
    access: { scope: true },
  }),
);

const contextOf = (values: Record<string, unknown>): Context =>
  ({
    get: (key: string) => ({ ...values, admin: { user: ADMIN } })[key],
  }) as unknown as Context;

describe("recordContentAccessUpdate", () => {
  it("labels a localized scope with its default translation's title", async () => {
    const translations = localizedCategories.translationTable;
    if (!translations) throw new Error("The category is not localized.");
    const memory = createMemoryDb([
      [core_languages, [{ code: "en", default: true, id: 1 }]],
      [localizedCategories.table, [{ id: 7 }]],
      [translations, [{ itemId: 7, languageId: 1, title: "News" }]],
    ]);
    const c = contextOf({
      core: {
        contentModels: [
          { model: localizedCategories, pluginId: ACCESS_PLUGIN_ID },
        ],
      },
      db: memory.db,
    });
    const family = findContentAccessFamily(
      c,
      localizedCategories.definition.id,
    );
    if (!family) throw new Error("The localized family is not registered.");

    await recordContentAccessUpdate(
      c,
      memory.db as unknown as ContentDatabase,
      {
        after: { view: { mode: "members" } },
        before: {},
        changedActions: ["view"],
        family,
        scopeId: "7",
      },
    );

    expect(memory.rows(core_audit_logs)).toEqual([
      expect.objectContaining({ targetId: "7", targetLabel: "News" }),
    ]);
  });
});

describe("recordContentAccessFilesProtected", () => {
  it.each([
    ["files moved", { moved: 3, remaining: 120, shared: 0 }, 1],
    ["shared files left public", { moved: 0, remaining: 0, shared: 2 }, 1],
    ["nothing", { moved: 0, remaining: 0, shared: 0 }, 0],
  ])("records %s", async (_label, result, count) => {
    const world = await createAccessWorld();
    const c = contextOf(world.contextValues(ADMIN.id));
    const family = findContentAccessFamily(c, testAccessBoards.id);
    if (!family) throw new Error("The boards family is not registered.");

    await recordContentAccessFilesProtected(c, { family, result });

    expect(world.memory.rows(core_audit_logs)).toEqual(
      Array.from({ length: count }, () =>
        expect.objectContaining({
          action: "content.access_files_protected",
          actorId: ADMIN.id,
          actorType: "staff",
          area: "admin",
          contentTypeId: null,
          metadata: result,
          pluginId: ACCESS_PLUGIN_ID,
          targetId: null,
          targetType: testAccessBoards.id,
        }),
      ),
    );
  });
});
