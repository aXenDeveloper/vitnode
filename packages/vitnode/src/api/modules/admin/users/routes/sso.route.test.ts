// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";
import type { EnvVariablesVitNode } from "@/api/middlewares/global.middleware";
import type { SSOApiPlugin } from "@/api/models/sso";

import { SsoConnectionModel } from "@/api/models/sso-connection";
import { core_admin_permissions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";
import { core_roles } from "@/database/roles";
import { core_users, core_users_secondary_roles } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";
import {
  createMemorySsoConnectionStore,
  type MemorySsoAccount,
} from "@/tests/sso-connection-store";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { disconnectUserSsoAdminRoute } from "./sso-disconnect.route";
import { updateUserSsoPreferencesAdminRoute } from "./sso-preferences.route";
import { listUserSsoAdminRoute } from "./sso.route";

const STAFF_ROLE = 2;
const MEMBER_ROLE = 3;
const EDITOR = { email: "editor@example.com", id: 1, roleId: STAFF_ROLE };
const TARGET_ID = 7;

const permission = (name: string): PermissionsStaffArgs => ({
  module: "users",
  permission: name,
  plugin: "@vitnode/core",
});

const CAN_VIEW = permission("can_view");
const CAN_EDIT = permission("can_edit");
const CAN_EDIT_ADMIN = permission("can_edit_admin");

const account = (
  id: number,
  overrides: Partial<MemorySsoAccount> = {},
): MemorySsoAccount => ({
  avatarId: null,
  email: `user${id}@vitnode.test`,
  firstName: null,
  hasPassword: true,
  id,
  lastName: null,
  name: `User${id}`,
  passkeys: 0,
  roleId: MEMBER_ROLE,
  showRealName: false,
  ...overrides,
});

const adapter = (
  id: string,
  profileFields: SSOApiPlugin["profileFields"],
): SSOApiPlugin => ({
  fetchToken: async () =>
    await Promise.resolve({ access_token: "token", token_type: "Bearer" }),
  fetchUser: async () =>
    await Promise.resolve({ email: "x@example.com", id: "x", username: "x" }),
  getUrl: () => `https://${id}.example/oauth`,
  id,
  name: id,
  profileFields,
});

const json = (body: unknown, method: string): RequestInit => ({
  body: JSON.stringify(body),
  headers: { "content-type": "application/json" },
  method,
});

afterEach(() => {
  vi.restoreAllMocks();
});

const harness = async ({
  editor = [CAN_VIEW, CAN_EDIT],
  target = account(TARGET_ID),
  targetIsStaff = false,
}: {
  editor?: PermissionsStaffArgs[];
  target?: MemorySsoAccount;
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
          email: target.email,
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
  ]);

  const sso = createMemorySsoConnectionStore([account(EDITOR.id), target]);
  vi.spyOn(SsoConnectionModel.prototype, "store", "get").mockReturnValue(
    sso.store,
  );
  const emit = vi.fn(async () => Promise.resolve(undefined));

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("admin", { user: EDITOR } as unknown as Context["var"]["admin"]);
    c.set("cache", cache);
    c.set("core", {
      authorization: {
        passkeys: { enabled: false, problems: [] },
        password: { enabled: true },
        ssoAdapters: [
          adapter("google", ["avatar", "firstName", "lastName"]),
          adapter("discord", ["avatar"]),
        ],
      },
    } as unknown as EnvVariablesVitNode["core"]);
    c.set("db", memory.db as unknown as Context["var"]["db"]);
    c.set("events", { emit } as unknown as Context["var"]["events"]);
    await next();
  });
  for (const { handler, route } of [
    listUserSsoAdminRoute,
    disconnectUserSsoAdminRoute,
    updateUserSsoPreferencesAdminRoute,
  ]) {
    app.openapi(route, handler);
  }

  return { emit, request: app.request.bind(app), sso };
};

describe("GET /admin/users/{id}/sso", () => {
  it("returns the target user's connections, sign-in methods and sources", async () => {
    const h = await harness();
    h.sso.connect(TARGET_ID, "google", "g-7", {
      providerEmail: "target@gmail.com",
    });
    h.sso.connect(EDITOR.id, "discord", "d-1");
    h.sso.sources.push({
      field: "firstName",
      providerId: "google",
      userId: TARGET_ID,
    });

    const response = await h.request(`/${TARGET_ID}/sso`);

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      providers: { connection: null | { email: null | string }; id: string }[];
      signIn: { hasPassword: boolean };
      sources: Record<string, null | string>;
    };
    expect(
      body.providers.map(one => [one.id, one.connection?.email ?? null]),
    ).toEqual([
      ["google", "target@gmail.com"],
      ["discord", null],
    ]);
    expect(body.providers[1]?.connection).toBeNull();
    expect(body.signIn.hasPassword).toBe(true);
    expect(body.sources).toEqual({
      avatar: null,
      firstName: "google",
      lastName: null,
    });
  });

  it("answers 404 for an unknown or malformed user id", async () => {
    const h = await harness();

    for (const id of ["999", "abc", "1.5"]) {
      const response = await h.request(`/${id}/sso`);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "User not found" });
    }
  });

  it("refuses staff without users:can_view", async () => {
    const h = await harness({ editor: [] });

    expect((await h.request(`/${TARGET_ID}/sso`)).status).toBe(403);
  });
});

