import type { Context } from "hono";
import type { WSContext } from "hono/ws";

import { z } from "zod";

import type { WebSocketRegistry } from "@/ws/create-registry";

import type { ReactionsRegistry } from "../targets";
import type {
  ReactionsLiveClientMessage,
  ReactionsLiveErrorCode,
  ReactionsLiveServerMessage,
} from "./protocol";

import { findReactionTarget } from "../targets";
import {
  REACTIONS_LIVE_MAX_IDS_PER_MESSAGE,
  REACTIONS_LIVE_MAX_JOINS_PER_MINUTE,
  REACTIONS_LIVE_MAX_SUBSCRIPTIONS,
  REACTIONS_LIVE_REAUTH_MS,
  REACTIONS_LIVE_SWEEP_MS,
  reactionsLiveChannel,
  reactionsLiveRoom,
} from "./protocol";

const clientMessageSchema = z.strictObject({
  clientId: z.string().min(1).max(64),
  ids: z
    .array(z.string().min(1).max(64))
    .min(1)
    .max(REACTIONS_LIVE_MAX_IDS_PER_MESSAGE),
  pluginId: z.string().min(1).max(100),
  targetType: z.string().min(1).max(100),
  type: z.enum(["join", "leave"]),
}) satisfies z.ZodType<ReactionsLiveClientMessage>;

const JOIN_WINDOW_MS = 60_000;

interface Membership {
  c: Context;
  checkedAt: number;
  clientIds: Set<string>;
  id: string;
  pluginId: string;
  room: string;
  type: string;
  ws: WSContext;
}

const logError = (message: string, error: unknown): void => {
  // oxlint-disable-next-line no-console
  console.error(message, error);
};

const sendTo = (ws: WSContext, data: ReactionsLiveServerMessage): void => {
  try {
    ws.send(JSON.stringify({ data, id: reactionsLiveChannel.id }));
  } catch {
    // The socket closed meanwhile; its close handling cleans up.
  }
};

/** Readable ids of one target type, asked as the socket's user. */
const readableIds = async (
  c: Context,
  registry: ReactionsRegistry | undefined,
  { ids, pluginId, type }: { ids: string[]; pluginId: string; type: string },
): Promise<Set<string>> => {
  const registered = findReactionTarget(registry, { pluginId, type });
  if (!registered) return new Set();

  const parsed = ids.flatMap(id => {
    const value = registered.definition.parseId(id);

    return value === null ? [] : [value];
  });
  if (parsed.length === 0) return new Set();

  const access = await registered.definition.access(c, { ids: parsed });

  return new Set(parsed.filter(id => access.get(id)?.canRead));
};

/**
 * The server half of live reaction counts: who follows which target on this
 * instance. A room name is only a routing key - every join is authorized with
 * the target's own `access`, in one call per message, and every membership is
 * checked again every `REACTIONS_LIVE_REAUTH_MS`, so a hidden or deleted
 * target stops streaming. Memberships are per tab (`clientId`).
 */
