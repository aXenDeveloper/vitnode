import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";
import type { ModerationCaptureResult } from "@/api/moderation";

import { defineModerationScope, defineReportTarget } from "@/api/moderation";
import { core_files } from "@/database/files";
import {
  core_moderation_report_events,
  core_moderation_report_reasons,
  core_moderation_reports,
} from "@/database/moderation";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import { MODERATION_LIMITS } from "@/lib/moderation/const";
import { resolvePersonalInformationFields } from "@/lib/user-personal-information";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";
import {
  grantStaffPermissions,
  ROOT_STAFF_PERMISSIONS,
} from "@/tests/staff-permissions";

import { moderationModule } from "./moderation.module";

const FORUM = "@vitnode/forum";
const FAMILY = "forum.section";
const TYPE = "forum.topic";
const SECTION_A = "10";
const SECTION_B = "20";
const DRAFT_TOPIC = "99";

const MEMBER_ROLE = 3;
const REPORTER = 100;
const SECOND_REPORTER = 101;
const MOD_A = 200;
const SECOND_MOD_A = 201;
const MOD_B = 202;
const ROOT_MOD = 300;

const topics = (permission: string, section: string): PermissionsStaffArgs => ({
  module: "topics",
  permission,
  plugin: FORUM,
  scope: { family: FAMILY, ids: [section], mode: "selected" },
});

const moderatorOf = (section: string) => [
  topics("can_view_reports", section),
  topics("can_manage_reports", section),
  topics("can_view_hidden", section),
  topics("can_hide", section),
];

