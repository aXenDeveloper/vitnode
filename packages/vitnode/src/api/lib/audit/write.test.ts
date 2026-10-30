import type { Context } from "hono";

import { describe, expect, it, vi } from "vitest";

import { AuditModel } from "@/api/models/audit";
import { core_audit_logs } from "@/database/audit";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import { createMemoryDb } from "@/tests/memory-db";

import type { AuditWriteInput } from "./write";

import { AUDIT_SYSTEM_ACTOR, withAuditContext } from "./context";
import { AuditLogError, writeAuditLog } from "./write";

const ADMIN = { id: 1, name: "Admin" };
const MEMBER = { id: 2, name: "Member" };
const IP = "203.0.113.7";

const ENTRY: AuditWriteInput = {
  action: "category.updated",
  target: { id: 5, label: "News", type: "category" },
};

const harness = (vars: Record<string, unknown> = {}) => {
  const memory = createMemoryDb([
    [core_users, [{ ...ADMIN }, { ...MEMBER }, { id: 3, name: "Booker" }]],
    [core_roles, []],
  ]);
  const values: Record<string, unknown> = {
    db: memory.db,
    ipAddress: IP,
    ...vars,
  };
  const c = { get: (key: string) => values[key] } as unknown as Context;

  return {
    audit: new AuditModel(c),
    c,
    entries: () => memory.rows(core_audit_logs),
    memory,
  };
};

describe("writeAuditLog", () => {
  it.each([
    [
      "an AdminCP admin as staff",
      { admin: { user: ADMIN } },
      undefined,
      {
        actorId: ADMIN.id,
        actorName: "Admin",
        actorType: "staff",
        area: "admin",
        ipAddress: IP,
      },
    ],
    [
      "a signed-in member as api",
      { user: MEMBER },
      undefined,
      { actorId: MEMBER.id, actorType: "api", area: "public", ipAddress: IP },
    ],
    [
      "a member in the moderator area as staff",
      { user: MEMBER },
      "moderator" as const,
      { actorId: MEMBER.id, actorType: "staff", area: "moderator" },
    ],
    [
      "nobody as the system, without an IP address",
      {},
      undefined,
      {
        actorId: null,
        actorName: null,
        actorType: "system",
        area: "system",
        ipAddress: null,
      },
    ],
  ])("attributes %s", async (_label, vars, area, expected) => {
    const h = harness(vars);

    await writeAuditLog(h.c, { ...ENTRY, ...(area ? { area } : {}) });

    expect(h.entries()).toEqual([expect.objectContaining(expected)]);
  });

  it("stores ids as text and sanitizes changes and metadata", async () => {
    const h = harness({ admin: { user: ADMIN } });

    await writeAuditLog(h.c, {
      ...ENTRY,
      changes: { apiKey: { from: "a", to: "b" } },
      metadata: { token: "secret", topicId: 9 },
      scope: { family: "forum", id: 4 },
    });

    expect(h.entries()[0]).toMatchObject({
      changes: { apiKey: { redacted: true } },
      metadata: { token: "[redacted]", topicId: 9 },
      pluginId: "@vitnode/core",
      scopeFamily: "forum",
      scopeId: "4",
      targetId: "5",
    });
  });

  it.each([
    ["an invalid action", { ...ENTRY, action: "Category Updated" }],
    ["an invalid target type", { ...ENTRY, target: { type: "Category!" } }],
  ])(
    "throws AuditLogError for %s and writes nothing",
    async (_label, input) => {
      const h = harness();

      await expect(writeAuditLog(h.c, input)).rejects.toBeInstanceOf(
        AuditLogError,
      );
      expect(h.entries()).toEqual([]);
    },
  );

  it("leaves no entry when the transaction it was written in rolls back", async () => {
    const h = harness({ admin: { user: ADMIN } });

    await expect(
      h.memory.db.transaction(async tx => {
        await writeAuditLog(h.c, ENTRY, tx as Context["var"]["db"]);
        throw new Error("the change failed after the entry was written");
      }),
    ).rejects.toThrow("the change failed");

    expect(h.entries()).toEqual([]);
  });

  it("shares one correlation id across a request's entries", async () => {
    const h = harness({ admin: { user: ADMIN } });

    await writeAuditLog(h.c, ENTRY);
    await writeAuditLog(h.c, { ...ENTRY, action: "category.deleted" });

    const [first, second] = h.entries();
    expect(first.correlationId).toEqual(expect.any(String));
    expect(second.correlationId).toBe(first.correlationId);
  });
});

