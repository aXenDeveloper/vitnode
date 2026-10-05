// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { NotificationTypePolicy } from "@/api/lib/notifications/preferences";
import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";
import type { EnvVariablesVitNode } from "@/api/middlewares/global.middleware";
import type { NotificationTypePreference } from "@/database/notifications";

import {
  buildNotificationType,
  createNotificationRegistry,
} from "@/api/lib/notifications/registry";
import { core_admin_permissions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";
import {
  core_notification_settings,
  core_notification_user_state,
} from "@/database/notifications";
import { core_roles } from "@/database/roles";
import { core_users, core_users_secondary_roles } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { updateUserNotificationPreferencesAdminRoute } from "./notification-preferences-update.route";
import { listUserNotificationPreferencesAdminRoute } from "./notification-preferences.route";

const STAFF_ROLE = 2;
const MEMBER_ROLE = 3;
const EDITOR = {
  email: "editor@example.com",
  id: 1,
  language: "en",
  roleId: STAFF_ROLE,
};
const TARGET_ID = 7;

const permission = (name: string): PermissionsStaffArgs => ({
  module: "users",
  permission: name,
  plugin: "@vitnode/core",
});

const CAN_VIEW = permission("can_view");
const CAN_EDIT = permission("can_edit");

const notificationType = (
  id: string,
  overrides: { email?: boolean; mandatory?: boolean } = {},
) => ({
  ...buildNotificationType({
    category: "social",
    defaults: {
      email: overrides.email === false ? "none" : "daily",
      inApp: true,
    },
    email: overrides.email ?? true,
    id,
    label: id,
    present: () => ({ title: "t" }),
    schema: z.object({}),
    version: 1,
  }),
  mandatory: overrides.mandatory,
});

const COMMENT = "blog.comment";
const LOCKED = "blog.digest";
const SECURITY = "security.alert";
const NO_EMAIL = "blog.like";

const translator = Object.assign((key: string) => key, {
  has: () => false,
});

const harness = async ({
  editor = [CAN_VIEW, CAN_EDIT],
  policies = { [LOCKED]: { memberCanEdit: false } },
  states = [],
  targetIsStaff = false,
}: {
  editor?: PermissionsStaffArgs[];
  policies?: Record<string, NotificationTypePolicy>;
  states?: {
    preferences: Record<string, NotificationTypePreference>;
    userId: number;
  }[];
  targetIsStaff?: boolean;
} = {}) => {
  const cache = createTestCache();
  await grantStaffPermissions(cache, {
    permissions: editor,
    userId: EDITOR.id,
  });
  if (targetIsStaff) {
    await grantStaffPermissions(cache, {
      permissions: [],
      type: "moderator",
      userId: TARGET_ID,
    });
  }

  const memory = createMemoryDb([
    [
      core_users,
      [
        EDITOR,
        {
          email: "target@example.com",
          id: TARGET_ID,
          name: "Target",
          nameCode: "target",
          roleId: MEMBER_ROLE,
        },
      ],
    ],
    [core_users_secondary_roles, []],
    [
      core_roles,
      [
        { guest: false, id: STAFF_ROLE, root: false },
        { guest: false, id: MEMBER_ROLE, root: false },
      ],
    ],
    [core_admin_permissions, []],
    [core_moderators_permissions, []],
    [
      core_notification_settings,
      Object.entries(policies).map(([typeId, value]) => ({
        key: `type:${typeId}`,
        value,
      })),
    ],
    [core_notification_user_state, states],
  ]);

  const registry = createNotificationRegistry(
    [
      notificationType(COMMENT),
      notificationType(LOCKED),
      notificationType(SECURITY, { mandatory: true }),
      notificationType(NO_EMAIL, { email: false }),
    ].map(definition => ({ definition, pluginId: "@acme/blog" })),
  );

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("admin", { user: EDITOR } as unknown as Context["var"]["admin"]);
    c.set("cache", cache);
    c.set("core", {
      email: { adapter: {} },
      notifications: registry,
    } as unknown as EnvVariablesVitNode["core"]);
    c.set("db", memory.db as unknown as Context["var"]["db"]);
    c.set("i18n", {
      getTranslator: async () => await Promise.resolve(translator),
      resolveSupportedLocale: () => "en",
    } as unknown as Context["var"]["i18n"]);
    await next();
  });
  for (const { handler, route } of [
    listUserNotificationPreferencesAdminRoute,
    updateUserNotificationPreferencesAdminRoute,
  ]) {
    app.openapi(route, handler);
  }

  const put = async (types: Record<string, NotificationTypePreference>) =>
    await app.request(`/${TARGET_ID}/notification-preferences`, {
      body: JSON.stringify({ types }),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });

  const preferencesOf = (userId: number) =>
    memory.rows(core_notification_user_state).find(row => row.userId === userId)
      ?.preferences;

  return { preferencesOf, put, request: app.request.bind(app) };
};

