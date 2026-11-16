import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { and, eq, gt, inArray } from "drizzle-orm";

import { core_admin_sessions } from "@/database/admins";
import {
  core_sessions,
  core_sessions_known_devices,
} from "@/database/sessions";
import { parseUserAgent } from "@/lib/api/parse-user-agent";

export const SESSION_KINDS = ["user", "admin"] as const;
type SessionKind = (typeof SESSION_KINDS)[number];

export const zodUserDeviceSchema = z.object({
  publicId: z.string(),
  ipAddress: z.string(),
  os: z.string(),
  browser: z.string(),
  deviceType: z.enum(["desktop", "tablet", "mobile"]),
  lastSeen: z.date(),
  expiresAt: z.date(),
  sessionKinds: z.array(z.enum(SESSION_KINDS)),
});

export type UserDevice = z.infer<typeof zodUserDeviceSchema>;

interface ActiveSession {
  deviceId: number;
  expiresAt: Date;
  kind: SessionKind;
}

interface DeviceSessions {
  expiresAt: Date;
  kinds: Set<SessionKind>;
}

const activeSessionsOf = async (
  c: Context,
  userId: number,
): Promise<ActiveSession[]> => {
  const db = c.get("db");
  const now = new Date();

  const [userSessions, adminSessions] = await Promise.all([
    db
      .select({
        deviceId: core_sessions.deviceId,
        expiresAt: core_sessions.expiresAt,
      })
      .from(core_sessions)
      .where(
        and(eq(core_sessions.userId, userId), gt(core_sessions.expiresAt, now)),
      ),
    db
      .select({
        deviceId: core_admin_sessions.deviceId,
        expiresAt: core_admin_sessions.expiresAt,
      })
      .from(core_admin_sessions)
      .where(
        and(
          eq(core_admin_sessions.userId, userId),
          gt(core_admin_sessions.expiresAt, now),
        ),
      ),
  ]);

  return [
    ...userSessions.map(session => ({ ...session, kind: "user" as const })),
    ...adminSessions.map(session => ({ ...session, kind: "admin" as const })),
  ];
};

const groupByDevice = (
  sessions: ActiveSession[],
): Map<number, DeviceSessions> => {
  const byDevice = new Map<number, DeviceSessions>();
  for (const { deviceId, expiresAt, kind } of sessions) {
    const existing = byDevice.get(deviceId);
    if (!existing) {
      byDevice.set(deviceId, { expiresAt, kinds: new Set([kind]) });
      continue;
    }
    existing.kinds.add(kind);
    if (expiresAt > existing.expiresAt) existing.expiresAt = expiresAt;
  }

  return byDevice;
};

export const listUserDevices = async (
  c: Context,
  userId: number,
): Promise<UserDevice[]> => {
  const sessionsByDevice = groupByDevice(await activeSessionsOf(c, userId));
  if (sessionsByDevice.size === 0) return [];

  const rows = await c
    .get("db")
    .select({
      id: core_sessions_known_devices.id,
      publicId: core_sessions_known_devices.publicId,
      ipAddress: core_sessions_known_devices.ipAddress,
      userAgent: core_sessions_known_devices.userAgent,
      lastSeen: core_sessions_known_devices.lastSeen,
    })
    .from(core_sessions_known_devices)
    .where(
      inArray(core_sessions_known_devices.id, [...sessionsByDevice.keys()]),
    );

  return rows
    .flatMap(({ id, userAgent, ...device }) => {
      const sessions = sessionsByDevice.get(id);
      if (!sessions) return [];

      return [
        {
          ...device,
          ...parseUserAgent(userAgent),
          expiresAt: sessions.expiresAt,
          sessionKinds: SESSION_KINDS.filter(kind => sessions.kinds.has(kind)),
        },
      ];
    })
    .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
};

const hasSessionOn = async (
  c: Context,
  { deviceId, userId }: { deviceId: number; userId: number },
): Promise<boolean> => {
  const db = c.get("db");

  const [userSessions, adminSessions] = await Promise.all([
    db
      .select({ deviceId: core_sessions.deviceId })
      .from(core_sessions)
      .where(
        and(
          eq(core_sessions.userId, userId),
          eq(core_sessions.deviceId, deviceId),
        ),
      )
      .limit(1),
    db
      .select({ deviceId: core_admin_sessions.deviceId })
      .from(core_admin_sessions)
      .where(
        and(
          eq(core_admin_sessions.userId, userId),
          eq(core_admin_sessions.deviceId, deviceId),
        ),
      )
      .limit(1),
  ]);

  return userSessions.length > 0 || adminSessions.length > 0;
};

export const findUserDeviceId = async (
  c: Context,
  { publicId, userId }: { publicId: string; userId: number },
): Promise<null | number> => {
  const [device] = await c
    .get("db")
    .select({ id: core_sessions_known_devices.id })
    .from(core_sessions_known_devices)
    .where(eq(core_sessions_known_devices.publicId, publicId));

  if (!device) return null;

  return (await hasSessionOn(c, { deviceId: device.id, userId }))
    ? device.id
    : null;
};
