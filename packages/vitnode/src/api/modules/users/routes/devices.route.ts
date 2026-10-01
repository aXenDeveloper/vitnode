import type { Context } from "hono";

import { and, eq, gt, inArray } from "drizzle-orm";
import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_admin_sessions } from "@/database/admins";
import {
  core_sessions,
  core_sessions_known_devices,
} from "@/database/sessions";
import { parseUserAgent } from "@/lib/api/parse-user-agent";

const SESSION_KINDS = ["user", "admin"] as const;
type SessionKind = (typeof SESSION_KINDS)[number];

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

export const listDevicesRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description:
      "List the devices the current user is signed in on, with a session of either kind.",
    path: "/devices",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              devices: z.array(
                z.object({
                  publicId: z.string(),
                  ipAddress: z.string(),
                  os: z.string(),
                  browser: z.string(),
                  deviceType: z.enum(["desktop", "tablet", "mobile"]),
                  lastSeen: z.date(),
                  expiresAt: z.date(),
                  isCurrent: z.boolean(),
                  sessionKinds: z.array(z.enum(SESSION_KINDS)),
                }),
              ),
            }),
          },
        },
        description: "List of the current user's devices",
      },
      401: {
        description: "Not signed in",
      },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const currentPublicId = getCookie(
      c,
      c.get("core").authorization.deviceCookieName,
    );

    const sessionsByDevice = groupByDevice(await activeSessionsOf(c, user.id));
    if (sessionsByDevice.size === 0) {
      return c.json({ devices: [] });
    }

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

    const devices = rows
      .flatMap(({ id, userAgent, publicId, ...device }) => {
        const sessions = sessionsByDevice.get(id);
        if (!sessions) return [];

        return [
          {
            ...device,
            publicId,
            ...parseUserAgent(userAgent),
            expiresAt: sessions.expiresAt,
            isCurrent: publicId === currentPublicId,
            sessionKinds: SESSION_KINDS.filter(kind =>
              sessions.kinds.has(kind),
            ),
          },
        ];
      })
      .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());

    return c.json({ devices });
  },
});
