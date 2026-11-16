import type { Context } from "hono";

import { describe, expect, it } from "vitest";

import { core_users } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";

import { defineContentType } from "../define";
import { field } from "../fields";
import { createContentModel } from "./model";
import { contentReportTarget } from "./report-target";

const PLUGIN = "@vitnode/test";

const topics = defineContentType({
  id: "test.reported-topic",
  tableName: "test_reported_topics",
  publication: true,
  visibility: true,
  fields: {
    title: field.text({ required: true }),
    slug: field.slug({ source: "title" }),
    body: field.textarea({ required: true }),
    sectionId: field.number({ integer: true, defaultValue: 0 }),
  },
  publicApi: {
    path: "reported-topics",
    fields: ["id", "title", "slug", "body"],
  },
  reports: { snapshotFields: ["body"], titleField: "title" },
});
const model = createContentModel(topics);

const row = (id: number, overrides: Record<string, unknown>) => ({
  body: `Body ${id}`,
  hiddenAt: null,
  id,
  publishedAt: new Date("2026-01-01T00:00:00.000Z"),
  sectionId: 10,
  slug: `topic-${id}`,
  status: "published",
  title: `Topic ${id}`,
  ...overrides,
});

const capture = async (targetId: string) => {
  const { db } = createMemoryDb([
    [
      model.table,
      [
        row(1, {}),
        row(2, { hiddenAt: new Date() }),
        row(3, { publishedAt: null, status: "draft" }),
      ],
    ],
    [core_users, []],
  ]);
  const values: Record<string, unknown> = {
    cache: createTestCache(),
    db,
    user: { id: 5, roleId: 3 },
  };
  const c = { get: (key: string) => values[key] } as unknown as Context;

  return await contentReportTarget(model, PLUGIN).capture(c, {
    locale: null,
    targetId,
  });
};

describe("capturing a reported content record", () => {
  it("snapshots the configured fields of a published record", async () => {
    const snapshot = await capture("1");

    expect(snapshot?.title).toBe("Topic 1");
    expect(snapshot?.fields).toEqual([
      expect.objectContaining({ kind: "text", name: "body", value: "Body 1" }),
    ]);
  });

  it.each([
    ["hidden", "2"],
    ["draft", "3"],
    ["missing", "4"],
  ])("finds nothing to report on a %s record", async (_label, targetId) => {
    expect(await capture(targetId)).toBeNull();
  });
});
