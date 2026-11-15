import type { VitNodeWSChannel } from "./types";

/** The close code and reason a socket gets when its session is revoked. */
export const SESSION_REVOKED_CLOSE_CODE = 1008;
export const SESSION_REVOKED_CLOSE_REASON = "Session revoked";

/**
 * Server push to browsers over the shared WebSocket, available as
 * `c.get("realtime")` in API handlers.
 *
 * Delivery is best effort and fire-and-forget: clients that are not connected
 * miss the message, and nothing is replayed after a reconnect - keep durable
 * state in the database and let clients reload it when they reconnect.
 *
 * Where it is delivered depends on the runtime: on Node/Bun without Redis
 * (`REDIS_URL`) only clients connected to the current instance receive it;
 * with Redis it is relayed to every instance. On Cloudflare Workers it is sent
 * to the installation's Durable Object hub, which owns every socket. A message
 * that has to leave the process is kept alive past the HTTP response with the
 * request's `waitUntil`.
 */
export interface VitNodeRealtime {
  /** Push a payload to every open connection. */
  broadcast: <Receive>(
    channel: VitNodeWSChannel<unknown, Receive>,
    data: Receive,
  ) => void;
  /**
   * Close a user's open connections everywhere - only the ones opened from
   * `deviceId` when given. Core calls it whenever sessions are revoked
   * (sign-out of a device, password change or reset, admin revoke), so a socket
   * never keeps receiving a user's pushes after the session that opened it is
   * gone. Clients reconnect with whatever session they still have.
   */
  closeUserConnections: (userId: number, deviceId?: null | number) => void;
  /**
   * Push a payload only to the connections of a single user, across all of
   * their browsers/devices. Use for per-user data such as notifications.
   */
  sendToUser: <Receive>(
    userId: number,
    channel: VitNodeWSChannel<unknown, Receive>,
    data: Receive,
  ) => void;
  /**
   * Push a different payload to each of many users on one channel. Same as
   * calling `sendToUser` in a loop, but other instances (or the Cloudflare
   * hub) get it as one batch instead of one message per user. `messages` is
   * read once.
   */
  sendToUsers: <Receive>(
    channel: VitNodeWSChannel<unknown, Receive>,
    messages: Iterable<{ data: Receive; userId: number }>,
  ) => void;
  /** Push a payload to the connections that joined `room`. */
  toRoom: <Receive>(
    room: string,
    channel: VitNodeWSChannel<unknown, Receive>,
    data: Receive,
  ) => void;
}

/**
 * The realtime operations in the serializable shape a transport carries -
 * channel ids instead of channel objects, a materialized batch instead of an
 * iterable. {@link realtimeFromCommands} turns it into a
 * {@link VitNodeRealtime}.
 */
export type RealtimeDeliveryCommand =
  | { data: unknown; id: string; room: string; type: "toRoom" }
  | { data: unknown; id: string; type: "broadcast" }
  | { data: unknown; id: string; type: "sendToUser"; userId: number }
  | {
      deviceId: null | number;
      type: "closeUser";
      userId: number;
    }
  | {
      id: string;
      messages: { data: unknown; userId: number }[];
      type: "sendToUsers";
    };

/** Builds a {@link VitNodeRealtime} that hands every call to `run` as a command. */
export const realtimeFromCommands = (
  run: (command: RealtimeDeliveryCommand) => void,
): VitNodeRealtime => ({
  broadcast: (channel, data) => {
    run({ data, id: channel.id, type: "broadcast" });
  },
  closeUserConnections: (userId, deviceId = null) => {
    run({ deviceId, type: "closeUser", userId });
  },
  sendToUser: (userId, channel, data) => {
    run({ data, id: channel.id, type: "sendToUser", userId });
  },
  sendToUsers: (channel, messages) => {
    const batch = Array.from(messages, ({ data, userId }) => ({
      data: data as unknown,
      userId,
    }));
    if (batch.length === 0) return;
    run({ id: channel.id, messages: batch, type: "sendToUsers" });
  },
  toRoom: (room, channel, data) => {
    run({ data, id: channel.id, room, type: "toRoom" });
  },
});
