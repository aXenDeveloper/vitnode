import type { Context } from "hono";

import { describe, expect, it } from "vitest";

import type { AnyContentTypeDefinition } from "../types";
import type { ContentAuditWrite } from "./audit";
import type { ContentDatabase } from "./service";

import { writeAuditLog } from "../../api/lib/audit/write";
import { core_audit_logs } from "../../database/audit";
import { core_users } from "../../database/users";
import { createMemoryDb } from "../../tests/memory-db";
import { defineContentType } from "../define";
import { field } from "../fields";
import {
  collectContentTranslationAudit,
  recordContentAudit,
  withContentDuplicateAudit,
} from "./audit";

const definition = defineContentType({
  id: "test.note",
  tableName: "test_notes",
  fields: {
    title: field.text({ required: true }),
    views: field.number({ integer: true, defaultValue: 0 }),
  },
  audit: { excludeFields: ["views"] },
}) as AnyContentTypeDefinition;

const EDITOR = { id: 4, name: "Editor" };

const harness = () => {
  const memory = createMemoryDb([[core_users, [EDITOR]]]);
  const c = {
    get: (key: string) =>
      key === "db" ? memory.db : key === "admin" ? { user: EDITOR } : undefined,
  } as unknown as Context;
  const tx = memory.db as unknown as ContentDatabase;

  const record = async (overrides: Partial<ContentAuditWrite>) =>
    await recordContentAudit(c, tx, {
      action: "created",
      actor: { type: "staff", userId: EDITOR.id },
      definition,
      itemId: 9,
      pluginId: "@vitnode/notes",
      ...overrides,
    });

  return {
    c,
    entries: () => memory.rows(core_audit_logs),
    record,
  };
};

describe("recordContentAudit", () => {
  it("names the changed fields without the excluded ones", async () => {
    const h = harness();

    await h.record({ action: "updated", changedFields: ["title", "views"] });

    expect(h.entries()[0]).toMatchObject({
      action: "content.updated",
      contentTypeId: "test.note",
      metadata: { changedFields: ["title"] },
      pluginId: "@vitnode/notes",
      targetType: "test.note",
    });
  });

  it("drops values and field names when trackChanges is off", async () => {
    const h = harness();

    await h.record({
      action: "updated",
      changedFields: ["title"],
      changes: { title: { from: "a", to: "b" } },
      definition: {
        ...definition,
        audit: { ...definition.audit, trackChanges: false },
      },
    });

    expect(h.entries()[0]).toMatchObject({ changes: null, metadata: {} });
  });

  it("writes a system actor's entry to the system area", async () => {
    const h = harness();

    await h.record({
      action: "published",
      actor: { type: "system", userId: null },
    });

    expect(h.entries()[0]).toMatchObject({
      actorId: null,
      actorType: "system",
      area: "system",
      ipAddress: null,
    });
  });
});

describe("withContentDuplicateAudit", () => {
  it("leaves one content.duplicated entry naming the source, and no translation entries", async () => {
    const h = harness();

    await withContentDuplicateAudit(h.c, definition, 3, async () => {
      await h.record({ action: "created" });
      await h.record({ action: "translation_created", locale: "pl" });
      await writeAuditLog(h.c, {
        action: "role.updated",
        target: { id: 1, type: "role" },
      });
    });

    expect(h.entries()).toEqual([
      expect.objectContaining({
        action: "content.duplicated",
        metadata: { sourceId: 3 },
        targetId: "9",
      }),
      expect.objectContaining({ action: "role.updated" }),
    ]);
  });
});

describe("collectContentTranslationAudit", () => {
  it("holds back the record's translation entries and writes the rest", async () => {
    const h = harness();

    const { entries } = await collectContentTranslationAudit(
      h.c,
      definition,
      async () => {
        await h.record({ action: "translation_published", locale: "pl" });
        await h.record({ action: "published" });
      },
    );

    expect(entries.map(entry => entry.metadata.locale)).toEqual(["pl"]);
    expect(h.entries().map(entry => entry.action)).toEqual([
      "content.published",
    ]);
  });
});
