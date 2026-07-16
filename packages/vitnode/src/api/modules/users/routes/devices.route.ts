import { and, desc, eq, gt } from "drizzle-orm";
import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import {
  core_sessions,
  core_sessions_known_devices,
} from "@/database/sessions";
import { parseUserAgent } from "@/lib/api/parse-user-agent";

export const listDevicesRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description: "List the devices the current user is signed in on.",
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
                }),
              ),
            }),
          },
        },
        description: "List of the current user's devices",
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

    const rows = await c
      .get("db")
      .select({
        publicId: core_sessions_known_devices.publicId,
        ipAddress: core_sessions_known_devices.ipAddress,
        userAgent: core_sessions_known_devices.userAgent,
        lastSeen: core_sessions_known_devices.lastSeen,
        expiresAt: core_sessions.expiresAt,
      })
      .from(core_sessions)
      .innerJoin(
        core_sessions_known_devices,
        eq(core_sessions.deviceId, core_sessions_known_devices.id),
      )
      .where(
        and(
          eq(core_sessions.userId, user.id),
          gt(core_sessions.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(core_sessions_known_devices.lastSeen));

    const byPublicId = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const existing = byPublicId.get(row.publicId);
      if (!existing || row.expiresAt > existing.expiresAt) {
        byPublicId.set(row.publicId, row);
      }
    }

    const devices = [...byPublicId.values()].map(
      ({ userAgent, publicId, ...device }) => ({
        ...device,
        publicId,
        ...parseUserAgent(userAgent),
        isCurrent: publicId === currentPublicId,
      }),
    );

    return c.json({ devices });
  },
});
