import type { WSContext } from "hono/ws";

import type { VitNodeWSChannel, VitNodeWSMessage } from "./types";

/**
 * In-memory registry of the WebSocket connections open on the current server
 * process, used to push messages to clients. Each connection is tagged with the
 * id of the authenticated user it belongs to (or `null` when anonymous), so a
 * payload can be delivered to a single user across all of their browsers.
 *
 * Note: this is per-process. For a horizontally-scaled deployment, back it with
 * a shared pub/sub (e.g. Redis) so messages also reach clients on other
 * instances.
 */
const connections = new Map<WSContext, null | number>();

const WS_OPEN = 1; // WSContext.readyState when the socket is open.

const sendTo = (ws: WSContext, id: string, data: unknown): void => {
  if (ws.readyState === WS_OPEN) {
    ws.send(JSON.stringify({ data, id } satisfies VitNodeWSMessage));
  }
};

export const wsRegistry = {
  add: (ws: WSContext, userId: null | number): void => {
    connections.set(ws, userId);
  },
  /** Send `{ id, data }` to every open connection. */
  broadcast: (id: string, data: unknown): void => {
    connections.forEach((_userId, ws) => sendTo(ws, id, data));
  },
  remove: (ws: WSContext): void => {
    connections.delete(ws);
  },
  /** Send `{ id, data }` only to the connections owned by `userId`. */
  sendToUser: (userId: number, id: string, data: unknown): void => {
    connections.forEach((connectionUserId, ws) => {
      if (connectionUserId === userId) sendTo(ws, id, data);
    });
  },
};

export interface VitNodeRealtime {
  /**
   * Push a payload to **every** client subscribed to `channel`. Delivered to
   * the matching {@link useVitNodeWebSocket} subscribers (only views currently
   * on screen react). Use for non-sensitive "data changed" signals.
   */
  broadcast: <Receive>(
    channel: VitNodeWSChannel<unknown, Receive>,
    data: Receive,
  ) => void;
  /**
   * Push a payload only to the connections of a single user, across all of
   * their browsers/devices. Use for per-user data such as notifications.
   */
  sendToUser: <Receive>(
    userId: number,
    channel: VitNodeWSChannel<unknown, Receive>,
    data: Receive,
  ) => void;
}

/**
 * The realtime helper exposed on the request context as `c.get("realtime")`.
 */
export const realtime: VitNodeRealtime = {
  broadcast: (channel, data) => {
    wsRegistry.broadcast(channel.id, data);
  },
  sendToUser: (userId, channel, data) => {
    wsRegistry.sendToUser(userId, channel.id, data);
  },
};
