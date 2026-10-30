import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { core_audit_logs, core_audit_settings } from "@/database/audit";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { testCategoryContentType } from "@/tests/content-fixtures";
import { createMemoryDb } from "@/tests/memory-db";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { activityLogDetailAdminRoute } from "./detail.route";
import { activityLogEntityAdminRoute } from "./entity.route";
import { exportActivityLogsAdminRoute } from "./export.route";
import { listActivityLogsAdminRoute } from "./list.route";
import { updateActivityLogSettingsAdminRoute } from "./settings.route";

const BLOG = "@vitnode/blog";
const MEMBER_ROLE = 3;

const log = (permission: string): PermissionsStaffArgs => ({
  module: "activity_logs",
  permission,
  plugin: "@vitnode/core",
});

const ADMINS = {
  editor: [
    {
      module: testCategoryContentType.permissionModule,
      permission: "can_view",
      plugin: BLOG,
    },
  ],
  exporter: [log("can_export")],
  nobody: [
    { module: "users", permission: "can_view", plugin: "@vitnode/core" },
  ],
  retention: [log("can_manage_retention")],
  sensitive: [log("can_view"), log("can_view_sensitive"), log("can_export")],
  viewer: [log("can_view")],
} satisfies Record<string, PermissionsStaffArgs[]>;

type Admin = keyof typeof ADMINS;

const ADMIN_IDS = Object.fromEntries(
  Object.keys(ADMINS).map((name, index) => [name, index + 1]),
) as Record<Admin, number>;

const ENTRIES = [
  {
    action: "role.updated",
    actorId: 1,
    actorName: "Editor",
    actorType: "staff",
    area: "admin",
    correlationId: "corr-1",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    id: 1,
    ipAddress: "203.0.113.7",
    metadata: {},
    pluginId: "@vitnode/core",
    targetId: "5",
    targetLabel: '=HYPERLINK("http://evil.test","Click")',
    targetType: "role",
  },
  {
    action: "content.updated",
    actorId: 1,
    actorName: "Editor",
    actorType: "staff",
    area: "admin",
    changes: { title: { from: "Old", to: "New" } },
    contentTypeId: testCategoryContentType.id,
    createdAt: new Date("2026-10-02T00:00:00.000Z"),
    id: 2,
    ipAddress: "203.0.113.7",
    metadata: {},
    pluginId: BLOG,
    targetId: "7",
    targetLabel: "News",
    targetType: testCategoryContentType.id,
  },
  {
    action: "user.banned",
    actorId: 1,
    actorName: "Editor",
    actorType: "staff",
    area: "moderator",
    createdAt: new Date("2026-10-03T00:00:00.000Z"),
    id: 3,
    metadata: {},
    pluginId: "@vitnode/core",
    targetId: "9",
    targetLabel: "Spammer",
    targetType: "user",
  },
  {
    action: "audit_logs.pruned",
    actorId: null,
    actorName: null,
    actorType: "system",
    area: "system",
    createdAt: new Date("2026-10-04T00:00:00.000Z"),
    id: 4,
    metadata: {},
    pluginId: "@vitnode/core",
    targetType: "audit_logs",
  },
];

const harness = async () => {
  const cache = createTestCache();
  for (const [name, permissions] of Object.entries(ADMINS)) {
    await grantStaffPermissions(cache, {
      permissions,
      userId: ADMIN_IDS[name as Admin],
    });
  }
  const memory = createMemoryDb([
    [
      core_users,
      Object.entries(ADMIN_IDS).map(([name, id]) => ({
        id,
        name,
        nameCode: name,
        roleId: MEMBER_ROLE,
      })),
    ],
    [core_roles, [{ color: null, id: MEMBER_ROLE, prefix: null }]],
    [core_audit_logs, ENTRIES],
    [core_audit_settings, []],
  ]);

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    const name = c.req.header("x-admin") as Admin;
    c.set("admin", {
      user: { id: ADMIN_IDS[name], name, roleId: MEMBER_ROLE },
    } as unknown as Context["var"]["admin"]);
    c.set("cache", cache);
    c.set("db", memory.db as unknown as Context["var"]["db"]);
    c.set("core", {
      contentModels: [
        { model: { definition: testCategoryContentType }, pluginId: BLOG },
      ],
    } as unknown as Context["var"]["core"]);
    await next();
  });
  for (const built of [
    exportActivityLogsAdminRoute,
    activityLogEntityAdminRoute,
    updateActivityLogSettingsAdminRoute,
    activityLogDetailAdminRoute,
    listActivityLogsAdminRoute,
  ]) {
    app.openapi(built.route, built.handler);
  }

  const request = async (admin: Admin, path: string, init: RequestInit = {}) =>
    await app.request(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-admin": admin,
        ...init.headers,
      },
    });

  const audits = (action: string) =>
    memory.rows(core_audit_logs).filter(row => row.action === action);

  return { audits, memory, request };
};

