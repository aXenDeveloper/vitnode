import type { Context } from "hono";
import type { WSContext } from "hono/ws";

import { z } from "zod";

import type {
  ContentRefreshClientMessage,
  ContentRefreshErrorCode,
  ContentRefreshScope,
  ContentRefreshServerMessage,
} from "@/content/live/refresh";

import { contentAnyIdSchema } from "@/content/ids";
import {
  CONTENT_REFRESH_MAX_JOINS_PER_MINUTE,
  CONTENT_REFRESH_MAX_SUBSCRIPTIONS,
  CONTENT_REFRESH_REAUTH_MS,
  CONTENT_REFRESH_SWEEP_MS,
  contentRefreshChannel,
  contentRefreshRoom,
} from "@/content/live/refresh";
import { wsRegistry } from "@/ws/registry";

import type { ContentRefreshAuthorization } from "./auth";

import { authorizeContentRefresh, contentRefreshShareKey } from "./auth";

const contentTypeId = z.string().min(1).max(100);

const scopeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ contentTypeId, kind: z.literal("admin") }),
  z.strictObject({
    contentTypeId,
    kind: z.literal("thread"),
    rootId: contentAnyIdSchema,
  }),
]) satisfies z.ZodType<ContentRefreshScope>;

const clientId = z.string().min(1).max(64);

const clientMessageSchema = z.strictObject({
  clientId,
  scope: scopeSchema,
  type: z.enum(["join", "leave"]),
}) satisfies z.ZodType<ContentRefreshClientMessage>;

const JOIN_WINDOW_MS = 60_000;

interface Membership {
  c: Context;
  checkedAt: number;
  clientIds: Set<string>;
  room: string;
  scope: ContentRefreshScope;
  ws: WSContext;
}

const logError = (message: string, error: unknown): void => {
  // oxlint-disable-next-line no-console
  console.error(message, error);
};

const sendTo = (ws: WSContext, data: ContentRefreshServerMessage): void => {
  try {
    ws.send(JSON.stringify({ data, id: contentRefreshChannel.id }));
  } catch {
    // The socket closed meanwhile; its close handling cleans up.
  }
};

const clientIdOf = (data: unknown): string => {
  if (typeof data !== "object" || data === null || !("clientId" in data)) {
    return "";
  }
  const parsed = clientId.safeParse(data.clientId);

  return parsed.success ? parsed.data : "";
};

/**
 * The server half of Content Engine live refresh: who follows which scope on
 * this instance. A room name is only a routing key - every join is
 * authorized, each membership is checked again every
 * `CONTENT_REFRESH_REAUTH_MS` (so a signed-out, expired or demoted viewer stops
 * receiving signals) and at once when its thread's root changes. A failed
 * check answers `revoked` and leaves the room. Memberships are per tab
 * (`clientId`), so tabs sharing one connection never ride on each other's
 * joins.
 */
