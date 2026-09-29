// @vitest-environment node
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { EnvVariablesVitNode } from "@/api/middlewares/global.middleware";

import { core_admin_permissions, core_admin_sessions } from "@/database/admins";
import { core_sessions_known_devices } from "@/database/sessions";
import { core_users } from "@/database/users";

import type { AdminSession } from "./session-cache";

import { SessionAdminModel } from "./session-admin";

const IDLE_TIMEOUT_MS = 1000 * 60 * 60;

const AUTHORIZATION = {
  adminCookieExpires: IDLE_TIMEOUT_MS,
  adminCookieName: "vitnode_auth_admin",
  cookieDomain: undefined,
  cookie_expires: 1000 * 60 * 60 * 24 * 90,
  cookieName: "vitnode_auth",
  cookieSecure: true,
  deviceCookieExpires: 1000 * 60 * 60 * 24 * 365,
  deviceCookieName: "vitnode_device",
  passkeys: { enabled: false, problems: [] },
  password: { enabled: true },
  ssoAdapters: [],
} satisfies EnvVariablesVitNode["core"]["authorization"];

interface AdminSessionUpdate {
  expiresAt: Date;
  lastSeen: Date;
}

const fakeDb = ({ sessionExpiresAt }: { sessionExpiresAt: Date | null }) => {
  const adminSessionUpdates: AdminSessionUpdate[] = [];

  const chain = (kind: string, table: unknown) => {
    const op: { kind: string; table: unknown; values?: unknown } = {
      kind,
      table,
    };
    const rows = (): unknown[] => {
      if (op.kind === "update" && op.table === core_admin_sessions) {
        adminSessionUpdates.push(op.values as AdminSessionUpdate);

        return [];
      }
      if (op.kind !== "select") return [];
      if (op.table === core_sessions_known_devices) return [{ id: 3 }];
      if (op.table === core_admin_permissions) return [{ id: 1 }];
      if (op.table === core_admin_sessions) {
        return sessionExpiresAt
          ? [{ expiresAt: sessionExpiresAt, userId: 7 }]
          : [];
      }
      if (op.table === core_users) {
        return [
          { avatarKey: null, coverKey: null, id: 7, name: "Test", roleId: 1 },
        ];
      }

      return [];
    };

    const self = {
      from: (from: unknown) => {
        op.table = from;

        return self;
      },
      leftJoin: () => self,
      limit: () => self,
      set: (values: unknown) => {
        op.values = values;

        return self;
      },
      then: async (onFulfilled: (value: unknown[]) => unknown) =>
        await Promise.resolve(onFulfilled(rows())),
      where: () => self,
    };

    return self;
  };

  return {
    adminSessionUpdates,
    db: {
      select: () => chain("select", undefined),
      update: (table: unknown) => chain("update", table),
    },
  };
};

const fakeCache = () => {
  const entries = new Map<string, unknown>();

  return {
    entries,
    cache: {
      deleteSystem: async (key: string) => {
        entries.delete(key);
        await Promise.resolve();
      },
      getSystem: async <T>(key: string) =>
        await Promise.resolve((entries.get(key) ?? null) as null | T),
      setSystem: async (key: string, value: unknown) => {
        entries.set(key, JSON.parse(JSON.stringify(value)));
        await Promise.resolve();
      },
    },
  };
};

const readSession = async ({
  cache = fakeCache(),
  extend,
  sessionExpiresAt,
}: {
  cache?: ReturnType<typeof fakeCache>;
  extend: boolean;
  sessionExpiresAt: Date | null;
}) => {
  const { adminSessionUpdates, db } = fakeDb({ sessionExpiresAt });
  let session: AdminSession | null = null;
  const app = new Hono();

  app.all("*", async c => {
    c.set("core", {
      authorization: AUTHORIZATION,
    } as unknown as EnvVariablesVitNode["core"]);
    c.set("db", db as unknown as EnvVariablesVitNode["db"]);
    c.set("cache", cache.cache as unknown as EnvVariablesVitNode["cache"]);
    c.set("ipAddress", "203.0.113.7");

    session = await new SessionAdminModel(c).getSession({ extend });

    return c.body(null, 204);
  });

  const response = await app.request("https://vitnode.com/api/x", {
    headers: { cookie: "vitnode_auth_admin=token; vitnode_device=device" },
  });

  return {
    adminSessionUpdates,
    session: session as AdminSession | null,
    setCookies: response.headers.getSetCookie(),
  };
};

const fromNow = (ms: number) => new Date(Date.now() + ms);

describe("admin session idle timeout", () => {
  it("pushes the expiry a full idle timeout ahead on activity", async () => {
    const { adminSessionUpdates, session } = await readSession({
      extend: true,
      sessionExpiresAt: fromNow(10 * 60_000),
    });

    expect(adminSessionUpdates).toHaveLength(1);
    const [update] = adminSessionUpdates;
    expect(update?.expiresAt.getTime()).toBeGreaterThan(
      Date.now() + IDLE_TIMEOUT_MS - 5_000,
    );
    expect(session?.expiresAt).toEqual(update?.expiresAt);
    expect(session?.user.id).toBe(7);
  });

  it("leaves the expiry alone on a passive read", async () => {
    const expiresAt = fromNow(10 * 60_000);
    const { adminSessionUpdates, session } = await readSession({
      extend: false,
      sessionExpiresAt: expiresAt,
    });

    expect(adminSessionUpdates).toHaveLength(0);
    expect(session?.expiresAt).toEqual(expiresAt);
  });

  it("does not write on every request right after an extension", async () => {
    const { adminSessionUpdates } = await readSession({
      extend: true,
      sessionExpiresAt: fromNow(IDLE_TIMEOUT_MS - 5_000),
    });

    expect(adminSessionUpdates).toHaveLength(0);
  });

  it("serves the extended expiry from the cache on the next request", async () => {
    const cache = fakeCache();
    const first = await readSession({
      cache,
      extend: true,
      sessionExpiresAt: fromNow(10 * 60_000),
    });
    const second = await readSession({
      cache,
      extend: false,
      sessionExpiresAt: null,
    });

    expect(second.session?.expiresAt).toEqual(first.session?.expiresAt);
    expect(second.session?.user.id).toBe(7);
  });

  it("signs out an idle session and clears its cookie", async () => {
    const { session, setCookies } = await readSession({
      extend: true,
      sessionExpiresAt: null,
    });

    expect(session).toBeNull();
    expect(
      setCookies.some(cookie => cookie.startsWith("vitnode_auth_admin=;")),
    ).toBe(true);
  });
});
