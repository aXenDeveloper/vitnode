import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  PermissionsStaffArgs,
  StaffPermissionSet,
} from "@/api/lib/permission-staff";

import { findActiveSuspension } from "@/api/lib/moderation/warnings/suspension";
import {
  accountSuspendedNotification,
  warningIssuedNotification,
} from "@/api/lib/notifications/core-types";
import { defineModerationScope, defineReportTarget } from "@/api/moderation";
import { core_languages_words } from "@/database/languages";
import {
  core_moderation_report_events,
  core_moderation_report_reasons,
  core_moderation_reports,
} from "@/database/moderation";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import {
  core_moderation_audit,
  core_moderation_sanctions,
  core_moderation_warning_reasons,
  core_moderation_warning_thresholds,
  core_moderation_warnings,
} from "@/database/warnings";
import {
  WARNING_PERMISSION_MODULE,
  WARNING_PERMISSIONS,
} from "@/lib/moderation/warnings";
import { resolvePersonalInformationFields } from "@/lib/user-personal-information";
import { manifest } from "@/manifest";
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

const MEMBER_ROLE = 3;
const ROOT_ROLE = 4;

const MEMBER = 100;
const OTHER_MEMBER = 101;
const ROOT_ROLE_MEMBER = 102;
const SENIOR = 200;
const BASIC = 201;
const VIEWER = 202;
const SCOPED = 203;
const ROOT_MOD = 300;

const REASON_TWO = 1;
const REASON_FIVE = 2;
const REASON_ZERO = 3;
const REASON_OFF = 4;
const TITLE_OF_TWO = "Off-topic posting";

const THRESHOLD_EIGHT = 1;
const THRESHOLD_TEN = 2;

const HOUR = 60 * 60 * 1000;

const STAFF_NOTE = "staff-only-note";
const OVERRIDE_NOTE = "override-explanation";

const warnings = (...permissions: string[]): PermissionsStaffArgs[] =>
  permissions.map(permission => ({
    module: WARNING_PERMISSION_MODULE,
    permission,
    plugin: manifest.id,
  }));

const sectionA = (permission: string): PermissionsStaffArgs => ({
  module: "topics",
  permission,
  plugin: FORUM,
  scope: { family: FAMILY, ids: [SECTION_A], mode: "selected" },
});

let keys = 0;
const nextKey = () => `warn-key-${++keys}`;