export const createContentRefreshServer = ({
  authorize = authorizeContentRefresh,
  now = Date.now,
  reauthMs = CONTENT_REFRESH_REAUTH_MS,
  shareKey = contentRefreshShareKey,
}: {
  authorize?: (
    c: Context,
    scope: ContentRefreshScope,
  ) => Promise<ContentRefreshAuthorization>;
  now?: () => number;
  reauthMs?: number;
  shareKey?: (c: Context, scope: ContentRefreshScope) => null | string;
} = {}) => {
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

  const removeFromRoom = (membership: Membership): void => {
    const members = byRoom.get(membership.room);
    members?.delete(membership);
    if (members?.size === 0) byRoom.delete(membership.room);
  };

  const drop = (membership: Membership, id: string): void => {
    wsRegistry.leave(membership.ws, membership.room, id);
    membership.clientIds.delete(id);
    if (membership.clientIds.size > 0) return;

    const rooms = bySocket.get(membership.ws);
    rooms?.delete(membership.room);
    if (rooms?.size === 0) bySocket.delete(membership.ws);
    removeFromRoom(membership);
  };

  const revoke = (
    membership: Membership,
    code: "FORBIDDEN" | "NOT_FOUND",
  ): void => {
    for (const id of [...membership.clientIds]) {
      drop(membership, id);
      sendTo(membership.ws, {
        clientId: id,
        code,
        room: membership.room,
        type: "revoked",
      });
    }
  };

  /** Re-checks memberships, asking once per group of identical answers. */
  const recheck = async (memberships: Membership[]): Promise<void> => {
    const shared = new Map<string, Promise<ContentRefreshAuthorization>>();

    await Promise.all(
      memberships.map(async membership => {
        const key = shareKey(membership.c, membership.scope);
        let pending = key === null ? undefined : shared.get(key);
        if (!pending) {
          pending = authorize(membership.c, membership.scope).catch(
            (error: unknown): ContentRefreshAuthorization => {
              logError("Content refresh authorization error:", error);

              return { code: "FORBIDDEN", ok: false };
            },
          );
          if (key !== null) shared.set(key, pending);
        }
        const result = await pending;
        if (result.ok) membership.checkedAt = now();
        else revoke(membership, result.code);
      }),
    );
  };

  const sweep = async (): Promise<void> => {
    const due = [...bySocket.values()]
      .flatMap(rooms => [...rooms.values()])
      .filter(membership => membership.checkedAt + reauthMs <= now());
    if (due.length > 0) await recheck(due);
  };

  const startSweeper = (): void => {
    if (sweeper) return;
    sweeper = setInterval(() => {
      sweep().catch((error: unknown) => {
        logError("Content refresh sweep error:", error);
      });
    }, CONTENT_REFRESH_SWEEP_MS);
    sweeper.unref?.();
  };

  const allowJoin = (ws: WSContext): boolean => {
    const recent = (joins.get(ws) ?? []).filter(
      at => at > now() - JOIN_WINDOW_MS,
    );
    const allowed = recent.length < CONTENT_REFRESH_MAX_JOINS_PER_MINUTE;
    if (allowed) recent.push(now());
    joins.set(ws, recent);

    return allowed;
  };

  const handleMessage = async (
    c: Context,
    ws: WSContext,
    message: ContentRefreshClientMessage,
  ): Promise<void> => {
    const room = contentRefreshRoom(message.scope);
    const existing = bySocket.get(ws)?.get(room);

    if (message.type === "leave") {
      if (existing?.clientIds.has(message.clientId)) {
        drop(existing, message.clientId);
      }

      return;
    }

    const fail = (code: ContentRefreshErrorCode): void => {
      sendTo(ws, { clientId: message.clientId, code, room, type: "error" });
    };

    if (!allowJoin(ws)) {
      fail("RATE_LIMITED");

      return;
    }
    if (
      !existing?.clientIds.has(message.clientId) &&
      countOf(ws) >= CONTENT_REFRESH_MAX_SUBSCRIPTIONS
    ) {
      fail("TOO_MANY_SUBSCRIPTIONS");

      return;
    }

    const result = await authorize(c, message.scope);
    // Closing or closed while authorizing: its close cleanup already ran.
    if (ws.readyState >= 2) return;
    if (!result.ok) {
      const current = bySocket.get(ws)?.get(room);
      if (current?.clientIds.has(message.clientId)) {
        drop(current, message.clientId);
      }
      fail(result.code);

      return;
    }

    const rooms = bySocket.get(ws) ?? new Map<string, Membership>();
    bySocket.set(ws, rooms);
    let membership = rooms.get(room);
    if (!membership) {
      membership = {
        c,
        checkedAt: now(),
        clientIds: new Set<string>(),
        room,
        scope: message.scope,
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
    wsRegistry.join(ws, room, message.clientId);

    sendTo(ws, { clientId: message.clientId, room, type: "joined" });
    startSweeper();
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
        sendTo(ws, {
          clientId: clientIdOf(data),
          code: "INVALID_MESSAGE",
          type: "error",
        });

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
          logError("Content refresh message error:", error);
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
      for (const membership of rooms.values()) removeFromRoom(membership);
    },
    /**
     * Checks every local member of `room` again now - after its thread's
     * root changed - and revokes the ones that lost access.
     */
    revalidateRoom: async (room: string): Promise<void> => {
      const members = [...(byRoom.get(room) ?? [])];
      if (members.length > 0) await recheck(members);
    },
    stop: (): void => {
      clearInterval(sweeper);
      sweeper = undefined;
    },
    sweep,
  };
};