interface PreferencesBody {
  types: {
    id: string;
    locked: boolean;
    mandatory: boolean;
    value: { email: string; inApp: boolean; push: boolean };
  }[];
}

const typeOf = (body: PreferencesBody, id: string) =>
  body.types.find(type => type.id === id);

describe("GET /admin/users/{id}/notification-preferences", () => {
  it("returns the target user's choices, not the admin's", async () => {
    const h = await harness({
      states: [
        { preferences: { [COMMENT]: { email: "none" } }, userId: EDITOR.id },
        {
          preferences: { [COMMENT]: { email: "weekly", inApp: false } },
          userId: TARGET_ID,
        },
      ],
    });

    const response = await h.request(`/${TARGET_ID}/notification-preferences`);

    expect(response.status).toBe(200);
    const body = (await response.json()) as PreferencesBody;
    expect(typeOf(body, COMMENT)?.value).toEqual({
      email: "weekly",
      inApp: false,
      push: true,
    });
  });

  it("locks mandatory types and types the installation locks for members", async () => {
    const h = await harness();

    const body = (await (
      await h.request(`/${TARGET_ID}/notification-preferences`)
    ).json()) as PreferencesBody;

    expect(
      body.types.map(({ id, locked, mandatory }) => [id, locked, mandatory]),
    ).toEqual([
      [COMMENT, false, false],
      [LOCKED, true, false],
      [SECURITY, true, true],
      [NO_EMAIL, false, false],
    ]);
  });

  it("answers 404 for an unknown user", async () => {
    const h = await harness();

    const response = await h.request("/999/notification-preferences");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "User not found" });
  });

  it("refuses staff without users:can_view", async () => {
    const h = await harness({ editor: [] });

    const response = await h.request(`/${TARGET_ID}/notification-preferences`);

    expect(response.status).toBe(403);
  });
});

describe("PUT /admin/users/{id}/notification-preferences", () => {
  it("persists to the target user's state and answers with the new preferences", async () => {
    const h = await harness({
      states: [
        { preferences: { [COMMENT]: { email: "none" } }, userId: EDITOR.id },
        { preferences: { [NO_EMAIL]: { inApp: false } }, userId: TARGET_ID },
      ],
    });

    const response = await h.put({ [COMMENT]: { email: "immediate" } });

    expect(response.status).toBe(200);
    const body = (await response.json()) as PreferencesBody;
    expect(typeOf(body, COMMENT)?.value.email).toBe("immediate");
    expect(h.preferencesOf(TARGET_ID)).toEqual({
      [COMMENT]: { email: "immediate" },
      [NO_EMAIL]: { inApp: false },
    });
    expect(h.preferencesOf(EDITOR.id)).toEqual({
      [COMMENT]: { email: "none" },
    });
  });

  it("creates the target user's state when they never saved preferences", async () => {
    const h = await harness();

    const response = await h.put({ [COMMENT]: { push: false } });

    expect(response.status).toBe(200);
    expect(h.preferencesOf(TARGET_ID)).toEqual({ [COMMENT]: { push: false } });
  });

  it("refuses a type the installation locks for members", async () => {
    const h = await harness();

    const response = await h.put({ [LOCKED]: { email: "weekly" } });

    expect(response.status).toBe(400);
    expect(h.preferencesOf(TARGET_ID)).toBeUndefined();
  });

  it.each([
    ["a mandatory type", { [SECURITY]: { email: "none" as const } }],
    ["an unknown type", { "blog.unknown": { inApp: true } }],
    [
      "an email channel the type lacks",
      { [NO_EMAIL]: { email: "daily" as const } },
    ],
  ])("rejects %s", async (_, types) => {
    const h = await harness();

    const response = await h.put(types);

    expect(response.status).toBe(400);
    expect(h.preferencesOf(TARGET_ID)).toBeUndefined();
  });

  it("rejects channels the installation switched off", async () => {
    const h = await harness({
      policies: { [COMMENT]: { allowInApp: false, allowPush: false } },
    });

    expect((await h.put({ [COMMENT]: { inApp: true } })).status).toBe(400);
    expect((await h.put({ [COMMENT]: { push: true } })).status).toBe(400);
  });

  it("refuses staff without users:can_edit", async () => {
    const h = await harness({ editor: [CAN_VIEW] });

    const response = await h.put({ [COMMENT]: { email: "weekly" } });

    expect(response.status).toBe(403);
    expect(h.preferencesOf(TARGET_ID)).toBeUndefined();
  });

  it("refuses a staff target without users:can_edit_admin", async () => {
    const h = await harness({ targetIsStaff: true });

    const response = await h.put({ [COMMENT]: { email: "weekly" } });

    expect(response.status).toBe(403);
    expect(h.preferencesOf(TARGET_ID)).toBeUndefined();
  });
});