export const createReactionsLiveServer = ({
  bind = fn => fn,
  now = Date.now,
  reauthMs = REACTIONS_LIVE_REAUTH_MS,
  registry,
}: {
  bind?: <A extends unknown[], R>(fn: (...args: A) => R) => (...args: A) => R;
  now?: () => number;
  reauthMs?: number;
  registry: Pick<WebSocketRegistry, "join" | "leave">;
}) => {
  const bySocket = new Map<WSContext, Map<string, Membership>>();
  const byRoom = new Map<string, Set<Membership>>();
  const joins = new WeakMap<WSContext, number[]>();
  const queues = new WeakMap<WSContext, Promise<void>>();
  let sweeper: ReturnType<typeof setInterval> | undefined;

  const countOf = (ws: WSContext): number =>
    [...(bySocket.get(ws)?.values() ?? [])].reduce(
      (total, membership) => total + membership.clientIds.size,
      0,
    );

  const drop = (membership: Membership, clientId: string): void => {
    registry.leave(membership.ws, membership.room, clientId);
    membership.clientIds.delete(clientId);
    if (membership.clientIds.size > 0) return;

    const rooms = bySocket.get(membership.ws);
    rooms?.delete(membership.room);
    if (rooms?.size === 0) bySocket.delete(membership.ws);
    const members = byRoom.get(membership.room);
    members?.delete(membership);
    if (members?.size === 0) byRoom.delete(membership.room);
  };

  const revoke = (membership: Membership): void => {
    for (const clientId of [...membership.clientIds]) {
      drop(membership, clientId);
    }
    sendTo(membership.ws, { room: membership.room, type: "revoked" });
  };

  const socketKeys = new WeakMap<WSContext, number>();
  let nextSocketKey = 0;
  const bySocketKey = (ws: WSContext): number => {
    let key = socketKeys.get(ws);
    if (key === undefined) {
      key = nextSocketKey++;
      socketKeys.set(ws, key);
    }

    return key;
  };

  /** Re-checks memberships with one `access` call per socket and target type. */
  const recheck = async (memberships: Membership[]): Promise<void> => {
    const groups = new Map<string, Membership[]>();
    for (const membership of memberships) {
      const key = `${String(bySocketKey(membership.ws))}|${membership.pluginId}|${membership.type}`;
      groups.set(key, [...(groups.get(key) ?? []), membership]);
    }

    await Promise.all(
      [...groups.values()].map(async group => {
        const [first] = group;
        const readable = await readableIds(
          first.c,
          first.c.get("core")?.reactions,
          {
            ids: group.map(membership => membership.id),
            pluginId: first.pluginId,
            type: first.type,
          },
        ).catch((error: unknown) => {
          logError("Reactions live authorization error:", error);

          return new Set<string>();
        });
        for (const membership of group) {
          if (readable.has(membership.id)) membership.checkedAt = now();
          else revoke(membership);
        }
      }),
    );
  };

  const sweep = async (): Promise<void> => {
    const due = [...bySocket.values()]
      .flatMap(rooms => [...rooms.values()])
      .filter(membership => membership.checkedAt + reauthMs <= now());
    if (due.length > 0) await recheck(due);
    if (bySocket.size === 0) {
      clearInterval(sweeper);
      sweeper = undefined;
    }
  };

  const startSweeper = (): void => {
    if (sweeper) return;
    sweeper = setInterval(
      bind(() => {
        sweep().catch((error: unknown) => {
          logError("Reactions live sweep error:", error);
        });
      }),
      REACTIONS_LIVE_SWEEP_MS,
    );
    sweeper.unref?.();
  };

  const allowJoin = (ws: WSContext): boolean => {
    const recent = (joins.get(ws) ?? []).filter(
      at => at > now() - JOIN_WINDOW_MS,
    );
    const allowed = recent.length < REACTIONS_LIVE_MAX_JOINS_PER_MINUTE;
    if (allowed) recent.push(now());
    joins.set(ws, recent);

    return allowed;
  };

  const handleMessage = async (
    c: Context,
    ws: WSContext,
    message: ReactionsLiveClientMessage,
  ): Promise<void> => {
    const target = { pluginId: message.pluginId, type: message.targetType };
    const roomOf = (id: string) => reactionsLiveRoom({ ...target, id });

    if (message.type === "leave") {
      for (const id of message.ids) {
        const existing = bySocket.get(ws)?.get(roomOf(id));
        if (existing?.clientIds.has(message.clientId)) {
          drop(existing, message.clientId);
        }
      }

      return;
    }

    const fail = (code: ReactionsLiveErrorCode): void => {
      sendTo(ws, { clientId: message.clientId, code, type: "error" });
    };
    if (!allowJoin(ws)) {
      fail("RATE_LIMITED");

      return;
    }
    const fresh = message.ids.filter(
      id => !bySocket.get(ws)?.get(roomOf(id))?.clientIds.has(message.clientId),
    );
    if (countOf(ws) + fresh.length > REACTIONS_LIVE_MAX_SUBSCRIPTIONS) {
      fail("TOO_MANY_SUBSCRIPTIONS");

      return;
    }

    const readable = await readableIds(c, c.get("core")?.reactions, {
      ...target,
      ids: message.ids,
    });
    if (ws.readyState >= 2) return;

    const rooms = bySocket.get(ws) ?? new Map<string, Membership>();
    bySocket.set(ws, rooms);
    const joined: string[] = [];
    const refused: string[] = [];
    for (const id of message.ids) {
      const room = roomOf(id);
      if (!readable.has(id)) {
        refused.push(room);
        continue;
      }
      let membership = rooms.get(room);
      if (!membership) {
        membership = {
          c,
          checkedAt: now(),
          clientIds: new Set<string>(),
          id,
          pluginId: target.pluginId,
          room,
          type: target.type,
          ws,
        };
        rooms.set(room, membership);
        byRoom.set(
          room,
          (byRoom.get(room) ?? new Set<Membership>()).add(membership),
        );
      }
      membership.checkedAt = now();
      membership.clientIds.add(message.clientId);
      registry.join(ws, room, message.clientId);
      joined.push(room);
    }
    if (rooms.size === 0) bySocket.delete(ws);

    sendTo(ws, {
      clientId: message.clientId,
      refused,
      rooms: joined,
      type: "joined",
    });
    if (joined.length > 0) startSweeper();
  };

  return {
    handle: async ({
      c,
      data,
      ws,
    }: {
      c: Context;
      data: unknown;
      ws: WSContext;
    }): Promise<void> => {
      const parsed = clientMessageSchema.safeParse(data);
      if (!parsed.success) {
        const clientId =
          typeof data === "object" &&
          data !== null &&
          "clientId" in data &&
          typeof data.clientId === "string"
            ? data.clientId.slice(0, 64)
            : "";
        sendTo(ws, { clientId, code: "INVALID_MESSAGE", type: "error" });

        return;
      }

      // One message at a time per connection, so a leave never overtakes
      // the join it undoes.
      const previous = queues.get(ws) ?? Promise.resolve();
      const settled = previous
        .then(async () => {
          await handleMessage(c, ws, parsed.data);
        })
        .catch((error: unknown) => {
          logError("Reactions live message error:", error);
        });
      queues.set(ws, settled);
      await settled;
    },
    memberCount: (): number =>
      [...bySocket.keys()].reduce((total, ws) => total + countOf(ws), 0),
    onConnectionClose: (ws: WSContext): void => {
      const rooms = bySocket.get(ws);
      if (!rooms) return;
      bySocket.delete(ws);
      for (const membership of rooms.values()) {
        const members = byRoom.get(membership.room);
        members?.delete(membership);
        if (members?.size === 0) byRoom.delete(membership.room);
      }
    },
    /** Drops every local member of `room` at once - its target was deleted. */
    revokeRoom: (room: string): void => {
      for (const membership of [...(byRoom.get(room) ?? [])]) {
        revoke(membership);
      }
    },
    stop: (): void => {
      clearInterval(sweeper);
      sweeper = undefined;
    },
    sweep,
  };
};

export type ReactionsLiveServer = ReturnType<typeof createReactionsLiveServer>;