const harness = async () => {
  const sections = new Map([
    ["1", SECTION_A],
    ["2", SECTION_A],
    ["3", SECTION_B],
  ]);
  const deleted = new Set<string>();
  const hidden = new Set<string>();
  const fixture = {
    body: "Original body",
    failHide: false,
    onCapture: undefined as (() => Promise<void>) | undefined,
    servedLocale: "en",
  };
  const effects = vi.fn(async () => Promise.resolve());

  const target = defineReportTarget({
    actions: {
      hide: {
        available: state => !state.hidden,
        permission: "can_hide",
        run: async (_c, { targetId }) => {
          if (fixture.failHide) throw new Error("hide failed");
          hidden.add(targetId);

          return Promise.resolve({ changed: true, effects });
        },
      },
    },
    capture: async (
      _c,
      { targetId },
    ): Promise<ModerationCaptureResult | null> => {
      await fixture.onCapture?.();
      if (targetId === DRAFT_TOPIC || deleted.has(targetId)) return null;

      return {
        authors: [{ id: 1, name: "Author" }],
        fields: [
          { kind: "text", label: null, name: "body", value: fixture.body },
        ],
        locale: {
          fallback: false,
          requested: null,
          served: fixture.servedLocale,
        },
        scope: null,
        source: { publishedAt: null, updatedAt: null, version: null },
        title: `Topic ${targetId}`,
        url: `/topics/${targetId}`,
      };
    },
    current: async (_c, { targetId }) =>
      Promise.resolve(
        deleted.has(targetId)
          ? null
          : { hidden: hidden.has(targetId), url: `/topics/${targetId}` },
      ),
    label: "Topic",
    parseId: value => (/^\d+$/.test(value) ? value : null),
    permissionModule: "topics",
    resolveScope: async (_c, targetId) =>
      Promise.resolve(
        deleted.has(targetId) ? undefined : sections.get(targetId),
      ),
    scope: FAMILY,
    type: TYPE,
  });
  const scope = defineModerationScope({
    find: async () => Promise.resolve([]),
    id: FAMILY,
    label: "Section",
    list: async () => Promise.resolve({ items: [], nextCursor: null }),
  });

  const cache = createTestCache();
  for (const [userId, permissions] of [
    [MOD_A, moderatorOf(SECTION_A)],
    [SECOND_MOD_A, moderatorOf(SECTION_A)],
    [MOD_B, moderatorOf(SECTION_B)],
    [ROOT_MOD, ROOT_STAFF_PERMISSIONS],
  ] as const) {
    await grantStaffPermissions(cache, {
      permissions,
      type: "moderator",
      userId,
    });
  }

  const users = [
    REPORTER,
    SECOND_REPORTER,
    MOD_A,
    SECOND_MOD_A,
    MOD_B,
    ROOT_MOD,
  ];
  const memory = createMemoryDb([
    [
      core_users,
      users.map(id => ({
        email: `${id}@example.com`,
        id,
        name: `User ${id}`,
        nameCode: `user-${id}`,
        roleId: MEMBER_ROLE,
      })),
    ],
    [core_roles, [{ color: null, id: MEMBER_ROLE, prefix: null }]],
    [core_files, []],
    [core_moderation_reports, []],
    [core_moderation_report_events, []],
    [
      core_moderation_report_reasons,
      [
        { code: "spam", id: 1, position: 0, requiresDetails: false },
        { code: "other", id: 2, position: 1, requiresDetails: true },
      ],
    ],
  ]);
  const emit = vi.fn(async () => Promise.resolve());

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    const userId = Number(c.req.header("x-user"));
    c.set(
      "user",
      (users.includes(userId)
        ? { id: userId, roleId: MEMBER_ROLE }
        : null) as unknown as Context["var"]["user"],
    );
    c.set("cache", cache);
    c.set("db", memory.db as unknown as Context["var"]["db"]);
    c.set("events", { emit } as unknown as Context["var"]["events"]);
    c.set("core", {
      moderation: {
        scopes: [{ definition: scope, pluginId: FORUM }],
        targets: [{ definition: target, pluginId: FORUM }],
      },
      permissionStaff: [],
      personalInformationFields: resolvePersonalInformationFields(),
    } as unknown as Context["var"]["core"]);
    await next();
  });
  app.route("/", moderationModule.hono);

  const call = async (
    userId: number,
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
  ) =>
    await app.request(path, {
      method,
      headers: {
        "content-type": "application/json",
        "x-user": String(userId),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  const report = async (
    userId: number,
    targetId: string,
    extra: Record<string, unknown> = {},
  ) =>
    await call(userId, "POST", "/reports", {
      pluginId: FORUM,
      reason: "spam",
      targetId,
      targetType: TYPE,
      ...extra,
    });

  const reportId = async (userId: number, targetId: string) => {
    const res = await report(userId, targetId);
    expect(res.status).toBe(201);

    return ((await res.json()) as { id: number }).id;
  };

  const row = (id: number) =>
    memory.rows(core_moderation_reports).find(entry => entry.id === id);
  const eventsOf = (id: number) =>
    memory
      .rows(core_moderation_report_events)
      .filter(entry => entry.reportId === id)
      .map(entry => ({ data: entry.data, type: entry.type }));

  const seed = async (targetId: string, scopeId: string, createdAt: Date) => {
    await memory.db.insert(core_moderation_reports).values({
      createdAt,
      openKey: null,
      pluginId: FORUM,
      reason: "spam",
      reporterId: null,
      scopeFamily: FAMILY,
      scopeId,
      snapshot: {},
      targetId,
      targetType: TYPE,
    });
  };

  return {
    call,
    deleted,
    effects,
    emit,
    eventsOf,
    fixture,
    memory,
    report,
    reportId,
    row,
    sections,
    seed,
  };
};

interface Detail {
  current: { exists: boolean; hidden: boolean };
  related: { id: number }[];
  report: { scope: null | { id: string }; status: string; version: number };
  snapshot: {
    fields: { value: unknown }[];
    locale: {
      fallback: boolean;
      requested: null | string;
      served: null | string;
    };
    title: string;
  };
}

const detail = async (
  h: Awaited<ReturnType<typeof harness>>,
  userId: number,
  id: number,
) => {
  const res = await h.call(userId, "GET", `/reports/${id}`);

  return {
    body: res.status === 200 ? ((await res.json()) as Detail) : null,
    status: res.status,
  };
};

const queue = async (
  h: Awaited<ReturnType<typeof harness>>,
  userId: number,
) => {
  const res = await h.call(userId, "GET", "/reports?status=all");
  expect(res.status).toBe(200);

  return (await res.json()) as {
    items: { id: number; relatedCount: number }[];
    total: number;
  };
};

describe("filing a report", () => {
  it("refuses a second open report from the same reporter, not from another", async () => {
    const h = await harness();
    const first = await h.reportId(REPORTER, "1");

    const again = await h.report(REPORTER, "1");
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: "duplicate" });

    const other = await h.reportId(SECOND_REPORTER, "1");
    expect(other).not.toBe(first);
  });

  it("turns a duplicate that raced past the check into a 409", async () => {
    const h = await harness();
    h.fixture.onCapture = async () => {
      h.fixture.onCapture = undefined;
      await h.seed("1", SECTION_A, new Date());
      await h.memory.db
        .update(core_moderation_reports)
        .set({ openKey: `${REPORTER}:${FORUM}:${TYPE}:1` });
    };

    const res = await h.report(REPORTER, "1");

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "duplicate" });
    expect(h.memory.rows(core_moderation_reports)).toHaveLength(1);
    expect(h.memory.rows(core_moderation_report_events)).toEqual([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks a guest to sign in", async () => {
    const h = await harness();

    const res = await h.report(0, "1");

    expect(res.status).toBe(401);
    expect(h.memory.rows(core_moderation_reports)).toEqual([]);
  });

  it.each([
    [MODERATION_LIMITS.requiredDescriptionMinLength - 1, 400],
    [MODERATION_LIMITS.requiredDescriptionMinLength, 201],
  ])(
    "needs a description for a reason that requires details (%i characters: %i)",
    async (length, status) => {
      const h = await harness();

      const res = await h.report(REPORTER, "1", {
        description: "x".repeat(length),
        reason: "other",
      });

      expect(res.status).toBe(status);
    },
  );

  it("limits reports per hour and lets the reporter go on once it passes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-18T12:00:00.000Z"));
    const h = await harness();
    await h.memory.db.insert(core_moderation_reports).values(
      Array.from({ length: MODERATION_LIMITS.reportsPerUserPerHour }, () => ({
        openKey: null,
        pluginId: FORUM,
        reason: "spam" as const,
        reporterId: REPORTER,
        snapshot: {},
        targetId: "2",
        targetType: TYPE,
      })),
    );

    const limited = await h.report(REPORTER, "1");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("3600");
    expect(await limited.json()).toEqual({ error: "rate_limited" });
    expect((await h.report(SECOND_REPORTER, "1")).status).toBe(201);

    vi.setSystemTime(new Date("2026-10-18T13:00:01.000Z"));
    expect((await h.report(REPORTER, "1")).status).toBe(201);
  });

  it("answers 404 when the reporter cannot read the target", async () => {
    const h = await harness();

    const res = await h.report(REPORTER, DRAFT_TOPIC);

    expect(res.status).toBe(404);
    expect(h.memory.rows(core_moderation_reports)).toEqual([]);
  });

  it("records that the snapshot was served in a fallback language", async () => {
    const h = await harness();
    const plain = await h.reportId(REPORTER, "1");
    const localized = await h.report(SECOND_REPORTER, "1", {
      locale: "pl",
      requestedLocale: "pl",
    });
    expect(localized.status).toBe(201);
    const { id } = (await localized.json()) as { id: number };

    expect((await detail(h, ROOT_MOD, id)).body?.snapshot.locale).toEqual({
      fallback: true,
      requested: "pl",
      served: "en",
    });
    expect(
      (await detail(h, ROOT_MOD, plain)).body?.snapshot.locale.fallback,
    ).toBe(false);
  });
});

