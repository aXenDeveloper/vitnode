import type { Context } from "hono";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type CacheClient, CacheModel } from "@/api/lib/cache";
import { core_roles } from "@/database/roles";
import { core_users, core_users_secondary_roles } from "@/database/users";
import { createTestCache, createTestCacheClient } from "@/tests/cache";
import { createMemoryDb, type MemoryRow } from "@/tests/memory-db";

import {
  presenceSessionId,
  type PresenceViewer,
  UserPresenceModel,
} from "./user-presence";

const T0 = new Date("2026-10-17T12:00:00.000Z").getTime();
const MEMBER_ROLE = 2;
const FORCING_ROLE = 3;
const DISALLOWING_ROLE = 4;
const SECOND = 1000;

const GUEST: PresenceViewer = { type: "moderator", user: null };

const userRow = (id: number, overrides: MemoryRow = {}): MemoryRow => ({
  email: `${id}@test.com`,
  hideOnlineStatus: false,
  id,
  lastSeenAt: null,
  name: `user-${id}`,
  roleId: MEMBER_ROLE,
  ...overrides,
});

const roleRow = (
  id: number,
  allowBrowseAnonymously: boolean,
  forceBrowseAnonymously: boolean,
): MemoryRow => ({ allowBrowseAnonymously, forceBrowseAnonymously, id });

const ROLES = [
  roleRow(MEMBER_ROLE, true, false),
  roleRow(FORCING_ROLE, true, true),
  roleRow(DISALLOWING_ROLE, false, false),
];

const setup = ({
  client = createTestCacheClient(),
  secondaryRoles = [],
  users = [userRow(7)],
}: {
  /** `null` runs without Redis. */
  client?: CacheClient | null;
  secondaryRoles?: { roleId: number; userId: number }[];
  users?: MemoryRow[];
} = {}) => {
  const { db, rows } = createMemoryDb([
    [core_users, users],
    [core_roles, ROLES],
    [core_users_secondary_roles, secondaryRoles],
  ]);
  const cache = client
    ? createTestCache(client)
    : new CacheModel(null, {
        get: () => undefined,
      } as unknown as Context);
  const values: Record<string, unknown> = { cache, db, user: null };
  const presence = new UserPresenceModel({
    get: (key: string) => values[key],
  } as unknown as Context);

  const heartbeat = async (userId: number, tokenHash: string) => {
    await presence.heartbeat({
      sessionId: await presenceSessionId(tokenHash),
      userId,
    });
  };
  const read = async (userId: number, viewer = GUEST) =>
    await presence.get({ userId, viewer });
  const lastSeenAt = (userId: number) =>
    rows(core_users).find(row => row.id === userId)?.lastSeenAt;

  return { cache, db, heartbeat, lastSeenAt, presence, read };
};

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("UserPresenceModel leases", () => {
  it("is online after a heartbeat and offline once the lease runs out", async () => {
    const { heartbeat, read } = setup();
    expect(await read(7)).toEqual({ lastSeenAt: null, status: "offline" });

    await heartbeat(7, "laptop");

    expect(await read(7)).toEqual({
      lastSeenAt: new Date(T0).toISOString(),
      status: "online",
    });

    vi.advanceTimersByTime(150 * SECOND + 1);

    expect(await read(7)).toEqual({
      lastSeenAt: new Date(T0).toISOString(),
      status: "offline",
    });
  });

  it("stays online while another session's lease remains", async () => {
    const { heartbeat, read } = setup();
    await heartbeat(7, "laptop");
    vi.advanceTimersByTime(100 * SECOND);
    await heartbeat(7, "phone");

    vi.advanceTimersByTime(51 * SECOND);
    expect((await read(7))?.status).toBe("online");

    vi.advanceTimersByTime(100 * SECOND);
    expect((await read(7))?.status).toBe("offline");
  });

  it("removes only the given sessions, of only that member", async () => {
    const { heartbeat, presence, read } = setup({
      users: [userRow(7), userRow(8)],
    });
    await heartbeat(7, "laptop");
    await heartbeat(7, "phone");
    await heartbeat(8, "laptop");

    await presence.removeSessions({ tokenHashes: ["laptop"], userId: 7 });
    expect((await read(7))?.status).toBe("online");
    expect((await read(8))?.status).toBe("online");

    await presence.removeSessions({ tokenHashes: ["phone"], userId: 7 });
    expect((await read(7))?.status).toBe("offline");
    expect((await read(8))?.status).toBe("online");
  });

  it("keeps every session and writes lastSeenAt once under concurrent heartbeats", async () => {
    const { db, heartbeat, lastSeenAt, presence, read } = setup();
    const update = vi.spyOn(db, "update");
    const sessions = ["laptop", "phone", "tablet"];

    await Promise.all(
      [...sessions, ...sessions].map(async session => {
        await heartbeat(7, session);
      }),
    );

    expect(await read(7)).toEqual({
      lastSeenAt: new Date(T0).toISOString(),
      status: "online",
    });
    expect(lastSeenAt(7)).toEqual(new Date(T0));
    expect(update).toHaveBeenCalledTimes(1);

    await presence.removeSessions({ tokenHashes: sessions, userId: 7 });
    expect((await read(7))?.status).toBe("offline");
  });
});

