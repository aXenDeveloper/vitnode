import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MemoryRow } from "@/tests/memory-db";

import { VIEW_HIDDEN_PRESENCE_PERMISSION } from "@/api/models/user-presence";
import { core_users } from "@/database/users";
import {
  createSessionWorld,
  type FakeSession,
  fakeSession,
  sessionCookies,
} from "@/tests/sessions";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { presenceBatchRoute } from "./presence-batch.route";
import { presenceHeartbeatRoute } from "./presence-heartbeat.route";
import { presenceRoute } from "./presence.route";
import { updateMyPrivacyRoute } from "./privacy.route";
import { revokeDeviceRoute } from "./revoke-device.route";
import { signOutRoute } from "./sign-out.route";

const T0 = new Date("2026-10-17T12:00:00.000Z").getTime();
const SECOND = 1000;

const LAPTOP = { id: 3, publicId: "laptop" };
const PHONE = { id: 4, publicId: "phone" };

const targetOnLaptop = fakeSession(7, LAPTOP);
const targetOnPhone = fakeSession(7, PHONE);
const member = fakeSession(8, LAPTOP);
const moderator = fakeSession(9, LAPTOP);
const watcher = fakeSession(10, LAPTOP);
const adminWatcher = fakeSession(11, LAPTOP);

const TARGET_ID = targetOnLaptop.userId;

const setup = async (users: Record<number, MemoryRow> = {}) => {
  const world = await createSessionWorld({
    sessions: [
      targetOnLaptop,
      targetOnPhone,
      member,
      moderator,
      watcher,
      adminWatcher,
    ],
    users,
  });
  for (const route of [
    presenceHeartbeatRoute,
    presenceBatchRoute,
    presenceRoute,
    updateMyPrivacyRoute,
    revokeDeviceRoute,
    signOutRoute,
  ]) {
    world.app.openapi(route.route, route.handler);
  }

  await grantStaffPermissions(world.cache, {
    permissions: [],
    type: "moderator",
    userId: moderator.userId,
  });
  await grantStaffPermissions(world.cache, {
    permissions: [VIEW_HIDDEN_PRESENCE_PERMISSION],
    type: "moderator",
    userId: watcher.userId,
  });
  await grantStaffPermissions(world.cache, {
    permissions: [VIEW_HIDDEN_PRESENCE_PERMISSION],
    type: "admin",
    userId: adminWatcher.userId,
  });

  const headersOf = (as: FakeSession | null): Record<string, string> =>
    as ? { cookie: sessionCookies(as, "user") } : {};

  const heartbeat = async (as: FakeSession | null) =>
    await world.app.request("/presence/heartbeat", {
      headers: headersOf(as),
      method: "POST",
    });

  const readPresence = async (
    userId: number,
    as: FakeSession | null = null,
  ) => {
    const response = await world.app.request(`/${userId}/presence`, {
      headers: headersOf(as),
    });

    return {
      body: (await response.json()) as unknown,
      cacheControl: response.headers.get("cache-control"),
      status: response.status,
    };
  };

  const statusOf = async (userId: number) =>
    ((await readPresence(userId)).body as { status: string }).status;

  return { ...world, headersOf, heartbeat, readPresence, statusOf };
};

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /users/presence/heartbeat", () => {
  it("keeps the signed-in member online", async () => {
    const { heartbeat, statusOf } = await setup();

    const response = await heartbeat(targetOnLaptop);

    expect(response.status).toBe(204);
    expect(await statusOf(TARGET_ID)).toBe("online");
  });

  it.each([
    ["a signed-out visitor", null],
    [
      "an unknown session cookie",
      { ...targetOnLaptop, userToken: "user-7-forged" },
    ],
  ])("refuses %s", async (_, as) => {
    const { heartbeat, statusOf } = await setup();

    expect((await heartbeat(as)).status).toBe(401);
    expect(await statusOf(TARGET_ID)).toBe("offline");
  });
});