describe("the report queue", () => {
  it("filters by the moderator's sections before counting and paginating", async () => {
    const h = await harness();
    const day = (n: number) => new Date(Date.UTC(2026, 0, n));
    await h.seed("1", SECTION_A, day(1));
    await h.seed("2", SECTION_A, day(2));
    for (let n = 0; n < 30; n++) await h.seed("3", SECTION_B, day(3 + n));

    const scoped = await queue(h, MOD_A);
    expect(scoped.total).toBe(2);
    expect(scoped.items).toHaveLength(2);

    const other = await queue(h, MOD_B);
    expect(other.total).toBe(30);
    expect(other.items).toHaveLength(25);

    expect((await queue(h, ROOT_MOD)).total).toBe(32);
  });

  it("counts related reports only among those the moderator may view", async () => {
    const h = await harness();
    await h.reportId(REPORTER, "1");
    await h.reportId(SECOND_REPORTER, "1");

    const { items } = await queue(h, MOD_A);

    expect(items.map(item => item.relatedCount)).toEqual([1, 1]);
    expect((await queue(h, MOD_B)).items).toEqual([]);
  });
});

describe("a report's detail", () => {
  it("is a 404 outside the moderator's sections, and lists related reports inside", async () => {
    const h = await harness();
    const first = await h.reportId(REPORTER, "1");
    const second = await h.reportId(SECOND_REPORTER, "1");
    await h.reportId(REPORTER, "2");

    expect((await detail(h, MOD_B, first)).status).toBe(404);

    const { body } = await detail(h, MOD_A, first);
    expect(body?.related.map(entry => entry.id)).toEqual([second]);
  });

  it("keeps the stored snapshot after the target is edited and deleted", async () => {
    const h = await harness();
    const id = await h.reportId(REPORTER, "1");
    const before = (await detail(h, MOD_A, id)).body?.snapshot;
    expect(before?.fields).toEqual([
      expect.objectContaining({ value: "Original body" }),
    ]);

    h.fixture.body = "Edited body";
    expect((await detail(h, MOD_A, id)).body?.snapshot).toEqual(before);

    h.deleted.add("1");
    const gone = await detail(h, MOD_A, id);
    expect(gone.body?.snapshot).toEqual(before);
    expect(gone.body?.current.exists).toBe(false);
    expect(gone.body?.report.scope).toEqual({ family: FAMILY, id: SECTION_A });
  });

  it("follows a topic moved to another section, unassigning who lost access", async () => {
    const h = await harness();
    const id = await h.reportId(REPORTER, "2");
    const claim = await h.call(MOD_A, "POST", `/reports/${id}/claim`, {
      expectedVersion: 1,
    });
    expect(claim.status).toBe(200);

    h.sections.set("2", SECTION_B);

    expect((await detail(h, MOD_A, id)).status).toBe(404);
    expect(h.row(id)).toEqual(
      expect.objectContaining({
        assigneeId: null,
        scopeId: SECTION_B,
        status: "new",
      }),
    );
    expect(h.eventsOf(id)).toContainEqual({
      data: { previousAssigneeId: MOD_A, reason: "lost_access" },
      type: "unassigned",
    });
    expect((await detail(h, MOD_B, id)).status).toBe(200);
  });
});