const ENTITY = `/entity?pluginId=${encodeURIComponent(BLOG)}&targetType=${testCategoryContentType.id}&targetId=7`;

describe("Activity Logs admin routes", () => {
  it.each([
    ["the list", "/", "viewer", 200],
    ["the list", "/", "nobody", 403],
    [
      "an entity history with the content type's can_view only",
      ENTITY,
      "editor",
      200,
    ],
    ["an entity history", ENTITY, "nobody", 403],
    ["the export", "/export", "exporter", 200],
    ["the export", "/export", "viewer", 403],
  ] as const)(
    "answers %s (%s) for %s with %i",
    async (_label, path, admin, status) => {
      const h = await harness();

      expect((await h.request(admin, path)).status).toBe(status);
    },
  );

  it("lists entries newest first", async () => {
    const h = await harness();

    const res = await h.request("viewer", "/");
    const body = (await res.json()) as {
      edges: { id: number }[];
      pageInfo: { hasNextPage: boolean };
    };

    expect(body.edges.map(edge => edge.id)).toEqual([4, 3, 2, 1]);
    expect(body.pageInfo.hasNextPage).toBe(false);
  });

  it.each([
    ["?staff=admin", [4, 2, 1]],
    ["?staff=moderator", [3]],
  ] as const)("filters the list by staff log (%s)", async (query, ids) => {
    const h = await harness();

    const res = await h.request("viewer", `/${query}`);
    const body = (await res.json()) as { edges: { id: number }[] };

    expect(body.edges.map(edge => edge.id)).toEqual(ids);
  });

  it("shows an entity's history with its recorded changes", async () => {
    const h = await harness();

    const res = await h.request("editor", ENTITY);

    expect(await res.json()).toMatchObject({
      edges: [{ changes: { title: { from: "Old", to: "New" } }, id: 2 }],
    });
  });

  it.each([
    ["hides", "viewer", { correlationId: null, ipAddress: null }],
    [
      "shows",
      "sensitive",
      { correlationId: "corr-1", ipAddress: "203.0.113.7" },
    ],
  ] as const)(
    "%s the IP address and correlation id in the detail for %s",
    async (_label, admin, expected) => {
      const h = await harness();

      const res = await h.request(admin, "/1");

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ id: 1, ...expected });
    },
  );

  describe("export", () => {
    it("escapes formulas, omits IP addresses without can_view_sensitive and records itself", async () => {
      const h = await harness();

      const res = await h.request("exporter", "/export");
      const csv = await res.text();
      const [header] = csv.split("\r\n");

      expect(res.headers.get("content-type")).toContain("text/csv");
      expect(header).not.toContain("ipAddress");
      expect(csv).not.toContain("203.0.113.7");
      expect(csv).toContain(`"'=HYPERLINK(""http://evil.test"",""Click"")"`);
      expect(h.audits("audit_logs.exported")).toEqual([
        expect.objectContaining({
          actorId: ADMIN_IDS.exporter,
          metadata: expect.objectContaining({ rows: 4 }),
        }),
      ]);
    });

    it("includes IP addresses with can_view_sensitive", async () => {
      const h = await harness();

      const csv = await (await h.request("sensitive", "/export")).text();

      expect(csv.split("\r\n")[0]).toContain('"ipAddress"');
      expect(csv).toContain("203.0.113.7");
    });
  });

  describe("PUT /settings", () => {
    const put = async (
      h: Awaited<ReturnType<typeof harness>>,
      admin: Admin,
      retentionDays: number,
    ) =>
      await h.request(admin, "/settings", {
        body: JSON.stringify({ retentionDays }),
        method: "PUT",
      });

    it("saves an offered retention period and records the change", async () => {
      const h = await harness();

      const res = await put(h, "retention", 90);

      expect(res.status).toBe(200);
      expect(h.memory.rows(core_audit_settings)).toEqual([
        expect.objectContaining({ id: 1, retentionDays: 90 }),
      ]);
      expect(h.audits("audit_settings.updated")).toEqual([
        expect.objectContaining({
          changes: { retentionDays: { from: 365, to: 90 } },
        }),
      ]);
    });

    it.each([
      ["a period that is not offered", "retention", 45, 400],
      ["an admin without can_manage_retention", "viewer", 90, 403],
    ] as const)("refuses %s", async (_label, admin, days, status) => {
      const h = await harness();

      expect((await put(h, admin, days)).status).toBe(status);
      expect(h.memory.rows(core_audit_settings)).toEqual([]);
      expect(h.audits("audit_settings.updated")).toEqual([]);
    });

    it("records nothing when the period does not change", async () => {
      const h = await harness();

      await put(h, "retention", 365);

      expect(h.audits("audit_settings.updated")).toEqual([]);
    });
  });
});
