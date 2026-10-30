import type { Table } from "drizzle-orm";
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it, vi } from "vitest";

import { core_audit_logs } from "@/database/audit";
import { core_languages_words } from "@/database/languages";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";
import {
  grantStaffPermissions,
  ROOT_STAFF_PERMISSIONS,
} from "@/tests/staff-permissions";

import { createRoleAdminRoute } from "./create.route";

const CALLER = { id: 1, name: "Root", roleId: 3 };

type MemoryDb = ReturnType<typeof createMemoryDb>["db"];

/** The memory db, with every audit insert inside a transaction failing. */
const failingAuditDb = (db: MemoryDb): MemoryDb => ({
  ...db,
  transaction: async run =>
    await db.transaction(async tx => {
      const inner = tx as MemoryDb;

      return await run({
        ...inner,
        insert: (table: Table) => {
          if (table === core_audit_logs) throw new Error("audit write failed");

          return inner.insert(table);
        },
      });
    }),
});

const harness = async ({ failAudit = false } = {}) => {
  const cache = createTestCache();
  await grantStaffPermissions(cache, {
    permissions: ROOT_STAFF_PERMISSIONS,
    userId: CALLER.id,
  });
  const memory = createMemoryDb([
    [core_roles, []],
    [core_users, [CALLER]],
    [core_languages_words, []],
  ]);
  const db = failAudit ? failingAuditDb(memory.db) : memory.db;

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("admin", { user: CALLER } as unknown as Context["var"]["admin"]);
    c.set("cache", cache);
    c.set("db", db as unknown as Context["var"]["db"]);
    c.set("events", {
      emit: vi.fn(async () => Promise.resolve()),
    } as unknown as Context["var"]["events"]);
    await next();
  });
  app.openapi(createRoleAdminRoute.route, createRoleAdminRoute.handler);

  const create = async () =>
    await app.request("/create", {
      body: JSON.stringify({
        color: "#0a0",
        name: [{ languageCode: "en", value: "Editors" }],
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

  return { create, memory };
};

describe("POST /admin/roles/create - audit", () => {
  it("records role.created with the new role's values", async () => {
    const h = await harness();

    const res = await h.create();
    const { id } = (await res.json()) as { id: number };

    expect(res.status).toBe(201);
    expect(h.memory.rows(core_audit_logs)).toEqual([
      expect.objectContaining({
        action: "role.created",
        actorId: CALLER.id,
        actorType: "staff",
        area: "admin",
        changes: expect.objectContaining({
          color: { from: null, to: "#0a0" },
          name: { from: null, to: "Editors" },
        }),
        targetId: String(id),
        targetLabel: "Editors",
        targetType: "role",
      }),
    ]);
  });

  it("creates no role when its audit entry cannot be written", async () => {
    const h = await harness({ failAudit: true });

    const res = await h.create();

    expect(res.status).toBe(500);
    expect(h.memory.rows(core_roles)).toEqual([]);
    expect(h.memory.rows(core_audit_logs)).toEqual([]);
  });
});