describe("UserPresenceModel lastSeenAt", () => {
  it("is written at most once per minute", async () => {
    // Without Redis there is no lock, so the conditional update is the throttle.
    const { heartbeat, lastSeenAt } = setup({ client: null });

    await heartbeat(7, "laptop");
    expect(lastSeenAt(7)).toEqual(new Date(T0));

    vi.advanceTimersByTime(30 * SECOND);
    await heartbeat(7, "laptop");
    expect(lastSeenAt(7)).toEqual(new Date(T0));

    vi.advanceTimersByTime(31 * SECOND);
    await heartbeat(7, "laptop");
    expect(lastSeenAt(7)).toEqual(new Date(T0 + 61 * SECOND));
  });

  it("never moves backward", async () => {
    const newer = new Date(T0 + 30 * SECOND);
    const { heartbeat, lastSeenAt } = setup({
      users: [userRow(7, { lastSeenAt: newer })],
    });

    await heartbeat(7, "laptop");

    expect(lastSeenAt(7)).toEqual(newer);
  });
});

describe("UserPresenceModel.getMany", () => {
  it("answers many members with the same three queries as one, one lease read and no permission lookup", async () => {
    const { cache, db, presence } = setup({
      secondaryRoles: [
        { roleId: MEMBER_ROLE, userId: 8 },
        { roleId: MEMBER_ROLE, userId: 9 },
      ],
      users: [
        userRow(7),
        userRow(8, { hideOnlineStatus: true }),
        userRow(9, { lastSeenAt: new Date(T0 - 60 * SECOND) }),
      ],
    });
    const viewer: PresenceViewer = {
      type: "moderator",
      user: { id: 8, roleId: MEMBER_ROLE },
    };
    const select = vi.spyOn(db, "select");
    const countLeases = vi.spyOn(cache, "countLeases");

    await presence.getMany({ userIds: [7], viewer });
    // Members, their secondary roles and the roles' rules.
    expect(select).toHaveBeenCalledTimes(3);
    select.mockClear();
    countLeases.mockClear();

    const presences = await presence.getMany({
      userIds: [7, 8, 9, 404, 7],
      viewer,
    });

    expect(Object.fromEntries(presences)).toEqual({
      7: { lastSeenAt: null, status: "offline" },
      8: { isHidden: true, lastSeenAt: null, status: "offline" },
      9: {
        lastSeenAt: new Date(T0 - 60 * SECOND).toISOString(),
        status: "offline",
      },
    });
    expect(select).toHaveBeenCalledTimes(3);
    expect(countLeases).toHaveBeenCalledTimes(1);
  });
});

describe("UserPresenceModel role policy", () => {
  const VISIBLE = { lastSeenAt: null, status: "offline" };
  const HIDDEN = { status: "hidden" };

  it.each([
    [
      "a forcing role hides a member who chose to be seen",
      FORCING_ROLE,
      [],
      false,
      HIDDEN,
    ],
    [
      "a disallowing role shows a member who chose to hide",
      DISALLOWING_ROLE,
      [],
      true,
      VISIBLE,
    ],
    [
      "a forcing secondary role hides a member",
      MEMBER_ROLE,
      [FORCING_ROLE],
      false,
      HIDDEN,
    ],
    [
      "a disallowing secondary role shows a member",
      MEMBER_ROLE,
      [DISALLOWING_ROLE],
      true,
      VISIBLE,
    ],
    [
      "a forcing role wins over a disallowing one",
      DISALLOWING_ROLE,
      [FORCING_ROLE],
      false,
      HIDDEN,
    ],
    [
      "allowing roles leave it to the member",
      MEMBER_ROLE,
      [MEMBER_ROLE],
      true,
      HIDDEN,
    ],
  ])("%s", async (_, roleId, secondary, hideOnlineStatus, expected) => {
    const { read } = setup({
      secondaryRoles: secondary.map(id => ({ roleId: id, userId: 7 })),
      users: [userRow(7, { hideOnlineStatus, roleId })],
    });

    expect(await read(7)).toStrictEqual(expected);
  });

  it("applies a role change to the very next read", async () => {
    const { db, read } = setup();
    expect(await read(7)).toStrictEqual(VISIBLE);

    await db
      .update(core_roles)
      .set({ forceBrowseAnonymously: true })
      .where(eq(core_roles.id, MEMBER_ROLE));

    expect(await read(7)).toStrictEqual(HIDDEN);
  });
});

describe("UserPresenceModel without a working cache", () => {
  it.each([
    ["seen 149 seconds ago", T0 - 149 * SECOND, "online"],
    ["seen 151 seconds ago", T0 - 151 * SECOND, "offline"],
    ["never seen", null, "offline"],
  ])(
    "falls back to lastSeenAt without Redis: %s is %s",
    async (_, seen, status) => {
      const { read } = setup({
        client: null,
        users: [
          userRow(7, { lastSeenAt: seen === null ? null : new Date(seen) }),
        ],
      });

      expect((await read(7))?.status).toBe(status);
    },
  );

  it("never reports a member online when the lease read fails", async () => {
    const client = {
      ...createTestCacheClient(),
      zCount: async () => await Promise.reject(new Error("connection lost")),
    } as unknown as CacheClient;
    const { read } = setup({
      client,
      users: [userRow(7, { lastSeenAt: new Date(T0) })],
    });

    expect(await read(7)).toEqual({
      lastSeenAt: new Date(T0).toISOString(),
      status: "offline",
    });
  });
});
