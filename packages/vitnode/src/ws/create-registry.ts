import type { WSContext } from "hono/ws";

import type { VitNodeWSMessage } from "./types";

/** What a socket left when it closed: one entry per room member it carried. */
export type WebSocketRoomLeft = { memberId: string; room: string }[];

/** Called when a socket that was in a room closes. */
export type ConnectionCloseListener = (
  ws: WSContext,
  left: WebSocketRoomLeft,
) => void;

/**
 * The open WebSocket connections and rooms owned by one realtime host: a
 * Node/Bun process, or one Cloudflare Durable Object hub. See
 * {@link createWebSocketRegistry}.
 */
export interface WebSocketRegistry {
  /**
   * Tracks a new connection and the signed-in user who owns it (`null` for a
   * guest), with the device of the session that authenticated it.
   */
  add: (ws: WSContext, userId: null | number, deviceId?: null | number) => void;
  /** Send `{ id, data }` to every open connection. */
  broadcast: (id: string, data: unknown) => void;
  /**
   * Closes every connection with `code`, so each client reconnects and
   * restores its rooms and state. Cleanup runs through each socket's normal
   * close handling.
   */
  closeAll: (code: number, reason: string) => void;
  /**
   * Closes a user's connections - only those authenticated from `deviceId`
   * when given, else all of them.
   */
  closeUser: (
    userId: number,
    deviceId: null | number,
    code: number,
    reason: string,
  ) => void;
  /** How many connections are open. */
  connectionCount: () => number;
  /**
   * Adds `memberId` on this socket to `room`; `true` if it was not there yet.
   * Check who may join before calling it - a room is only as private as that.
   */
  join: (ws: WSContext, room: string, memberId: string) => boolean;
  /** Removes `memberId` on this socket from `room`; `true` if it was there. */
  leave: (ws: WSContext, room: string, memberId: string) => boolean;
  /** Every member of `room`, with its socket. */
  membersOf: (room: string) => { memberId: string; ws: WSContext }[];
  /**
   * Runs `listener` when a socket that was in a room closes, with the rooms
   * and members it left. Returns an unsubscribe function. Listener errors are
   * logged, not thrown.
   */
  onConnectionClose: (listener: ConnectionCloseListener) => () => void;
  /** Forgets a closed connection and takes it out of every room. */
  remove: (ws: WSContext) => void;
  /** The rooms one socket is in. */
  roomsOf: (ws: WSContext) => string[];
  /** Send `{ id, data }` only to the connections owned by `userId`. */
  sendToUser: (userId: number, id: string, data: unknown) => void;
  /** Send `{ id, data }` to every socket in `room`. */
  toRoom: (room: string, id: string, data: unknown) => void;
}

const logError = (message: string, error: unknown): void => {
  // oxlint-disable-next-line no-console
  console.error(message, error);
};

/** The JSON frame every server push uses. */
export const encodeWebSocketMessage = (id: string, data: unknown): string =>
  JSON.stringify({ data, id } satisfies VitNodeWSMessage);

/**
 * Creates an empty {@link WebSocketRegistry}. Each registry owns its own
 * connection, user, device, room and close-listener indexes, so two registries
 * never see each other's sockets - one per Node/Bun process, one per
 * Cloudflare hub. A socket whose send fails is removed.
 *
 * Server-only. Plugins do not create registries; they use `wsRegistry` from
 * `@vitnode/core/ws/registry`, which acts on the registry of the runtime that
 * is handling the current socket event.
 *
 * @param options.sharedCloseListeners Listeners that every registry runs in
 * addition to its own - the ones plugins register at module load through
 * `wsRegistry.onConnectionClose`.
 */
