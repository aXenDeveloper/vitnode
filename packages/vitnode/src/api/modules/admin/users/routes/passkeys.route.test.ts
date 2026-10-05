// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";
import type { EnvVariablesVitNode } from "@/api/middlewares/global.middleware";

import { buildModule } from "@/api/lib/module";
import { PasskeyModel } from "@/api/models/passkey";
import { CONFIG_PLUGIN } from "@/config";
import { core_admin_permissions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";
import { core_roles } from "@/database/roles";
import { core_users, core_users_secondary_roles } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";
import {
  createMemoryPasskeyStore,
  type MemoryPasskeyAccount,
} from "@/tests/passkey-store";
import { SESSION_AUTHORIZATION } from "@/tests/sessions";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { deleteUserPasskeyAdminRoute } from "./passkey-delete.route";
import { renameUserPasskeyAdminRoute } from "./passkey-rename.route";
import { listUserPasskeysAdminRoute } from "./passkeys.route";

const MEMBER_ROLE = 3;
const EDITOR = { email: "editor@example.com", id: 1, roleId: MEMBER_ROLE };
const TARGET_ID = 7;
const OTHER_ID = 8;
const MODERATOR_ID = 9;

const permission = (name: string): PermissionsStaffArgs => ({
  module: "users",
  permission: name,
  plugin: "@vitnode/core",
});

const CAN_VIEW = permission("can_view");
const CAN_EDIT = permission("can_edit");
const CAN_EDIT_ADMIN = permission("can_edit_admin");

const userRow = (id: number) => ({
  email: `${id}@example.com`,
  id,
  name: `user-${id}`,
  nameCode: `user-${id}`,
  roleId: MEMBER_ROLE,
});

const newPasskey = (userId: number, name: string) => ({
  aaguid: null,
  backedUp: true,
  counter: 0,
  credentialId: `credential-${userId}-${name}`,
  deviceType: "multiDevice",
  name,
  publicKey: "public-key",
  transports: ["internal"],
  userId,
  webauthnUserId: `webauthn-${userId}`,
});

const harness = async ({
  accounts = {
    [MODERATOR_ID]: { hasPassword: true, ssoProviders: [] },
    [OTHER_ID]: { hasPassword: true, ssoProviders: [] },
    [TARGET_ID]: { hasPassword: true, ssoProviders: [] },
  },
  editor,
}: {
  accounts?: Record<number, MemoryPasskeyAccount>;
  editor: PermissionsStaffArgs[];
}) => {
  const cache = createTestCache();
  await grantStaffPermissions(cache, {
    permissions: editor,
    userId: EDITOR.id,
  });

  const memory = createMemoryPasskeyStore(accounts);
  vi.spyOn(PasskeyModel.prototype, "store", "get").mockReturnValue(
    memory.store,
  );
  const targetKey = await memory.store.createPasskey(
    newPasskey(TARGET_ID, "Laptop"),
  );
  const otherKey = await memory.store.createPasskey(
    newPasskey(OTHER_ID, "Phone"),
  );
  const moderatorKey = await memory.store.createPasskey(
    newPasskey(MODERATOR_ID, "Key"),
  );
  if (!(targetKey && otherKey && moderatorKey)) {
    throw new Error("seed failed");
  }

  const memoryDb = createMemoryDb([
    [
      core_users,
      [EDITOR, userRow(TARGET_ID), userRow(OTHER_ID), userRow(MODERATOR_ID)],
    ],
    [core_users_secondary_roles, []],
    [core_roles, [{ guest: false, id: MEMBER_ROLE, root: false }]],
    [core_admin_permissions, []],
    [
      core_moderators_permissions,
      [
        {
          permissions: [],
          roleId: null,
          unrestricted: false,
          userId: MODERATOR_ID,
        },
      ],
    ],
  ]);
  const emit = vi.fn(async () => Promise.resolve(undefined));

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("core", {
      authorization: {
        ...SESSION_AUTHORIZATION,
        passkeys: {
          enabled: true,
          origins: ["https://example.com"],
          rpId: "example.com",
          rpName: "VitNode",
        },
      },
    } as unknown as EnvVariablesVitNode["core"]);
    c.set("admin", { user: EDITOR } as unknown as Context["var"]["admin"]);
    c.set("cache", cache);
    c.set("db", memoryDb.db as unknown as Context["var"]["db"]);
    c.set("events", { emit } as unknown as Context["var"]["events"]);
    await next();
  });
  app.route(
    "/",
    buildModule({
      name: "users",
      pluginId: CONFIG_PLUGIN.pluginId,
      routes: [
        listUserPasskeysAdminRoute,
        renameUserPasskeyAdminRoute,
        deleteUserPasskeyAdminRoute,
      ],
    }).hono,
  );

  const list = async (userId: number) =>
    await app.request(`/${userId}/passkeys`);

  const rename = async (userId: number, passkeyId: number, name: string) =>
    await app.request(`/${userId}/passkeys/${passkeyId}`, {
      body: JSON.stringify({ name }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });

  const remove = async (userId: number, passkeyId: number) =>
    await app.request(`/${userId}/passkeys/${passkeyId}`, {
      method: "DELETE",
    });

  return {
    emit,
    keys: { moderator: moderatorKey, other: otherKey, target: targetKey },
    list,
    passkeys: memory.passkeys,
    remove,
    rename,
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /admin/users/{id}/passkeys", () => {
  it("lists only that user's passkeys, without secrets", async () => {
    const h = await harness({ editor: [CAN_VIEW] });

    const response = await h.list(TARGET_ID);

    expect(response.status).toBe(200);
    const { items } = (await response.json()) as {
      items: Record<string, unknown>[];
    };
    expect(items).toEqual([
      expect.objectContaining({
        backedUp: true,
        deviceType: "multiDevice",
        id: h.keys.target.id,
        lastUsedAt: null,
        name: "Laptop",
        transports: ["internal"],
      }),
    ]);
    expect(items[0]).not.toHaveProperty("publicKey");
    expect(items[0]).not.toHaveProperty("credentialId");
  });

  it("returns 404 for an unknown user", async () => {
    const h = await harness({ editor: [CAN_VIEW] });

    const response = await h.list(404);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "User not found" });
  });

  it("refuses a caller without users:can_view", async () => {
    const h = await harness({ editor: [CAN_EDIT] });

    expect((await h.list(TARGET_ID)).status).toBe(403);
  });
});