const harness = async () => {
  const sections = new Map([
    ["1", SECTION_A],
    ["3", SECTION_B],
  ]);
  const authorOf = (targetId: string) => (targetId === "4" ? null : MEMBER);

  const target = defineReportTarget({
    capture: async (_c, { targetId }) =>
      Promise.resolve({
        authors: [{ id: MEMBER, name: "Member" }],
        fields: [{ kind: "text", label: null, name: "body", value: "Body" }],
        locale: { fallback: false, requested: null, served: "en" },
        scope: null,
        source: { publishedAt: null, updatedAt: null, version: null },
        title: `Topic ${targetId}`,
        url: `/topics/${targetId}`,
      }),
    current: async (_c, { targetId }) =>
      Promise.resolve({ hidden: false, url: `/topics/${targetId}` }),
    label: "Topic",
    parseId: value => (/^\d+$/.test(value) ? value : null),
    permissionModule: "topics",
    resolveAuthors: async (_c, { targetId }) => {
      const author = authorOf(targetId);

      return Promise.resolve(
        author === null
          ? null
          : { authorIds: [author], title: `Topic ${targetId}` },
      );
    },
    resolveScope: async (_c, targetId) =>
      Promise.resolve(sections.get(targetId)),
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
  const grants: [number, PermissionsStaffArgs[] | StaffPermissionSet][] = [
    [SENIOR, warnings(...Object.values(WARNING_PERMISSIONS))],
    [BASIC, warnings(WARNING_PERMISSIONS.warn)],
    [VIEWER, warnings(WARNING_PERMISSIONS.view)],
    [
      SCOPED,
      [
        sectionA("can_warn"),
        sectionA("can_view_reports"),
        sectionA("can_manage_reports"),
      ],
    ],
    [ROOT_MOD, ROOT_STAFF_PERMISSIONS],
  ];
  for (const [userId, permissions] of grants) {
    await grantStaffPermissions(cache, {
      permissions,
      type: "moderator",
      userId,
    });
  }

  const users = [
    MEMBER,
    OTHER_MEMBER,
    ROOT_ROLE_MEMBER,
    SENIOR,
    BASIC,
    VIEWER,
    SCOPED,
    ROOT_MOD,
  ];
  const reasons = [
    { enabled: true, expiresAfterHours: 720, id: REASON_TWO, points: 2 },
    { enabled: true, expiresAfterHours: null, id: REASON_FIVE, points: 5 },
    { enabled: true, expiresAfterHours: null, id: REASON_ZERO, points: 0 },
    { enabled: false, expiresAfterHours: null, id: REASON_OFF, points: 3 },
  ];
  const memory = createMemoryDb([
    [
      core_users,
      users.map(id => ({
        email: `${id}@example.com`,
        id,
        name: `User ${id}`,
        nameCode: `user-${id}`,
        roleId: id === ROOT_ROLE_MEMBER ? ROOT_ROLE : MEMBER_ROLE,
      })),
    ],
    [
      core_roles,
      [
        { color: null, id: MEMBER_ROLE, prefix: null, root: false },
        { color: null, id: ROOT_ROLE, prefix: null, root: true },
      ],
    ],
    [
      core_moderation_report_reasons,
      [{ code: "spam", id: 1, position: 0, requiresDetails: false }],
    ],
    [
      core_moderation_warning_reasons,
      reasons.map(reason => ({ ...reason, position: reason.id })),
    ],
    [
      core_languages_words,
      reasons.map(reason => ({
        id: reason.id,
        itemId: reason.id,
        languageCode: "en",
        pluginCode: "core",
        tableName: "core_moderation_warning_reasons",
        value: reason.id === REASON_TWO ? TITLE_OF_TWO : `Reason ${reason.id}`,
        variable: "title",
      })),
    ],
    [
      core_moderation_warning_thresholds,
      [
        {
          action: "suspend_temporary",
          durationHours: 24,
          enabled: true,
          id: THRESHOLD_EIGHT,
          points: 8,
        },
        {
          action: "suspend_indefinite",
          durationHours: null,
          enabled: true,
          id: THRESHOLD_TEN,
          points: 10,
        },
      ],
    ],
  ]);
  const emit = vi.fn(async (_name: string, _payload: unknown) =>
    Promise.resolve(),
  );
  const publish = vi.fn(async (_args: Record<string, unknown>) =>
    Promise.resolve(),
  );
  const closeUserConnections = vi.fn((_userId: number) => undefined);

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    const userId = Number(c.req.header("x-user"));
    const suspendedId = Number(c.req.header("x-suspended"));
    c.set(
      "user",
      (users.includes(userId)
        ? { id: userId, roleId: MEMBER_ROLE }
        : null) as unknown as Context["var"]["user"],
    );
    c.set(
      "suspension",
      suspendedId ? { endsAt: null, userId: suspendedId } : null,
    );
    c.set("cache", cache);
    c.set("db", memory.db as unknown as Context["var"]["db"]);
    c.set("events", { emit } as unknown as Context["var"]["events"]);
    c.set("notifications", {
      publish,
    } as unknown as Context["var"]["notifications"]);
    c.set("realtime", {
      closeUserConnections,
    } as unknown as Context["var"]["realtime"]);
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
    headers: Record<string, string> = {},
  ) =>
    await app.request(path, {
      method,
      headers: {
        "content-type": "application/json",
        "x-user": String(userId),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  const issue = async (userId: number, body: Record<string, unknown> = {}) =>
    await call(userId, "POST", "/warnings", {
      idempotencyKey: nextKey(),
      message: "Please keep to the topic.",
      reasonId: REASON_TWO,
      userId: MEMBER,
      ...body,
    });

  const issued = async (userId: number, body: Record<string, unknown> = {}) => {
    const res = await issue(userId, body);
    expect(res.status).toBe(200);

    return (await res.json()) as Issued;
  };

  const revoke = async (
    userId: number,
    kind: "sanctions" | "warnings",
    id: number,
  ) =>
    await call(userId, "POST", `/${kind}/${id}/revoke`, {
      reason: "Issued by mistake",
    });

  /** Active points the member already holds, as one warning outside the API. */
  const seedPoints = async (userId: number, points: number) => {
    await memory.db.insert(core_moderation_warnings).values({
      issuedById: SENIOR,
      message: "Earlier warning",
      points,
      userId,
    });
  };

  const standing = async (moderatorId: number, userId = MEMBER) => {
    const res = await call(moderatorId, "GET", `/members/${userId}`);
    expect(res.status).toBe(200);

    return (await res.json()) as Standing;
  };

  const suspensionOf = async (userId: number) =>
    await findActiveSuspension(
      {
        get: (key: string) =>
          key === "cache" ? cache : key === "db" ? memory.db : undefined,
      } as unknown as Context,
      userId,
    );

  const warningRows = () => memory.rows(core_moderation_warnings);
  const sanctionRows = () => memory.rows(core_moderation_sanctions);
  const reportEvents = (id: number) =>
    memory
      .rows(core_moderation_report_events)
      .filter(entry => entry.reportId === id)
      .map(entry => entry.type);

  const fileReport = async (targetId: string) => {
    const res = await call(OTHER_MEMBER, "POST", "/reports", {
      pluginId: FORUM,
      reason: "spam",
      targetId,
      targetType: TYPE,
    });
    expect(res.status).toBe(201);

    return ((await res.json()) as { id: number }).id;
  };
  const reportRow = (id: number) =>
    memory.rows(core_moderation_reports).find(entry => entry.id === id);

  return {
    call,
    closeUserConnections,
    emit,
    fileReport,
    issue,
    issued,
    memory,
    publish,
    reportEvents,
    reportRow,
    revoke,
    sanctionRows,
    seedPoints,
    standing,
    suspensionOf,
    warningRows,
  };
};

interface Issued {
  duplicate: boolean;
  points: { after: number; before: number };
  reportResolved: boolean;
  sanction: null | { endsAt: null | string; id: number; thresholdId: number };
  warningId: number;
}

interface StaffWarning {
  id: number;
  overrideNote: null | string;
  reason: null | { languageCode: string; value: string }[];
  revokeReason: null | string;
  staffNote: null | string;
  status: string;
}

interface Standing {
  activePoints: number;
  hiddenWarnings: number;
  warnings: StaffWarning[];
}

interface AccountStatus {
  activePoints: number;
  sanctions: { active: boolean; id: number }[];
  suspension: null | { endsAt: null | string };
  warnings: Record<string, unknown>[];
}

const accountStatus = async (
  h: Awaited<ReturnType<typeof harness>>,
  userId = MEMBER,
) => {
  const res = await h.call(userId, "GET", "/account-status");
  expect(res.status).toBe(200);

  return (await res.json()) as AccountStatus;
};

const inHours = (hours: number) =>
  new Date(Date.now() + hours * HOUR).toISOString();

afterEach(() => {
  vi.useRealTimers();
});

describe("issuing a warning", () => {
  it("takes points and expiry from the reason and keeps its title after the reason changes", async () => {
    const h = await harness();

    const { points, warningId } = await h.issued(SENIOR);

    expect(points).toEqual({ after: 2, before: 0 });
    const [row] = h.warningRows();
    expect(row).toMatchObject({
      defaultPoints: 2,
      id: warningId,
      overrideNote: null,
      points: 2,
    });
    expect(
      (row.expiresAt as Date).getTime() - (row.issuedAt as Date).getTime(),
    ).toBe(720 * HOUR);

    await h.memory.db
      .update(core_languages_words)
      .set({ value: "Renamed" })
      .where(eq(core_languages_words.itemId, REASON_TWO));
    await h.memory.db
      .update(core_moderation_warning_reasons)
      .set({ enabled: false })
      .where(eq(core_moderation_warning_reasons.id, REASON_TWO));

    const original = [{ languageCode: "en", value: TITLE_OF_TWO }];
    expect((await h.standing(SENIOR)).warnings[0]?.reason).toEqual(original);
    expect((await accountStatus(h)).warnings[0]?.reason).toEqual(original);
  });

  it("issues a zero-point warning that notifies the member without moving their points", async () => {
    const h = await harness();
    await h.seedPoints(MEMBER, 7);

    const result = await h.issued(SENIOR, { reasonId: REASON_ZERO });

    expect(result.points).toEqual({ after: 7, before: 7 });
    expect(result.sanction).toBeNull();
    expect(h.publish).toHaveBeenCalledTimes(1);
    expect(h.publish.mock.calls[0]?.[0]).toMatchObject({
      recipients: [MEMBER],
      type: warningIssuedNotification,
    });
  });

  it("accepts a points and expiration override with its explanation", async () => {
    const h = await harness();

    await h.issued(SENIOR, {
      expiration: { hours: 48, mode: "hours" },
      overrideNote: OVERRIDE_NOTE,
      points: 4,
    });

    const [row] = h.warningRows();
    expect(row).toMatchObject({
      defaultPoints: 2,
      overrideNote: OVERRIDE_NOTE,
      points: 4,
    });
    expect(
      (row.expiresAt as Date).getTime() - (row.issuedAt as Date).getTime(),
    ).toBe(48 * HOUR);
    expect(h.memory.rows(core_moderation_audit).map(e => e.type)).toContain(
      "warning_overridden",
    );
  });

  it("lets a root moderator warn other staff", async () => {
    const h = await harness();

    expect((await h.issue(ROOT_MOD, { userId: SCOPED })).status).toBe(200);
  });

  it.each([
    [
      "a points override without permission",
      BASIC,
      { overrideNote: OVERRIDE_NOTE, points: 4 },
      403,
      "points_override_forbidden",
    ],
    [
      "a points override without explanation",
      SENIOR,
      { points: 4 },
      400,
      "override_note_required",
    ],
    [
      "an expiration override without permission",
      BASIC,
      { expiration: { mode: "never" }, overrideNote: OVERRIDE_NOTE },
      403,
      "expiration_override_forbidden",
    ],
    [
      "an expiration in the past",
      SENIOR,
      { expiration: { at: inHours(-1), mode: "at" }, overrideNote: "Past" },
      400,
      "invalid_expiration",
    ],
    [
      "an expiration beyond the longest allowed",
      SENIOR,
      {
        expiration: { at: inHours(24 * 365 * 6), mode: "at" },
        overrideNote: "Far",
      },
      400,
      "invalid_expiration",
    ],
    [
      "a disabled reason",
      SENIOR,
      { reasonId: REASON_OFF },
      409,
      "reason_disabled",
    ],
    ["a moderator's own account", SENIOR, { userId: SENIOR }, 403, "self"],
    ["another staff member", BASIC, { userId: SCOPED }, 403, "protected"],
    [
      "a root-role member, even by a root moderator",
      ROOT_MOD,
      { userId: ROOT_ROLE_MEMBER },
      403,
      "protected",
    ],
    ["a direct warning without core can_warn", SCOPED, {}, 403, "forbidden"],
    [
      "content outside the moderator's scope",
      SCOPED,
      { content: { pluginId: FORUM, targetId: "3", targetType: TYPE } },
      403,
      "forbidden",
    ],
    [
      "a member who did not write the content",
      SCOPED,
      {
        content: { pluginId: FORUM, targetId: "1", targetType: TYPE },
        userId: OTHER_MEMBER,
      },
      400,
      "author_mismatch",
    ],
  ])("refuses %s", async (_name, actor, body, status, error) => {
    const h = await harness();

    const res = await h.issue(actor, body);

    expect(res.status).toBe(status);
    expect(await res.json()).toMatchObject({ error });
    expect(h.warningRows()).toEqual([]);
    expect(h.publish).not.toHaveBeenCalled();
  });

  it("lets a scoped moderator warn an author, with the scope resolved on the server", async () => {
    const h = await harness();

    await h.issued(SCOPED, {
      content: {
        pluginId: FORUM,
        scopeId: SECTION_B,
        targetId: "1",
        targetType: TYPE,
      },
      reasonId: REASON_ZERO,
    });

    expect(h.warningRows()[0]).toMatchObject({
      contentSnapshot: { title: "Topic 1", url: "/topics/1" },
      scopeFamily: FAMILY,
      scopeId: SECTION_A,
      targetId: "1",
    });
  });
});

describe("thresholds", () => {
  it.each([
    [REASON_TWO, 8, THRESHOLD_EIGHT, 24],
    [REASON_FIVE, 11, THRESHOLD_TEN, null],
  ])(
    "reason %i takes 6 points to %i and applies only threshold %i",
    async (reasonId, after, thresholdId, hours) => {
      const h = await harness();
      await h.seedPoints(MEMBER, 6);
      expect((await accountStatus(h)).suspension).toBeNull();

      const result = await h.issued(SENIOR, { reasonId });

      expect(result.points).toEqual({ after, before: 6 });
      expect(result.sanction?.thresholdId).toBe(thresholdId);
      const sanctions = h.sanctionRows();
      expect(sanctions).toHaveLength(1);
      const [sanction] = sanctions;
      expect(sanction).toMatchObject({
        source: "threshold",
        thresholdId,
        userId: MEMBER,
        warningId: result.warningId,
      });
      expect(
        hours === null
          ? sanction.endsAt
          : (sanction.endsAt as Date).getTime() -
              (sanction.startsAt as Date).getTime(),
      ).toBe(hours === null ? null : hours * HOUR);

      const status = await accountStatus(h);
      expect(status.suspension).toEqual({
        endsAt: (sanction.endsAt as Date | null)?.toISOString() ?? null,
      });
      expect(h.closeUserConnections).toHaveBeenCalledWith(MEMBER);
      expect(h.publish.mock.calls.map(([args]) => args.type)).toEqual([
        warningIssuedNotification,
        accountSuspendedNotification,
      ]);
    },
  );

  it("answers a retry with the first result and writes nothing again", async () => {
    const h = await harness();
    await h.seedPoints(MEMBER, 6);
    const idempotencyKey = nextKey();

    const first = await h.issued(SENIOR, { idempotencyKey });
    const writes = {
      emits: h.emit.mock.calls.length,
      publishes: h.publish.mock.calls.length,
    };
    const retry = await h.issued(SENIOR, { idempotencyKey });

    expect(retry).toEqual({
      ...first,
      duplicate: true,
      sanction: { ...first.sanction },
    });
    expect(h.warningRows()).toHaveLength(2);
    expect(h.sanctionRows()).toHaveLength(1);
    expect(h.emit).toHaveBeenCalledTimes(writes.emits);
    expect(h.publish).toHaveBeenCalledTimes(writes.publishes);

    const other = await h.issue(SENIOR, {
      idempotencyKey,
      userId: OTHER_MEMBER,
    });
    expect(other.status).toBe(409);
    expect(await other.json()).toEqual({ error: "idempotency_conflict" });
  });

  it("serializes concurrent warnings for one member", async () => {
    const h = await harness();
    const repeated = nextKey();

    const results = await Promise.all(
      [repeated, nextKey(), nextKey(), nextKey(), nextKey(), repeated].map(
        async idempotencyKey => await h.issued(SENIOR, { idempotencyKey }),
      ),
    );

    expect(results.filter(result => result.duplicate)).toHaveLength(1);
    expect(
      h
        .warningRows()
        .map(row => [row.pointsBefore, row.pointsAfter])
        .sort(([a], [b]) => Number(a) - Number(b)),
    ).toEqual([
      [0, 2],
      [2, 4],
      [4, 6],
      [6, 8],
      [8, 10],
    ]);
    expect(
      h
        .sanctionRows()
        .map(row => row.thresholdId)
        .sort((a, b) => Number(a) - Number(b)),
    ).toEqual([THRESHOLD_EIGHT, THRESHOLD_TEN]);
  });

  it("does not suspend a member already above a threshold that is lowered", async () => {
    const h = await harness();
    await h.seedPoints(MEMBER, 9);
    await h.memory.db
      .update(core_moderation_warning_thresholds)
      .set({ points: 9 })
      .where(eq(core_moderation_warning_thresholds.id, THRESHOLD_TEN));

    await h.issued(SENIOR, { reasonId: REASON_ZERO });
    await h.issued(SENIOR);

    expect(h.sanctionRows()).toEqual([]);
  });

  it("applies a threshold again once a revoked warning takes the member back under it", async () => {
    const h = await harness();
    await h.seedPoints(MEMBER, 6);

    const first = await h.issued(SENIOR);
    expect((await h.revoke(SENIOR, "warnings", first.warningId)).status).toBe(
      200,
    );
    const second = await h.issued(SENIOR);

    expect(second.points).toEqual({ after: 8, before: 6 });
    expect(h.sanctionRows().map(row => row.thresholdId)).toEqual([
      THRESHOLD_EIGHT,
      THRESHOLD_EIGHT,
    ]);
  });

  it("stops a temporary suspension once it ends, with no job involved", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-28T12:00:00.000Z"));
    const h = await harness();
    await h.seedPoints(MEMBER, 6);
    await h.issued(SENIOR);
    expect((await accountStatus(h)).suspension).toEqual({
      endsAt: "2026-10-29T12:00:00.000Z",
    });

    vi.setSystemTime(new Date("2026-10-29T12:00:00.001Z"));

    const status = await accountStatus(h);
    expect(status.suspension).toBeNull();
    expect(status.sanctions.map(sanction => sanction.active)).toEqual([false]);
  });
});

describe("revoking", () => {
  it("removes a warning's points but keeps its record and the suspension it caused", async () => {
    const h = await harness();
    await h.seedPoints(MEMBER, 6);
    const { warningId } = await h.issued(BASIC);

    expect((await h.revoke(BASIC, "warnings", warningId)).status).toBe(403);
    expect((await h.revoke(SENIOR, "warnings", warningId)).status).toBe(200);
    const again = await h.revoke(SENIOR, "warnings", warningId);
    expect(again.status).toBe(409);

    const { activePoints, warnings: list } = await h.standing(SENIOR);
    expect(activePoints).toBe(6);
    expect(list.find(warning => warning.id === warningId)).toMatchObject({
      revokeReason: "Issued by mistake",
      status: "revoked",
    });
    expect(await h.suspensionOf(MEMBER)).not.toBeNull();
  });

  it("lifts one suspension and leaves the others in force", async () => {
    const h = await harness();
    await h.seedPoints(MEMBER, 6);
    const temporary = await h.issued(SENIOR);
    const indefinite = await h.issued(SENIOR);
    expect((await h.suspensionOf(MEMBER))?.endsAt).toBeNull();
    const indefiniteId = indefinite.sanction?.id ?? 0;

    expect((await h.revoke(BASIC, "sanctions", indefiniteId)).status).toBe(403);
    expect((await h.revoke(SENIOR, "sanctions", indefiniteId)).status).toBe(
      200,
    );

    expect(await h.suspensionOf(MEMBER)).toEqual({
      endsAt: new Date(temporary.sanction?.endsAt ?? 0),
      sanctionIds: [temporary.sanction?.id],
    });
  });
});

describe("reports", () => {
  it("links a warning to a report and resolves it only when asked", async () => {
    const h = await harness();
    const reportId = await h.fileReport("1");

    const wrongUser = await h.issue(SCOPED, { reportId, userId: OTHER_MEMBER });
    expect(wrongUser.status).toBe(400);
    expect(await wrongUser.json()).toEqual({ error: "author_mismatch" });

    const linked = await h.issued(SCOPED, {
      reasonId: REASON_ZERO,
      reportId,
    });
    expect(linked.reportResolved).toBe(false);
    expect(h.reportRow(reportId)?.status).not.toBe("done");
    expect(h.reportEvents(reportId)).toEqual(["created", "warning"]);

    const resolving = await h.issued(SCOPED, {
      reasonId: REASON_ZERO,
      reportId,
      resolveReport: true,
    });
    expect(resolving.reportResolved).toBe(true);
    expect(h.reportRow(reportId)).toMatchObject({
      resolution: "action_taken",
      status: "done",
    });
    expect(h.reportEvents(reportId)).toEqual([
      "created",
      "warning",
      "warning",
      "resolved",
    ]);
    expect(h.warningRows().map(row => row.reportId)).toEqual([
      reportId,
      reportId,
    ]);
  });

  it("refuses to resolve a closed report and writes nothing", async () => {
    const h = await harness();
    const reportId = await h.fileReport("1");
    const closed = await h.call(
      SCOPED,
      "POST",
      `/reports/${reportId}/resolve`,
      {
        expectedVersion: h.reportRow(reportId)?.version,
        resolution: "no_violation",
      },
    );
    expect(closed.status).toBe(200);
    const events = h.reportEvents(reportId);

    const res = await h.issue(SCOPED, {
      reasonId: REASON_ZERO,
      reportId,
      resolveReport: true,
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "report_closed" });
    expect(h.warningRows()).toEqual([]);
    expect(h.reportEvents(reportId)).toEqual(events);
    expect(h.publish).not.toHaveBeenCalled();
  });
});

describe("staff notes", () => {
  it("shows them only with can_view_notes or to the moderator who wrote them", async () => {
    const h = await harness();
    await h.issued(SENIOR, {
      overrideNote: OVERRIDE_NOTE,
      points: 1,
      staffNote: STAFF_NOTE,
    });
    await h.issued(BASIC, { staffNote: "basic-note" });

    const notesOf = (list: StaffWarning[]) =>
      list.map(warning => [warning.staffNote, warning.overrideNote]);

    expect(notesOf((await h.standing(SENIOR)).warnings)).toEqual([
      ["basic-note", null],
      [STAFF_NOTE, OVERRIDE_NOTE],
    ]);
    expect(notesOf((await h.standing(VIEWER)).warnings)).toEqual([
      [null, null],
      [null, null],
    ]);
    const listed = await h.call(VIEWER, "GET", `/warnings?userId=${MEMBER}`);
    expect(
      notesOf(((await listed.json()) as { items: StaffWarning[] }).items),
    ).toEqual([
      [null, null],
      [null, null],
    ]);
    const basic = await h.standing(BASIC);
    expect(notesOf(basic.warnings)).toEqual([["basic-note", null]]);
    expect(basic.hiddenWarnings).toBe(1);
  });

  it("never reach the member's own status, notifications, events or audit trail", async () => {
    const h = await harness();
    await h.seedPoints(MEMBER, 6);
    const { sanction, warningId } = await h.issued(SENIOR, {
      overrideNote: OVERRIDE_NOTE,
      points: 3,
      staffNote: STAFF_NOTE,
    });
    await h.revoke(SENIOR, "warnings", warningId);
    await h.revoke(SENIOR, "sanctions", sanction?.id ?? 0);

    const suspended = await h.call(0, "GET", "/account-status", undefined, {
      "x-suspended": String(MEMBER),
    });
    expect(suspended.status).toBe(200);
    const status = await suspended.text();
    expect((await h.call(0, "GET", "/account-status")).status).toBe(401);

    expect(h.emit.mock.calls.map(([name]) => name)).toEqual([
      "moderation.warning.issued",
      "moderation.sanction.applied",
      "moderation.warning.revoked",
      "moderation.sanction.revoked",
    ]);
    const leaked = JSON.stringify([
      status,
      h.emit.mock.calls,
      h.publish.mock.calls.map(([args]) => args.data),
      h.memory.rows(core_moderation_audit),
    ]);
    expect(leaked).not.toContain(STAFF_NOTE);
    expect(leaked).not.toContain(OVERRIDE_NOTE);
  });
});