export const createWebSocketRegistry = ({
  sharedCloseListeners,
}: {
  sharedCloseListeners?: ReadonlySet<ConnectionCloseListener>;
} = {}): WebSocketRegistry => {
  const connections = new Map<WSContext, null | number>();
  // Reverse indexes, so per-user sends and closing a socket touch only what
  // belongs to that user/socket instead of scanning every connection or room.
  const connectionsByUser = new Map<number, Set<WSContext>>();
  const deviceBySocket = new Map<WSContext, number>();
  const roomsBySocket = new Map<WSContext, Set<string>>();
  const rooms = new Map<string, Map<WSContext, Set<string>>>();
  const closeListeners = new Set<ConnectionCloseListener>();

  const unindexUser = (ws: WSContext, userId: null | number | undefined) => {
    if (userId === null || userId === undefined) return;
    const sockets = connectionsByUser.get(userId);
    if (!sockets) return;
    sockets.delete(ws);
    if (sockets.size === 0) connectionsByUser.delete(userId);
  };

  const sendRaw = (ws: WSContext, raw: string): void => {
    try {
      ws.send(raw);
    } catch {
      registry.remove(ws);
    }
  };

  // A failed send removes that socket mid-loop, which Map/Set iteration allows.
  const sendRawToAll = (sockets: Iterable<WSContext>, raw: string): void => {
    for (const ws of sockets) sendRaw(ws, raw);
  };

  const closeSocket = (ws: WSContext, code: number, reason: string): void => {
    try {
      ws.close(code, reason);
    } catch {
      registry.remove(ws);
    }
  };

  const registry: WebSocketRegistry = {
    add: (ws, userId, deviceId = null) => {
      unindexUser(ws, connections.get(ws));
      connections.set(ws, userId);
      deviceBySocket.delete(ws);
      if (userId === null) return;
      if (deviceId !== null) deviceBySocket.set(ws, deviceId);

      const sockets = connectionsByUser.get(userId) ?? new Set<WSContext>();
      connectionsByUser.set(userId, sockets);
      sockets.add(ws);
    },
    broadcast: (id, data) => {
      if (connections.size === 0) return;
      sendRawToAll(connections.keys(), encodeWebSocketMessage(id, data));
    },
    closeAll: (code, reason) => {
      for (const ws of [...connections.keys()]) closeSocket(ws, code, reason);
    },
    closeUser: (userId, deviceId, code, reason) => {
      for (const ws of [...(connectionsByUser.get(userId) ?? [])]) {
        const socketDevice = deviceBySocket.get(ws);
        if (
          deviceId !== null &&
          socketDevice !== undefined &&
          socketDevice !== deviceId
        ) {
          continue;
        }
        closeSocket(ws, code, reason);
      }
    },
    connectionCount: () => connections.size,
    join: (ws, room, memberId) => {
      const sockets = rooms.get(room) ?? new Map<WSContext, Set<string>>();
      rooms.set(room, sockets);
      const members = sockets.get(ws) ?? new Set<string>();
      sockets.set(ws, members);
      const joined = roomsBySocket.get(ws) ?? new Set<string>();
      roomsBySocket.set(ws, joined);
      joined.add(room);

      if (members.has(memberId)) return false;
      members.add(memberId);

      return true;
    },
    leave: (ws, room, memberId) => {
      const sockets = rooms.get(room);
      const members = sockets?.get(ws);
      if (!sockets || !members?.delete(memberId)) return false;

      if (members.size === 0) {
        sockets.delete(ws);
        const joined = roomsBySocket.get(ws);
        joined?.delete(room);
        if (joined?.size === 0) roomsBySocket.delete(ws);
      }
      if (sockets.size === 0) rooms.delete(room);

      return true;
    },
    membersOf: room =>
      [...(rooms.get(room) ?? new Map<WSContext, Set<string>>())].flatMap(
        ([ws, members]) => [...members].map(memberId => ({ memberId, ws })),
      ),
    onConnectionClose: listener => {
      closeListeners.add(listener);

      return () => {
        closeListeners.delete(listener);
      };
    },
    remove: ws => {
      unindexUser(ws, connections.get(ws));
      connections.delete(ws);
      deviceBySocket.delete(ws);

      const joined = roomsBySocket.get(ws);
      roomsBySocket.delete(ws);
      if (!joined) return;

      const left: WebSocketRoomLeft = [];
      joined.forEach(room => {
        const sockets = rooms.get(room);
        const members = sockets?.get(ws);
        if (!sockets || !members) return;

        members.forEach(memberId => left.push({ memberId, room }));
        sockets.delete(ws);
        if (sockets.size === 0) rooms.delete(room);
      });

      if (left.length === 0) return;

      for (const listener of [
        ...closeListeners,
        ...(sharedCloseListeners ?? []),
      ]) {
        try {
          listener(ws, left);
        } catch (error) {
          logError("WebSocket close listener error:", error);
        }
      }
    },
    roomsOf: ws => [...(roomsBySocket.get(ws) ?? [])],
    sendToUser: (userId, id, data) => {
      const sockets = connectionsByUser.get(userId);
      if (!sockets) return;
      sendRawToAll(sockets, encodeWebSocketMessage(id, data));
    },
    toRoom: (room, id, data) => {
      const sockets = rooms.get(room);
      if (!sockets) return;
      sendRawToAll(sockets.keys(), encodeWebSocketMessage(id, data));
    },
  };

  return registry;
};
