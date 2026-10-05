// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it, vi } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { sessionCacheKey } from "@/api/models/session-cache";
import { core_admin_permissions } from "@/database/admins";
import { core_languages } from "@/database/languages";
import { core_moderators_permissions } from "@/database/moderators";
import { core_roles } from "@/database/roles";
import { core_sessions } from "@/database/sessions";
import {
  core_users,
  core_users_secondary_roles,
  core_users_sso_profile_sources,
} from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";
import {
  grantStaffPermissions,
  ROOT_STAFF_PERMISSIONS,
} from "@/tests/staff-permissions";

import { updateUserAdminRoute } from "./update.route";

const ROOT_ROLE = 1;
const EDITOR_ROLE = 2;
const MEMBER_ROLE = 3;
const PLUGINS_ROLE = 9;

const EDITOR = { email: "editor@example.com", id: 1, roleId: EDITOR_ROLE };
const TARGET_ID = 7;
const TARGET_SESSION = { deviceId: 4, token: "target-session-token" };

const permission = (name: string, module = "users"): PermissionsStaffArgs => ({
  module,
  permission: name,
  plugin: "@vitnode/core",
});

const CAN_EDIT = permission("can_edit");
const CAN_EDIT_ADMIN = permission("can_edit_admin");

type TargetShape = "member" | "moderator" | "root via a secondary role";

const entryRow = (entry: Record<string, unknown>) => ({
  permissions: [],
  roleId: null,
  unrestricted: false,
  userId: null,
  ...entry,
});

const harness = async ({
  editor,
  target = "member",
}: {
  editor: PermissionsStaffArgs[] | typeof ROOT_STAFF_PERMISSIONS;
  target?: TargetShape;
}) => {
  const cache = createTestCache();
  await grantStaffPermissions(cache, {
    permissions: editor,
    userId: EDITOR.id,
  });

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
    [
      core_users_secondary_roles,
      target === "root via a secondary role"
        ? [{ roleId: ROOT_ROLE, userId: TARGET_ID }]
        : [],
    ],
    [
      core_roles,
      [
        { guest: false, id: ROOT_ROLE, root: true },
        { guest: false, id: EDITOR_ROLE, root: false },
        { guest: false, id: MEMBER_ROLE, root: false },
        { guest: false, id: PLUGINS_ROLE, root: false },
      ],
    ],
    [
      core_admin_permissions,
      [
        entryRow({
          permissions: [CAN_EDIT, CAN_EDIT_ADMIN],
          roleId: EDITOR_ROLE,
        }),
        entryRow({
          permissions: [permission("can_manage", "plugins")],
          roleId: PLUGINS_ROLE,
        }),
      ],
    ],
    [
      core_moderators_permissions,
      target === "moderator" ? [entryRow({ userId: TARGET_ID })] : [],
    ],
    [
      core_languages,
      [
        { code: "en", id: 1, name: "English" },
        { code: "pl", id: 2, name: "Polski" },
      ],
    ],
    [
      core_sessions,
      [{ ...TARGET_SESSION, expiresAt: new Date(), id: 1, userId: TARGET_ID }],
    ],
    [
      core_users_sso_profile_sources,
      [
        { field: "firstName", providerId: "github", userId: TARGET_ID },
        { field: "lastName", providerId: "github", userId: TARGET_ID },
      ],
    ],
  ]);
  const emit = vi.fn(async () => Promise.resolve());

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("admin", { user: EDITOR } as unknown as Context["var"]["admin"]);
    c.set("cache", cache);
    c.set("db", memory.db as unknown as Context["var"]["db"]);
    c.set("events", { emit } as unknown as Context["var"]["events"]);
    await next();
  });
  app.openapi(updateUserAdminRoute.route, updateUserAdminRoute.handler);

  const patch = async (userId: number, body: Record<string, unknown>) =>
    await app.request(`/${userId}`, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });

  const userRow = (userId: number) =>
    memory.rows(core_users).find(row => row.id === userId);

  const secondaryRoleIdsOf = (userId: number) =>
    memory
      .rows(core_users_secondary_roles)
      .filter(row => row.userId === userId)
      .map(row => row.roleId);

  const ssoSourcesOf = (userId: number) =>
    memory
      .rows(core_users_sso_profile_sources)
      .filter(row => row.userId === userId)
      .map(row => row.field);

  return { cache, emit, patch, secondaryRoleIdsOf, ssoSourcesOf, userRow };
};

