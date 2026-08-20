// @vitest-environment node
import type { Context } from "hono";

import { beforeEach, describe, expect, it } from "vitest";

import type { StaffPermissionSet } from "./permission-staff";

import { resolveStaffPermissions } from "./check-staff-permission";
import {
  invalidateAllStaffPermissions,
  invalidateStaffEntry,
  invalidateStaffPermissionsForUser,
  readStaffPermissions,
  writeStaffPermissions,
} from "./staff-permission-cache";

/**
 * The slice of `CacheModel` this module uses, over a Map.
 *
 * `configured: false` reproduces a deployment without Redis, where every read
 * misses and every write is dropped - the case that has to keep working, since
 * Redis is optional.
 */
const fakeCache = ({ configured = true }: { configured?: boolean } = {}) => {
  const store = new Map<string, string>();

  return {
    store,
    deleteSystem: async (key: string | string[]) => {
      for (const one of Array.isArray(key) ? key : [key]) store.delete(one);

      return Promise.resolve();
    },
    getSystem: async <T>(key: string): Promise<null | T> => {
      if (!configured) return Promise.resolve(null);
      const raw = store.get(key);

      return Promise.resolve(raw === undefined ? null : (JSON.parse(raw) as T));
    },
    setSystem: async <T>(key: string, value: T): Promise<void> => {
      if (configured) store.set(key, JSON.stringify(value));

      return Promise.resolve();
    },
  };
};

/**
 * A `db` whose `select()` chain hands back the next queued result set.
 *
 * `resolveStaffPermissions` runs three selects in a fixed order - secondary
 * roles, root roles, staff entries - so a queue is enough to drive it, and
 * `selects` is what the assertions about cache hits actually count.
 */
const fakeDb = (results: unknown[][]) => {
  let index = 0;
  const state = { selects: 0 };

  return {
    state,
    db: {
      select: () => {
        state.selects += 1;
        const rows = results[index++] ?? [];
        const chain: Record<string, unknown> = {
          from: () => chain,
          where: () => chain,
          limit: async () => Promise.resolve(rows),
          then: async (
            onFulfilled: (value: unknown[]) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) => Promise.resolve(rows).then(onFulfilled, onRejected),
        };

        return chain;
      },
    },
  };
};

const MODERATOR_PERMISSION = {
  plugin: "@vitnode/core",
  module: "posts",
  permission: "can_delete",
};

/** No secondary roles, no root role, one staff entry with one permission. */
const oneStaffEntry = () => [
  [],
  [],
  [{ unrestricted: false, permissions: [MODERATOR_PERMISSION] }],
];

const context = (
  cache: ReturnType<typeof fakeCache>,
  db?: ReturnType<typeof fakeDb>["db"],
): Context =>
  ({
    get: (key: string) => (key === "cache" ? cache : db),
  }) as unknown as Context;

const USER = { id: 42, roleId: 3 };

