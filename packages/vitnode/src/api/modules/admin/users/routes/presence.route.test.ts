import { OpenAPIHono } from "@hono/zod-openapi";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";
import type { EnvVitNode } from "@/api/middlewares/global.middleware";

import { globalAdminMiddleware } from "@/api/middlewares/global.middleware";
import { VIEW_HIDDEN_PRESENCE_PERMISSION } from "@/api/models/user-presence";
import { presenceHeartbeatRoute } from "@/api/modules/users/routes/presence-heartbeat.route";
import {
  createSessionWorld,
  type FakeSession,
  fakeSession,
  sessionCookies,
} from "@/tests/sessions";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { presenceUserAdminRoute } from "./presence.route";

const T0 = new Date("2026-10-17T12:00:00.000Z").getTime();

const LAPTOP = { id: 3, publicId: "laptop" };

const CAN_VIEW: PermissionsStaffArgs = {
  module: "users",
  permission: "can_view",
  plugin: "@vitnode/core",
};

const target = fakeSession(7, LAPTOP);
const viewer = fakeSession(1, LAPTOP);

const setup = async ({
  admin,
  moderator = [],
}: {
  admin: PermissionsStaffArgs[];
  moderator?: PermissionsStaffArgs[];
}) => {
  const world = await createSessionWorld({
    sessions: [target, viewer],
    users: { [target.userId]: { hideOnlineStatus: true } },
  });
  world.app.openapi(
    presenceHeartbeatRoute.route,
    presenceHeartbeatRoute.handler,
  );
  const adminApp = new OpenAPIHono<EnvVitNode>();
  adminApp.use("*", globalAdminMiddleware());
  adminApp.openapi(
    presenceUserAdminRoute.route,
    presenceUserAdminRoute.handler,
  );
  world.app.route("/admin", adminApp);

  await grantStaffPermissions(world.cache, {
    permissions: admin,
    userId: viewer.userId,
  });
  await grantStaffPermissions(world.cache, {
    permissions: moderator,
    type: "moderator",
    userId: viewer.userId,
  });
  await world.app.request("/presence/heartbeat", {
    headers: { cookie: sessionCookies(target, "user") },
    method: "POST",
  });

  const read = async (as: FakeSession, kind: "admin" | "user" = "admin") => {
    const response = await world.app.request(
      `/admin/${target.userId}/presence`,
      { headers: { cookie: sessionCookies(as, kind) } },
    );

    return {
      body: response.ok ? ((await response.json()) as unknown) : null,
      cacheControl: response.headers.get("cache-control"),
      status: response.status,
    };
  };

  return { read };
};

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /admin/users/{id}/presence", () => {
  it.each([
    ["users:can_view alone", [CAN_VIEW], [], { status: "hidden" }],
    [
      "the hidden-presence permission only as a moderator",
      [CAN_VIEW],
      [VIEW_HIDDEN_PRESENCE_PERMISSION],
      { status: "hidden" },
    ],
    [
      "the hidden-presence permission as an admin",
      [CAN_VIEW, VIEW_HIDDEN_PRESENCE_PERMISSION],
      [],
      {
        isHidden: true,
        lastSeenAt: new Date(T0).toISOString(),
        status: "online",
      },
    ],
  ])(
    "shows an anonymous member to an admin with %s",
    async (_, admin, moderator, expected) => {
      const { read } = await setup({ admin, moderator });

      expect(await read(viewer)).toStrictEqual({
        body: expected,
        cacheControl: "private, no-store",
        status: 200,
      });
    },
  );

  it("refuses an admin without users:can_view", async () => {
    const { read } = await setup({ admin: [VIEW_HIDDEN_PRESENCE_PERMISSION] });

    expect((await read(viewer)).status).toBe(403);
  });

  it("refuses a request that carries only the user session", async () => {
    const { read } = await setup({
      admin: [CAN_VIEW, VIEW_HIDDEN_PRESENCE_PERMISSION],
    });

    expect((await read(viewer, "user")).status).toBe(403);
  });
});