describe("PATCH /admin/users/{id}/passkeys/{passkeyId}", () => {
  it("renames the user's passkey and emits the update", async () => {
    const h = await harness({ editor: [CAN_EDIT] });

    const response = await h.rename(TARGET_ID, h.keys.target.id, "  Desk  ");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: h.keys.target.id,
      name: "Desk",
    });
    expect(h.passkeys.get(h.keys.target.id)?.name).toBe("Desk");
    expect(h.emit).toHaveBeenCalledWith("user.passkey.updated", {
      name: "Desk",
      passkeyId: h.keys.target.id,
      userId: TARGET_ID,
    });
  });

  it("returns not_found for another user's passkey", async () => {
    const h = await harness({ editor: [CAN_EDIT] });

    const response = await h.rename(TARGET_ID, h.keys.other.id, "Stolen");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
    expect(h.passkeys.get(h.keys.other.id)?.name).toBe("Phone");
  });

  it("rejects a blank name", async () => {
    const h = await harness({ editor: [CAN_EDIT] });

    expect((await h.rename(TARGET_ID, h.keys.target.id, "   ")).status).toBe(
      400,
    );
  });

  it("refuses a caller without users:can_edit", async () => {
    const h = await harness({ editor: [CAN_VIEW] });

    expect((await h.rename(TARGET_ID, h.keys.target.id, "Desk")).status).toBe(
      403,
    );
    expect(h.passkeys.get(h.keys.target.id)?.name).toBe("Laptop");
  });

  it("refuses a staff target without users:can_edit_admin", async () => {
    const h = await harness({ editor: [CAN_EDIT] });

    const response = await h.rename(MODERATOR_ID, h.keys.moderator.id, "Desk");

    expect(response.status).toBe(403);
    expect(h.passkeys.get(h.keys.moderator.id)?.name).toBe("Key");
  });

  it("lets users:can_edit_admin rename a staff target's passkey", async () => {
    const h = await harness({ editor: [CAN_EDIT, CAN_EDIT_ADMIN] });

    const response = await h.rename(MODERATOR_ID, h.keys.moderator.id, "Desk");

    expect(response.status).toBe(200);
  });
});

describe("DELETE /admin/users/{id}/passkeys/{passkeyId}", () => {
  it("removes the user's passkey and emits the deletion", async () => {
    const h = await harness({ editor: [CAN_EDIT] });

    const response = await h.remove(TARGET_ID, h.keys.target.id);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(h.passkeys.has(h.keys.target.id)).toBe(false);
    expect(h.emit).toHaveBeenCalledWith("user.passkey.deleted", {
      passkeyId: h.keys.target.id,
      userId: TARGET_ID,
    });
  });

  it("refuses removing the account's last way to sign in", async () => {
    const h = await harness({
      accounts: { [TARGET_ID]: { hasPassword: false, ssoProviders: [] } },
      editor: [CAN_EDIT],
    });

    const response = await h.remove(TARGET_ID, h.keys.target.id);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "last_recovery_method" });
    expect(h.passkeys.has(h.keys.target.id)).toBe(true);
  });

  it("returns not_found for another user's passkey", async () => {
    const h = await harness({ editor: [CAN_EDIT] });

    const response = await h.remove(TARGET_ID, h.keys.other.id);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
    expect(h.passkeys.has(h.keys.other.id)).toBe(true);
  });

  it("returns 404 for an unknown user", async () => {
    const h = await harness({ editor: [CAN_EDIT] });

    const response = await h.remove(404, h.keys.target.id);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "User not found" });
  });

  it("refuses a caller without users:can_edit", async () => {
    const h = await harness({ editor: [CAN_VIEW] });

    expect((await h.remove(TARGET_ID, h.keys.target.id)).status).toBe(403);
    expect(h.passkeys.has(h.keys.target.id)).toBe(true);
  });

  it("refuses a staff target without users:can_edit_admin", async () => {
    const h = await harness({ editor: [CAN_EDIT] });

    expect((await h.remove(MODERATOR_ID, h.keys.moderator.id)).status).toBe(
      403,
    );
    expect(h.passkeys.has(h.keys.moderator.id)).toBe(true);
  });
});