const NEW_EMAIL = { email: "attacker@example.com" };

describe("PATCH /admin/users/{id} - staff targets", () => {
  it.each<TargetShape>(["root via a secondary role", "moderator"])(
    "refuses an email change of a target who is %s without users:can_edit_admin",
    async target => {
      const h = await harness({ editor: [CAN_EDIT], target });

      const response = await h.patch(TARGET_ID, NEW_EMAIL);

      expect(response.status).toBe(403);
      expect(h.userRow(TARGET_ID)?.email).toBe("target@example.com");
    },
  );

  it.each<TargetShape>(["root via a secondary role", "moderator"])(
    "changes the email of a target who is %s with users:can_edit_admin",
    async target => {
      const h = await harness({ editor: [CAN_EDIT, CAN_EDIT_ADMIN], target });

      const response = await h.patch(TARGET_ID, NEW_EMAIL);

      expect(response.status).toBe(200);
      expect(h.userRow(TARGET_ID)?.email).toBe(NEW_EMAIL.email);
    },
  );

  it("lets users:can_edit alone change a member's email", async () => {
    const h = await harness({ editor: [CAN_EDIT] });

    expect((await h.patch(TARGET_ID, NEW_EMAIL)).status).toBe(200);
  });

  it("refuses stripping the secondary roles of a root target without users:can_edit_admin", async () => {
    const h = await harness({
      editor: [CAN_EDIT],
      target: "root via a secondary role",
    });

    const response = await h.patch(TARGET_ID, { secondaryRoleIds: [] });

    expect(response.status).toBe(403);
    expect(h.secondaryRoleIdsOf(TARGET_ID)).toEqual([ROOT_ROLE]);
  });
});

describe("PATCH /admin/users/{id} - privilege ceiling", () => {
  const ELEVATED = [CAN_EDIT, CAN_EDIT_ADMIN];

  it.each([
    ["as the primary role of another user", TARGET_ID, { roleId: ROOT_ROLE }],
    [
      "as a secondary role of another user",
      TARGET_ID,
      { secondaryRoleIds: [ROOT_ROLE] },
    ],
    [
      "as a secondary role of themselves",
      EDITOR.id,
      { secondaryRoleIds: [ROOT_ROLE] },
    ],
    ["as the primary role of themselves", EDITOR.id, { roleId: ROOT_ROLE }],
  ])(
    "refuses a non-root admin assigning the root role %s",
    async (_label, userId, body) => {
      const h = await harness({ editor: ELEVATED });

      const response = await h.patch(userId, body);

      expect(response.status).toBe(403);
      expect(h.userRow(userId)?.roleId).not.toBe(ROOT_ROLE);
      expect(h.secondaryRoleIdsOf(userId)).not.toContain(ROOT_ROLE);
    },
  );

  it("lets a root admin assign the root role", async () => {
    const h = await harness({ editor: ROOT_STAFF_PERMISSIONS });

    const response = await h.patch(TARGET_ID, {
      secondaryRoleIds: [ROOT_ROLE],
    });

    expect(response.status).toBe(200);
    expect(h.secondaryRoleIdsOf(TARGET_ID)).toEqual([ROOT_ROLE]);
  });

  it("refuses a role carrying an admin permission the editor lacks", async () => {
    const h = await harness({ editor: ELEVATED });

    const response = await h.patch(TARGET_ID, { roleId: PLUGINS_ROLE });

    expect(response.status).toBe(403);
    expect(h.userRow(TARGET_ID)?.roleId).toBe(MEMBER_ROLE);
  });

  it("allows a role whose permissions the editor holds", async () => {
    const h = await harness({ editor: ELEVATED });

    const response = await h.patch(TARGET_ID, { roleId: EDITOR_ROLE });

    expect(response.status).toBe(200);
    expect(h.userRow(TARGET_ID)?.roleId).toBe(EDITOR_ROLE);
  });
});