describe("DELETE /admin/users/{id}/sso/{providerId}", () => {
  it("removes the target user's connection and announces it", async () => {
    const h = await harness();
    h.sso.connect(TARGET_ID, "google", "g-7");

    const response = await h.request(`/${TARGET_ID}/sso/google`, {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(h.sso.connections).toEqual([]);
    expect(h.emit).toHaveBeenCalledWith("user.sso.unlinked", {
      providerId: "google",
      userId: TARGET_ID,
    });
  });

  it("refuses removing the account's last way to sign in", async () => {
    const h = await harness({
      target: account(TARGET_ID, { hasPassword: false }),
    });
    h.sso.connect(TARGET_ID, "google", "g-7");

    const response = await h.request(`/${TARGET_ID}/sso/google`, {
      method: "DELETE",
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "last_sign_in_method" });
    expect(h.sso.connections).toHaveLength(1);
  });

  it("answers 404 when the user is not connected to the provider", async () => {
    const h = await harness();

    const response = await h.request(`/${TARGET_ID}/sso/google`, {
      method: "DELETE",
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_connected" });
  });

  it("refuses staff without users:can_edit", async () => {
    const h = await harness({ editor: [CAN_VIEW] });
    h.sso.connect(TARGET_ID, "google", "g-7");

    const response = await h.request(`/${TARGET_ID}/sso/google`, {
      method: "DELETE",
    });

    expect(response.status).toBe(403);
    expect(h.sso.connections).toHaveLength(1);
  });

  it("refuses a staff target without users:can_edit_admin", async () => {
    const h = await harness({ targetIsStaff: true });
    h.sso.connect(TARGET_ID, "google", "g-7");

    const response = await h.request(`/${TARGET_ID}/sso/google`, {
      method: "DELETE",
    });

    expect(response.status).toBe(403);
    expect(h.sso.connections).toHaveLength(1);
  });

  it("lets users:can_edit_admin disconnect a staff target", async () => {
    const h = await harness({
      editor: [CAN_EDIT, CAN_EDIT_ADMIN],
      targetIsStaff: true,
    });
    h.sso.connect(TARGET_ID, "google", "g-7");

    const response = await h.request(`/${TARGET_ID}/sso/google`, {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
  });
});

describe("PUT /admin/users/{id}/sso/preferences", () => {
  it("saves the target user's sources and sync settings", async () => {
    const h = await harness();
    h.sso.connect(TARGET_ID, "google", "g-7");

    const response = await h.request(
      `/${TARGET_ID}/sso/preferences`,
      json({ sources: { firstName: "google" }, sync: { google: true } }, "PUT"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(h.sso.sources).toEqual([
      { field: "firstName", providerId: "google", userId: TARGET_ID },
    ]);
    expect(h.sso.connections[0]?.syncOnSignIn).toBe(true);
    expect(h.emit).toHaveBeenCalledWith("user.sso.preferences_updated", {
      sources: { firstName: "google" },
      sync: { google: true },
      userId: TARGET_ID,
    });
  });

  it("rejects a provider the target user is not connected to", async () => {
    const h = await harness();
    h.sso.connect(EDITOR.id, "google", "g-1");

    const response = await h.request(
      `/${TARGET_ID}/sso/preferences`,
      json({ sources: { firstName: "google" }, sync: {} }, "PUT"),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_source" });
    expect(h.emit).not.toHaveBeenCalled();
  });

  it("rejects a field the provider does not supply", async () => {
    const h = await harness();
    h.sso.connect(TARGET_ID, "discord", "d-7");

    const response = await h.request(
      `/${TARGET_ID}/sso/preferences`,
      json({ sources: { lastName: "discord" }, sync: {} }, "PUT"),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_source" });
  });

  it("refuses a staff target without users:can_edit_admin", async () => {
    const h = await harness({ targetIsStaff: true });
    h.sso.connect(TARGET_ID, "google", "g-7");

    const response = await h.request(
      `/${TARGET_ID}/sso/preferences`,
      json({ sources: {}, sync: { google: true } }, "PUT"),
    );

    expect(response.status).toBe(403);
    expect(h.sso.connections[0]?.syncOnSignIn).toBe(false);
  });
});
