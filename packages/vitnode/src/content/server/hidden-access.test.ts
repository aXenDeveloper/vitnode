import type { Context } from "hono";

import { describe, expect, it } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { defineContentType } from "../define";
import { field } from "../fields";
import { findViewableHiddenBySlug } from "./hidden-access";
import { createContentModel } from "./model";

const PLUGIN = "@vitnode/test";
const FAMILY = "test.section";

const topics = defineContentType({
  id: "test.moderated-topic",
  tableName: "test_moderated_topics",
  publication: true,
  visibility: true,
  fields: {
    title: field.text({ required: true }),
    slug: field.slug({ source: "title" }),
    sectionId: field.number({ integer: true, defaultValue: 0 }),
  },
  publicApi: { path: "moderated-topics", fields: ["id", "title", "slug"] },
  reports: true,
});
const model = createContentModel(topics, {
  moderationScope: { column: "sectionId", family: FAMILY },
});

const MODERATOR = { id: 9, roleId: 3 };

const find = async (moderator: PermissionsStaffArgs[]) => {
  const cache = createTestCache();
  await grantStaffPermissions(cache, { permissions: [], userId: MODERATOR.id });
  await grantStaffPermissions(cache, {
    permissions: moderator,
    type: "moderator",
    userId: MODERATOR.id,
  });
  const { db } = createMemoryDb([
    [
      model.table,
      [
        {
          hiddenAt: new Date(),
          id: 1,
          publishedAt: new Date("2026-01-01T00:00:00.000Z"),
          sectionId: 10,
          slug: "hidden-topic",
          status: "published",
          title: "Hidden topic",
        },
      ],
    ],
  ]);
  const values: Record<string, unknown> = { cache, db, user: MODERATOR };
  const c = { get: (key: string) => values[key] } as unknown as Context;

  return await findViewableHiddenBySlug(c, {
    locale: undefined,
    model,
    pluginId: PLUGIN,
    slug: "hidden-topic",
  });
};

const viewHidden = (scope?: PermissionsStaffArgs["scope"]) => ({
  module: topics.permissionModule,
  permission: "can_view_hidden",
  plugin: PLUGIN,
  ...(scope ? { scope } : {}),
});

describe("a moderator opening hidden content", () => {
  it.each<[string, PermissionsStaffArgs[], boolean]>([
    [
      "opens it with can_view_hidden in the record's section",
      [viewHidden({ family: FAMILY, ids: ["10"], mode: "selected" })],
      true,
    ],
    [
      "opens it with can_view_hidden in every section",
      [viewHidden({ family: FAMILY, mode: "all" })],
      true,
    ],
    [
      "keeps it closed with can_view_hidden in another section",
      [viewHidden({ family: FAMILY, ids: ["20"], mode: "selected" })],
      false,
    ],
    ["keeps it closed without can_view_hidden", [], false],
  ])("%s", async (_label, moderator, visible) => {
    const row = await find(moderator);

    expect(row?.slug ?? null).toBe(visible ? "hidden-topic" : null);
  });
});
