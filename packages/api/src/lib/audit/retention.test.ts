import type { SQL } from "drizzle-orm";

import { inArray, is, Param } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { core_audit_logs } from "@/database/audit";
import { createMemoryDb } from "@/tests/memory-db";

import type { AuditDatabase } from "./write";

import { pruneAuditLogs } from "./retention";

const NOW = new Date("2026-10-24T12:00:00.000Z");
const DAY = 86_400_000;

const entry = (id: number, ageInDays: number) => ({
  action: "role.updated",
  actorType: "staff",
  area: "admin",
  createdAt: new Date(NOW.getTime() - ageInDays * DAY),
  id,
  metadata: {},
  pluginId: "@vitnode/core",
  targetType: "role",
});

/**
 * The memory db cannot evaluate a subquery, so the `id in (select ...)` of the
 * retention sweep is resolved first - with the sweep's own select - and the
 * delete runs against the ids it found.
 */
const harness = () => {
  const memory = createMemoryDb([
    [
      core_audit_logs,
      [entry(1, 400), entry(2, 366), entry(3, 364), entry(4, 1)],
    ],
  ]);
  const db = {
    delete: (table: typeof core_audit_logs) => ({
      where: (condition: SQL) => ({
        returning: async (fields: Record<string, unknown>) => {
          // Drizzle wraps a select it does not know as a bound parameter.
          const subquery = condition.queryChunks
            .map(chunk => (is(chunk, Param) ? chunk.value : chunk))
            .find(
              (chunk): chunk is PromiseLike<{ id: number }[]> =>
                typeof chunk === "object" && chunk !== null && "then" in chunk,
            );
          const ids = subquery ? (await subquery).map(row => row.id) : [];

          return await memory.db
            .delete(table)
            .where(inArray(core_audit_logs.id, ids.length > 0 ? ids : [-1]))
            .returning(fields);
        },
      }),
    }),
    select: memory.db.select,
  } as unknown as AuditDatabase;

  return {
    db,
    remaining: () => memory.rows(core_audit_logs).map(row => row.id),
  };
};

describe("pruneAuditLogs", () => {
  it("deletes only entries older than the retention period and counts them", async () => {
    const h = harness();

    await expect(
      pruneAuditLogs(h.db, { now: NOW, retentionDays: 365 }),
    ).resolves.toBe(2);
    expect(h.remaining()).toEqual([3, 4]);
  });

  it("deletes nothing when retention keeps everything", async () => {
    const h = harness();

    await expect(
      pruneAuditLogs(h.db, { now: NOW, retentionDays: 0 }),
    ).resolves.toBe(0);
    expect(h.remaining()).toEqual([1, 2, 3, 4]);
  });
});