describe("working a report", () => {
  it("lets one claim win and tells the other why it lost", async () => {
    const h = await harness();
    const id = await h.reportId(REPORTER, "1");

    const first = await h.call(MOD_A, "POST", `/reports/${id}/claim`, {
      expectedVersion: 1,
    });
    expect(await first.json()).toEqual({
      assigneeId: MOD_A,
      status: "in_progress",
      version: 2,
    });

    const stale = await h.call(SECOND_MOD_A, "POST", `/reports/${id}/claim`, {
      expectedVersion: 1,
    });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({
      current: { assigneeId: MOD_A, status: "in_progress", version: 2 },
      error: "conflict",
    });

    const taken = await h.call(SECOND_MOD_A, "POST", `/reports/${id}/claim`, {
      expectedVersion: 2,
    });
    expect(taken.status).toBe(409);
    expect(await taken.json()).toEqual(
      expect.objectContaining({ error: "already_claimed" }),
    );
  });

  it("resolves with an outcome and reopens with the history kept", async () => {
    const h = await harness();
    const id = await h.reportId(REPORTER, "1");
    const resolve = async (body: Record<string, unknown>) =>
      await h.call(MOD_A, "POST", `/reports/${id}/resolve`, {
        expectedVersion: 1,
        resolution: "no_violation",
        ...body,
      });

    expect((await resolve({ resolution: "unknown" })).status).toBe(400);

    const resolved = await resolve({ explanation: "Not spam." });
    expect(await resolved.json()).toEqual({
      assigneeId: null,
      status: "done",
      version: 2,
    });
    expect(h.row(id)).toEqual(
      expect.objectContaining({ openKey: null, resolution: "no_violation" }),
    );

    const reopened = await h.call(MOD_A, "POST", `/reports/${id}/reopen`, {
      expectedVersion: 2,
      reason: "Missed context.",
    });
    expect(await reopened.json()).toEqual({
      assigneeId: null,
      status: "new",
      version: 3,
    });
    expect(h.row(id)).toEqual(
      expect.objectContaining({
        openKey: `${REPORTER}:${FORUM}:${TYPE}:1`,
        resolution: null,
      }),
    );
    expect(h.eventsOf(id).map(event => event.type)).toEqual([
      "created",
      "resolved",
      "reopened",
    ]);
    expect(h.eventsOf(id)[2]?.data).toEqual({
      previousResolution: "no_violation",
      reason: "Missed context.",
    });
  });

  it("records a successful action and runs its effects after the commit", async () => {
    const h = await harness();
    const id = await h.reportId(REPORTER, "1");
    const order: string[] = [];
    const transaction = h.memory.db.transaction.bind(h.memory.db);
    vi.spyOn(h.memory.db, "transaction").mockImplementation(async run => {
      const result = await transaction(run);
      order.push("committed");

      return result;
    });
    h.effects.mockImplementation(async () => {
      order.push("effects");

      return Promise.resolve();
    });

    const res = await h.call(MOD_A, "POST", `/reports/${id}/actions/hide`, {
      expectedVersion: 1,
    });

    expect(await res.json()).toEqual({
      assigneeId: null,
      changed: true,
      status: "new",
      version: 2,
    });
    expect(order).toEqual(["committed", "effects"]);
    expect(h.eventsOf(id)).toContainEqual({
      data: { action: "hide" },
      type: "action",
    });
    expect((await detail(h, MOD_A, id)).body?.current.hidden).toBe(true);
  });

  it("leaves no trace of an action that fails", async () => {
    const h = await harness();
    const id = await h.reportId(REPORTER, "1");
    h.fixture.failHide = true;

    const res = await h.call(MOD_A, "POST", `/reports/${id}/actions/hide`, {
      expectedVersion: 1,
    });

    expect(res.status).toBe(500);
    expect(h.eventsOf(id).map(event => event.type)).toEqual(["created"]);
    expect(h.row(id)?.version).toBe(1);
    expect(h.effects).not.toHaveBeenCalled();
  });
});