describe("staff permission cache", () => {
  let cache: ReturnType<typeof fakeCache>;

  beforeEach(() => {
    cache = fakeCache();
  });

  it("round-trips a permission set", async () => {
    const c = context(cache);
    const value: StaffPermissionSet = {
      root: false,
      permissions: [MODERATOR_PERMISSION],
    };

    await writeStaffPermissions(c, { type: "admin", userId: 1 }, value);

    expect(await readStaffPermissions(c, { type: "admin", userId: 1 })).toEqual(
      value,
    );
  });

  it("keeps admin and moderator sets apart", async () => {
    const c = context(cache);

    await writeStaffPermissions(
      c,
      { type: "admin", userId: 1 },
      { root: true, permissions: [] },
    );

    expect(
      await readStaffPermissions(c, { type: "moderator", userId: 1 }),
    ).toBeNull();
  });

  it("keeps one user's set out of another's", async () => {
    const c = context(cache);

    await writeStaffPermissions(
      c,
      { type: "admin", userId: 1 },
      { root: true, permissions: [] },
    );

    expect(
      await readStaffPermissions(c, { type: "admin", userId: 2 }),
    ).toBeNull();
  });

  it("moving the epoch expires every user at once", async () => {
    const c = context(cache);

    for (const userId of [1, 2, 3]) {
      await writeStaffPermissions(
        c,
        { type: "admin", userId },
        { root: true, permissions: [] },
      );
    }

    await invalidateAllStaffPermissions(c);

    for (const userId of [1, 2, 3]) {
      expect(
        await readStaffPermissions(c, { type: "admin", userId }),
      ).toBeNull();
    }
  });

  it("a per-user invalidation leaves everyone else warm", async () => {
    const c = context(cache);

    for (const userId of [1, 2]) {
      await writeStaffPermissions(
        c,
        { type: "admin", userId },
        { root: true, permissions: [] },
      );
      await writeStaffPermissions(
        c,
        { type: "moderator", userId },
        { root: true, permissions: [] },
      );
    }

    await invalidateStaffPermissionsForUser(c, 1);

    expect(
      await readStaffPermissions(c, { type: "admin", userId: 1 }),
    ).toBeNull();
    expect(
      await readStaffPermissions(c, { type: "moderator", userId: 1 }),
    ).toBeNull();
    expect(
      await readStaffPermissions(c, { type: "admin", userId: 2 }),
    ).not.toBeNull();
  });

  describe("invalidateStaffEntry", () => {
    it("expires only the named user for a user-scoped entry", async () => {
      const c = context(cache);

      await writeStaffPermissions(
        c,
        { type: "admin", userId: 1 },
        { root: true, permissions: [] },
      );
      await writeStaffPermissions(
        c,
        { type: "admin", userId: 2 },
        { root: true, permissions: [] },
      );

      await invalidateStaffEntry(c, { roleId: null, userId: 1 });

      expect(
        await readStaffPermissions(c, { type: "admin", userId: 1 }),
      ).toBeNull();
      expect(
        await readStaffPermissions(c, { type: "admin", userId: 2 }),
      ).not.toBeNull();
    });

    it("expires everyone for a role-scoped entry", async () => {
      const c = context(cache);

      await writeStaffPermissions(
        c,
        { type: "admin", userId: 2 },
        { root: true, permissions: [] },
      );

      await invalidateStaffEntry(c, { roleId: 5, userId: null });

      expect(
        await readStaffPermissions(c, { type: "admin", userId: 2 }),
      ).toBeNull();
    });
  });
});

describe("resolveStaffPermissions", () => {
  it("queries the database once and serves the rest from the cache", async () => {
    const cache = fakeCache();
    const first = fakeDb(oneStaffEntry());
    const expected: StaffPermissionSet = {
      root: false,
      permissions: [MODERATOR_PERMISSION],
    };

    const one = await resolveStaffPermissions(context(cache, first.db), {
      type: "moderator",
      user: USER,
    });

    expect(one).toEqual(expected);
    expect(first.state.selects).toBe(3);

    // A second request, same cache: the loader must not run again.
    const second = fakeDb([]);
    const two = await resolveStaffPermissions(context(cache, second.db), {
      type: "moderator",
      user: USER,
    });

    expect(two).toEqual(expected);
    expect(second.state.selects).toBe(0);
  });

  it("goes back to the database after an invalidation", async () => {
    const cache = fakeCache();

    await resolveStaffPermissions(context(cache, fakeDb(oneStaffEntry()).db), {
      type: "moderator",
      user: USER,
    });

    await invalidateStaffPermissionsForUser(context(cache), USER.id);

    const after = fakeDb(oneStaffEntry());
    await resolveStaffPermissions(context(cache, after.db), {
      type: "moderator",
      user: USER,
    });

    expect(after.state.selects).toBe(3);
  });

  it("resolves from the database on every call without Redis", async () => {
    const cache = fakeCache({ configured: false });
    const expected: StaffPermissionSet = {
      root: false,
      permissions: [MODERATOR_PERMISSION],
    };

    for (const attempt of [0, 1]) {
      const run = fakeDb(oneStaffEntry());
      const result = await resolveStaffPermissions(context(cache, run.db), {
        type: "moderator",
        user: USER,
      });

      expect(result, `attempt ${attempt}`).toEqual(expected);
      expect(run.state.selects, `attempt ${attempt}`).toBe(3);
    }
  });

  it("caches a root resolution too, so `root: true` is not re-queried", async () => {
    const cache = fakeCache();
    const first = fakeDb([[], [{ id: 9 }]]);

    const one = await resolveStaffPermissions(context(cache, first.db), {
      type: "admin",
      user: USER,
    });

    expect(one).toEqual({ root: true, permissions: [] });

    const second = fakeDb([]);
    const two = await resolveStaffPermissions(context(cache, second.db), {
      type: "admin",
      user: USER,
    });

    expect(two).toEqual({ root: true, permissions: [] });
    expect(second.state.selects).toBe(0);
  });
});
