import type { Table } from "drizzle-orm";
import type { Context, Next } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";

import type {
  EnvVariablesVitNode,
  EnvVitNode,
} from "@/api/middlewares/global.middleware";

import { hashSessionToken } from "@/api/lib/session-token";
import { SessionModel } from "@/api/models/session";
import { SessionAdminModel } from "@/api/models/session-admin";
import {
  adminSessionCacheKey,
  sessionCacheKey,
} from "@/api/models/session-cache";
import { core_admin_permissions, core_admin_sessions } from "@/database/admins";
import {
  core_sessions,
  core_sessions_known_devices,
} from "@/database/sessions";
import { core_users } from "@/database/users";

import { createTestCache } from "./cache";
import { createMemoryDb, type MemoryRow } from "./memory-db";

export const SESSION_AUTHORIZATION = {
  adminCookieExpires: 1000 * 60 * 60,
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

const MEMBER_ROLE_ID = 2;

export interface FakeDevice {
  id: number;
  lastSeen?: Date;
  publicId: string;
}

export type FakeSessionKind = "admin" | "user";

export interface FakeSession {
  adminToken: string;
  device: FakeDevice;
  kinds: FakeSessionKind[];
  userId: number;
  userToken: string;
}

export const fakeSession = (
  userId: number,
  device: FakeDevice,
  kinds: FakeSessionKind[] = ["user", "admin"],
): FakeSession => ({
  adminToken: `admin-${userId}-${device.publicId}`,
  device,
  kinds,
  userId,
  userToken: `user-${userId}-${device.publicId}`,
});

export const sessionCookies = (
  session: FakeSession,
  kind: "admin" | "user",
): string =>
  [
    `${kind === "admin" ? SESSION_AUTHORIZATION.adminCookieName : SESSION_AUTHORIZATION.cookieName}=${kind === "admin" ? session.adminToken : session.userToken}`,
    `${SESSION_AUTHORIZATION.deviceCookieName}=${session.device.publicId}`,
  ].join("; ");

export const createSessionWorld = async ({
  extraTables = [],
  sessions,
}: {
  extraTables?: [Table, readonly object[]][];
  sessions: FakeSession[];
}) => {
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
  const hashed = await Promise.all(
    sessions.map(async session => ({
      ...session,
      adminHash: await hashSessionToken(session.adminToken),
      userHash: await hashSessionToken(session.userToken),
    })),
  );
  const devices = [
    ...new Map(sessions.map(({ device }) => [device.id, device])).values(),
  ];
  const userIds = [...new Set(sessions.map(({ userId }) => userId))];

  const { db, rows } = createMemoryDb([
    [
      core_sessions_known_devices,
      devices.map(device => ({
        ipAddress: "203.0.113.7",
        lastSeen: new Date(0),
        userAgent: "node",
        ...device,
      })),
    ],
    [
      core_users,
      userIds.map(id => ({
        email: `${id}@test.com`,
        id,
        name: `user-${id}`,
        roleId: MEMBER_ROLE_ID,
      })),
    ],
    [
      core_admin_permissions,
      userIds.map(userId => ({
        id: userId,
        permissions: [],
        protected: false,
        roleId: null,
        unrestricted: false,
        userId,
      })),
    ],
    [
      core_sessions,
      hashed
        .filter(({ kinds }) => kinds.includes("user"))
        .map(({ device, userHash, userId }) => ({
          deviceId: device.id,
          expiresAt,
          token: userHash,
          userId,
        })),
    ],
    [
      core_admin_sessions,
      hashed
        .filter(({ kinds }) => kinds.includes("admin"))
        .map(({ adminHash, device, userId }) => ({
          deviceId: device.id,
          expiresAt,
          token: adminHash,
          userId,
        })),
    ],
    ...extraTables,
  ]);
  const cache = createTestCache();

  const cacheKeysOf = (session: FakeSession) => {
    const entry = hashed.find(
      ({ adminToken }) => adminToken === session.adminToken,
    );
    if (!entry) throw new Error("unknown session");

    return {
      admin: adminSessionCacheKey(entry.adminHash, session.device.id),
      user: sessionCacheKey(entry.userHash, session.device.id),
    };
  };

  const isCached = async (session: FakeSession) => {
    const keys = cacheKeysOf(session);

    return {
      admin: (await cache.getSystem(keys.admin)) !== null,
      user: (await cache.getSystem(keys.user)) !== null,
    };
  };

  const app = new OpenAPIHono<EnvVitNode>();
  app.use("*", async (c: Context<EnvVitNode>, next: Next) => {
    c.set("core", {
      authorization: SESSION_AUTHORIZATION,
    } as unknown as EnvVariablesVitNode["core"]);
    c.set("db", db as unknown as EnvVariablesVitNode["db"]);
    c.set("cache", cache);
    c.set("ipAddress", "203.0.113.7");
    c.set("user", await new SessionModel(c).getUser());
    await next();
  });
  app.get("/probe/user", c => c.body(null, c.get("user") ? 200 : 401));
  app.get("/probe/admin", async c =>
    c.body(
      null,
      (await new SessionAdminModel(c).getSession({ extend: false }))
        ? 200
        : 401,
    ),
  );

  const probe = async (session: FakeSession) => {
    const [user, admin] = await Promise.all([
      app.request("/probe/user", {
        headers: { cookie: sessionCookies(session, "user") },
      }),
      app.request("/probe/admin", {
        headers: { cookie: sessionCookies(session, "admin") },
      }),
    ]);

    return { admin: admin.status, user: user.status };
  };

  const rowsFor = (session: FakeSession) => {
    const owns = (row: MemoryRow) =>
      row.userId === session.userId && row.deviceId === session.device.id;

    return {
      admin: rows(core_admin_sessions).filter(owns).length,
      user: rows(core_sessions).filter(owns).length,
    };
  };

  return { app, cache, isCached, probe, rows, rowsFor };
};