describe("PATCH /admin/users/{id} - personal information and preferences", () => {
  it("saves personal fields trimmed and clears the SSO source of an edited name", async () => {
    const h = await harness({ editor: [CAN_EDIT] });

    const response = await h.patch(TARGET_ID, {
      firstName: "  Ada ",
      headline: "Team Manager",
      phone: "+48 600 700 800",
      showRealName: true,
    });

    expect(response.status).toBe(200);
    expect(h.userRow(TARGET_ID)).toMatchObject({
      firstName: "Ada",
      headline: "Team Manager",
      phone: "+48 600 700 800",
      showRealName: true,
    });
    expect(h.ssoSourcesOf(TARGET_ID)).toEqual(["lastName"]);
    expect(h.emit).toHaveBeenCalledWith(
      "user.updated",
      expect.objectContaining({ userId: TARGET_ID }),
    );
  });

  it("clears personal fields with null or an empty string", async () => {
    const h = await harness({ editor: [CAN_EDIT] });
    await h.patch(TARGET_ID, { headline: "Lead", lastName: "Lovelace" });

    const response = await h.patch(TARGET_ID, { headline: "", lastName: null });

    expect(response.status).toBe(200);
    expect(h.userRow(TARGET_ID)).toMatchObject({
      headline: null,
      lastName: null,
    });
  });

  it("refuses a phone number with letters in it", async () => {
    const h = await harness({ editor: [CAN_EDIT] });

    const response = await h.patch(TARGET_ID, { phone: "call me maybe" });

    expect(response.status).toBe(400);
    expect(h.userRow(TARGET_ID)?.phone).toBeUndefined();
  });

  it("stores a birthday at UTC midnight and clears it with null", async () => {
    const h = await harness({ editor: [CAN_EDIT] });

    expect((await h.patch(TARGET_ID, { birthday: "1990-04-21" })).status).toBe(
      200,
    );
    expect(h.userRow(TARGET_ID)?.birthday).toEqual(
      new Date("1990-04-21T00:00:00.000Z"),
    );

    expect((await h.patch(TARGET_ID, { birthday: null })).status).toBe(200);
    expect(h.userRow(TARGET_ID)?.birthday).toBeNull();
  });

  it("refuses a birthday that is not a real calendar date", async () => {
    const h = await harness({ editor: [CAN_EDIT] });

    const response = await h.patch(TARGET_ID, { birthday: "2023-02-30" });

    expect(response.status).toBe(400);
  });

  it("switches to an installed language", async () => {
    const h = await harness({ editor: [CAN_EDIT] });

    const response = await h.patch(TARGET_ID, { language: "pl" });

    expect(response.status).toBe(200);
    expect(h.userRow(TARGET_ID)?.language).toBe("pl");
  });

  it("refuses a language that is not installed", async () => {
    const h = await harness({ editor: [CAN_EDIT] });

    const response = await h.patch(TARGET_ID, { language: "xx" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid language" });
    expect(h.userRow(TARGET_ID)?.language).toBeUndefined();
  });

  it("saves a time zone and resets it to automatic with null", async () => {
    const h = await harness({ editor: [CAN_EDIT] });

    await h.patch(TARGET_ID, { timeZone: "Europe/Warsaw" });
    expect(h.userRow(TARGET_ID)?.timeZone).toBe("Europe/Warsaw");

    expect((await h.patch(TARGET_ID, { timeZone: null })).status).toBe(200);
    expect(h.userRow(TARGET_ID)?.timeZone).toBeNull();
  });

  it("refuses a time zone that does not exist", async () => {
    const h = await harness({ editor: [CAN_EDIT] });

    const response = await h.patch(TARGET_ID, { timeZone: "Mars/Olympus" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid time zone" });
  });

  it("toggles the newsletter and drops the member's cached session", async () => {
    const h = await harness({ editor: [CAN_EDIT] });
    const key = sessionCacheKey(TARGET_SESSION.token, TARGET_SESSION.deviceId);
    await h.cache.setSystem(key, { id: TARGET_ID });

    const response = await h.patch(TARGET_ID, { newsletter: true });

    expect(response.status).toBe(200);
    expect(h.userRow(TARGET_ID)?.newsletter).toBe(true);
    expect(await h.cache.getSystem(key)).toBeNull();
  });

  it("refuses an editor without users:can_edit", async () => {
    const h = await harness({ editor: [permission("can_view")] });

    const response = await h.patch(TARGET_ID, { headline: "Hacked" });

    expect(response.status).toBe(403);
    expect(h.userRow(TARGET_ID)?.headline).toBeUndefined();
  });

  it("refuses editing a staff target without users:can_edit_admin", async () => {
    const h = await harness({ editor: [CAN_EDIT], target: "moderator" });

    const response = await h.patch(TARGET_ID, { firstName: "Mallory" });

    expect(response.status).toBe(403);
    expect(h.userRow(TARGET_ID)?.firstName).toBeUndefined();
    expect(h.ssoSourcesOf(TARGET_ID)).toEqual(["firstName", "lastName"]);
  });
});