describe("withAuditContext", () => {
  it("applies a frame's actor, area, scope, correlation id and metadata", async () => {
    const h = harness({ admin: { user: ADMIN } });

    await withAuditContext(
      h.c,
      {
        actor: AUDIT_SYSTEM_ACTOR,
        area: "system",
        correlationId: "schedule:9",
        metadata: { scheduledByUserId: 3, trigger: "frame" },
        scope: { family: "forum", id: "4" },
      },
      async () =>
        await writeAuditLog(h.c, { ...ENTRY, metadata: { trigger: "own" } }),
    );

    expect(h.entries()[0]).toMatchObject({
      actorId: null,
      actorType: "system",
      area: "system",
      correlationId: "schedule:9",
      ipAddress: null,
      metadata: { scheduledByUserId: 3, trigger: "own" },
      scopeFamily: "forum",
      scopeId: "4",
    });
  });

  it("lets an intercept rewrite an entry, or drop it with null", async () => {
    const h = harness({ admin: { user: ADMIN } });

    const results = await withAuditContext(
      h.c,
      {
        intercept: entry =>
          entry.action === "category.deleted"
            ? null
            : { ...entry, action: "category.moved" },
      },
      async () => [
        await writeAuditLog(h.c, ENTRY),
        await writeAuditLog(h.c, { ...ENTRY, action: "category.deleted" }),
      ],
    );

    expect(results[1]).toBeNull();
    expect(h.entries().map(entry => entry.action)).toEqual(["category.moved"]);
  });

  it("applies nested frames innermost first", async () => {
    const h = harness({ user: MEMBER });
    const seen: string[] = [];

    await withAuditContext(
      h.c,
      {
        area: "public",
        intercept: entry => {
          seen.push(`outer:${entry.action}`);

          return entry;
        },
        metadata: { from: "outer", outer: true },
      },
      async () =>
        await withAuditContext(
          h.c,
          {
            area: "moderator",
            intercept: entry => {
              seen.push(`inner:${entry.action}`);

              return { ...entry, action: "report.claimed" };
            },
            metadata: { from: "inner" },
          },
          async () => await writeAuditLog(h.c, ENTRY),
        ),
    );

    expect(seen).toEqual(["inner:category.updated", "outer:report.claimed"]);
    expect(h.entries()[0]).toMatchObject({
      actorType: "staff",
      area: "moderator",
      metadata: { from: "inner", outer: true },
    });
  });

  it("stops applying a frame once its block has finished", async () => {
    const h = harness({ admin: { user: ADMIN } });

    await withAuditContext(h.c, { area: "moderator" }, async () =>
      Promise.resolve(),
    );
    await writeAuditLog(h.c, ENTRY);

    expect(h.entries()[0].area).toBe("admin");
  });
});

describe("AuditModel.record", () => {
  it("swallows a database error with bestEffort and logs only its name", async () => {
    const error = vi.fn(async () => Promise.resolve());
    const h = harness({ log: { error } });
    vi.spyOn(h.memory.db, "insert").mockImplementation(() => {
      throw new Error("connection refused: postgres://user:pw@db");
    });

    await expect(h.audit.record(ENTRY, { bestEffort: true })).resolves.toBe(
      null,
    );
    expect(error).toHaveBeenCalledWith(
      expect.not.stringContaining("postgres://"),
    );
  });

  it("throws a database error without bestEffort", async () => {
    const h = harness();
    vi.spyOn(h.memory.db, "insert").mockImplementation(() => {
      throw new Error("connection refused");
    });

    await expect(h.audit.record(ENTRY)).rejects.toThrow("connection refused");
  });

  it("never swallows an AuditLogError, even with bestEffort", async () => {
    const h = harness();

    await expect(
      h.audit.record({ ...ENTRY, action: "BAD" }, { bestEffort: true }),
    ).rejects.toBeInstanceOf(AuditLogError);
  });
});