describe("ending a session", () => {
  // The phone beats first and the laptop later, so after the phone's lease
  // runs out only a laptop lease left behind could keep the member online.
  const beatOnBothDevices = async (
    world: Awaited<ReturnType<typeof setup>>,
  ) => {
    await world.heartbeat(targetOnPhone);
    vi.advanceTimersByTime(100 * SECOND);
    await world.heartbeat(targetOnLaptop);
    await world.heartbeat(member);
  };

  it("ends only that session's lease on sign-out", async () => {
    const world = await setup();
    await beatOnBothDevices(world);

    const response = await world.app.request("/sign_out", {
      body: JSON.stringify({}),
      headers: {
        ...world.headersOf(targetOnLaptop),
        "content-type": "application/json",
      },
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    expect(await world.statusOf(TARGET_ID)).toBe("online");
    expect((await world.heartbeat(targetOnLaptop)).status).toBe(401);

    vi.advanceTimersByTime(51 * SECOND);
    expect(await world.statusOf(TARGET_ID)).toBe("offline");
    expect(await world.statusOf(member.userId)).toBe("online");
  });

  it("ends only the revoked device's lease", async () => {
    const world = await setup();
    await beatOnBothDevices(world);

    const response = await world.app.request(`/devices/${LAPTOP.publicId}`, {
      headers: world.headersOf(targetOnPhone),
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    expect(await world.statusOf(TARGET_ID)).toBe("online");

    vi.advanceTimersByTime(51 * SECOND);
    expect(await world.statusOf(TARGET_ID)).toBe("offline");
    expect(await world.statusOf(member.userId)).toBe("online");
  });
});

describe("GET /users/{id}/presence", () => {
  const ONLINE_HIDDEN = {
    isHidden: true,
    lastSeenAt: new Date(T0).toISOString(),
    status: "online",
  };

  it.each([
    ["a guest", null, { status: "hidden" }],
    ["a member", member, { status: "hidden" }],
    ["a moderator without the permission", moderator, { status: "hidden" }],
    [
      "an admin holding it only as an AdminCP permission",
      adminWatcher,
      { status: "hidden" },
    ],
    ["a moderator with the permission", watcher, ONLINE_HIDDEN],
    ["the member themselves", targetOnPhone, ONLINE_HIDDEN],
  ])(
    "shows an anonymous member to %s as the privacy rule says",
    async (_, as, expected) => {
      const { heartbeat, readPresence } = await setup({
        [TARGET_ID]: { hideOnlineStatus: true },
      });
      await heartbeat(targetOnLaptop);

      expect(await readPresence(TARGET_ID, as)).toStrictEqual({
        body: expected,
        cacheControl: "private, no-store",
        status: 200,
      });
    },
  );

  it("returns 404 for an unknown member", async () => {
    const { readPresence } = await setup();

    expect(await readPresence(404)).toStrictEqual({
      body: { error: "User not found" },
      cacheControl: "private, no-store",
      status: 404,
    });
  });
});

describe("PUT /users/me/privacy", () => {
  const save = async (
    world: Awaited<ReturnType<typeof setup>>,
    hideOnlineStatus: boolean,
    as: FakeSession | null = targetOnLaptop,
  ) =>
    await world.app.request("/me/privacy", {
      body: JSON.stringify({ hideOnlineStatus }),
      headers: { ...world.headersOf(as), "content-type": "application/json" },
      method: "PUT",
    });

  it("saves the setting and applies it to the very next read", async () => {
    const world = await setup();
    await world.heartbeat(targetOnLaptop);

    const hidden = await save(world, true);

    expect(hidden.status).toBe(200);
    expect(await hidden.json()).toEqual({ hideOnlineStatus: true });
    expect(
      world.rows(core_users).find(row => row.id === TARGET_ID)
        ?.hideOnlineStatus,
    ).toBe(true);
    expect(world.emit).toHaveBeenCalledWith(
      "user.updated",
      expect.objectContaining({ userId: TARGET_ID }),
    );
    expect((await world.readPresence(TARGET_ID, member)).body).toEqual({
      status: "hidden",
    });

    await save(world, false);

    expect((await world.readPresence(TARGET_ID, member)).body).toEqual({
      lastSeenAt: new Date(T0).toISOString(),
      status: "online",
    });
  });

  it("refuses visitors who aren't signed in", async () => {
    const world = await setup();

    expect((await save(world, true, null)).status).toBe(401);
  });
});

describe("POST /users/presence/batch", () => {
  const batch = async (
    world: Awaited<ReturnType<typeof setup>>,
    userIds: number[],
  ) =>
    await world.app.request("/presence/batch", {
      body: JSON.stringify({ userIds }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

  it("answers every known member and leaves unknown IDs out", async () => {
    const world = await setup({ [member.userId]: { hideOnlineStatus: true } });
    await world.heartbeat(targetOnLaptop);

    const response = await batch(world, [TARGET_ID, member.userId, 404]);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      presences: [
        {
          presence: {
            lastSeenAt: new Date(T0).toISOString(),
            status: "online",
          },
          userId: TARGET_ID,
        },
        { presence: { status: "hidden" }, userId: member.userId },
      ],
    });
    expect(
      ((await (await batch(world, [404])).json()) as { presences: unknown[] })
        .presences,
    ).toEqual([]);
  });

  it.each([
    [100, 200],
    [101, 400],
  ])("asked about %i members answers %i", async (count, status) => {
    const world = await setup();
    const userIds = Array.from({ length: count }, (_, index) => index + 1);

    expect((await batch(world, userIds)).status).toBe(status);
  });
});
