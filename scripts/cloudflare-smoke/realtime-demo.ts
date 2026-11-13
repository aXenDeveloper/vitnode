import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { WSEvents } from "hono/ws";

import {
  assertStaffPermission,
  isStaff,
} from "@vitnode/core/api/lib/check-staff-permission";
import { realtime, wsRegistry } from "@vitnode/core/ws/registry";
import { createWebSocketChannel } from "@vitnode/core/ws/types";
import { z } from "zod";

/**
 * A small, admin-only surface that pushes through every realtime operation
 * from an ordinary HTTP request, plus a room join on the socket. It exists so
 * `smoke.mjs` can prove, against the real Worker, that a request
 * reaches the sockets the hub owns. Nothing here is needed by an app.
 */
export const demoChannel = createWebSocketChannel<{
  room: string;
  type: "join" | "leave" | "whoami";
}>({ id: "demo", module: "realtime", pluginId: "cloudflare" });

const STAFF_ROOM = "demo:staff";

const pushSchema = z.discriminatedUnion("op", [
  z.object({ data: z.unknown(), op: z.literal("broadcast") }),
  z.object({ data: z.unknown(), op: z.literal("sendToUser"), userId: z.int() }),
  z.object({
    messages: z.array(z.object({ data: z.unknown(), userId: z.int() })),
    op: z.literal("sendToUsers"),
  }),
  z.object({ data: z.unknown(), op: z.literal("toRoom"), room: z.string() }),
  z.object({
    deviceId: z.int().nullable().optional(),
    op: z.literal("closeUserConnections"),
    userId: z.int(),
  }),
]);

/**
 * `POST /api/realtime-demo/admin/push` - `/admin/` in the path makes the API
 * require an admin session, and the handler a staff permission. `via=import`
 * uses the `realtime` import instead of `c.get("realtime")`, the way core
 * modules without a Hono context push.
 */
export const mountRealtimeDemo = (app: OpenAPIHono): void => {
  app.post("/realtime-demo/admin/push", async c => {
    await assertStaffPermission(c, {
      module: "notifications",
      permission: "can_manage",
      plugin: "@vitnode/core",
      type: "admin",
    });
    const body = pushSchema.parse(await c.req.json());
    const target =
      c.req.query("via") === "import" ? realtime : c.get("realtime");

    switch (body.op) {
      case "broadcast": {
        target.broadcast(demoChannel, body.data);
        break;
      }
      case "closeUserConnections": {
        target.closeUserConnections(body.userId, body.deviceId ?? null);
        break;
      }
      case "sendToUser": {
        target.sendToUser(body.userId, demoChannel, body.data);
        break;
      }
      case "sendToUsers": {
        target.sendToUsers(demoChannel, body.messages);
        break;
      }
      case "toRoom": {
        target.toRoom(body.room, demoChannel, body.data);
        break;
      }
    }

    return c.json({ ip: c.get("ipAddress"), ok: true });
  });
};

const joinSchema = z.object({
  data: z.object({
    room: z.string().min(1).max(64),
    type: z.enum(["join", "leave", "whoami"]),
  }),
  id: z.literal(demoChannel.id),
});

/**
 * Connection-level events for `handleVitNodeWebSocket`: a tab joins or leaves
 * a room by name. `demo:staff` admits admins only - the check a real room
 * makes before `wsRegistry.join`.
 */
export const realtimeDemoEvents = async (c: Context): Promise<WSEvents> => {
  const user = c.get("user");
  const isAdmin = user
    ? await isStaff(c, { type: "admin", userId: user.id })
    : false;

  return demoEvents({
    handshakeAt: Date.now(),
    ip: c.get("ipAddress"),
    isAdmin,
  });
};

const demoEvents = ({
  handshakeAt,
  ip,
  isAdmin,
}: {
  handshakeAt: number;
  ip: string;
  isAdmin: boolean;
}): WSEvents => ({
  onMessage: (event, ws) => {
    if (typeof event.data !== "string") return;
    let parsed: z.infer<typeof joinSchema>;
    try {
      parsed = joinSchema.parse(JSON.parse(event.data));
    } catch {
      return;
    }
    const { room, type } = parsed.data;
    const reply = (data: unknown) => {
      ws.send(JSON.stringify({ data, id: demoChannel.id }));
    };

    if (type === "whoami") {
      // The IP the handshake was rate limited and audited with, and when it
      // ran: a hub that woke from hibernation replays it, so this changes.
      reply({ handshakeAt, ip });

      return;
    }
    if (type === "leave") {
      reply({ left: wsRegistry.leave(ws, room, "tab"), room });

      return;
    }
    if (room === STAFF_ROOM && !isAdmin) {
      reply({ error: "FORBIDDEN", room });

      return;
    }
    reply({ joined: wsRegistry.join(ws, room, "tab"), room });
  },
});
