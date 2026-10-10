import type { Context } from "hono";
import type { WSContext } from "hono/ws";

import { z } from "zod";

import type {
  ContentLiveClientMessage,
  ContentLiveErrorCode,
  ContentLiveRoomRef,
  ContentLiveServerMessage,
} from "@/content/live/protocol";

import {
  CONTENT_LIVE_HEARTBEAT_MS,
  contentLiveChannel,
  contentLiveRoom,
} from "@/content/live/protocol";
import { publishToInstances, realtime, wsRegistry } from "@/ws/registry";

import type { ContentLiveAuthorization } from "./auth";
import type { ContentDocumentStore } from "./documents";
import type {
  ContentLiveLocalMember,
  ContentLivePresenceSnapshot,
} from "./presence";

import {
  authorizeContentLive,
  createContentLiveAuthCache,
  isContentLiveDocValid,
} from "./auth";
import { createContentDocumentStore } from "./document-store";
import { createContentDocuments } from "./documents";
import { contentLiveUserLeft } from "./hooks";
import { clientIdOf, contentLiveClientMessageSchema } from "./messages";
import { createContentLivePresence } from "./presence";

export const CONTENT_LIVE_PRESENCE_TOPIC = `${contentLiveChannel.id}:presence`;

const DOC_ROOM_PREFIX = "content-doc:";

export interface ContentLiveConnection {
  c: Context;
  ws: WSContext;
}

type LocalMember = ContentLiveLocalMember<ContentLiveConnection>;

const snapshotSchema = z.object({
  members: z.array(
    z.object({
      avatarColor: z.string().nullable(),
      clientId: z.string(),
      field: z.string().nullable(),
      locale: z.string().nullable(),
      name: z.string(),
      nameCode: z.string().nullable(),
      userId: z.number(),
    }),
  ),
  room: z.object({ contentTypeId: z.string(), itemId: z.number() }),
}) satisfies z.ZodType<ContentLivePresenceSnapshot>;

const resetSchema = z.object({
  room: z.object({ contentTypeId: z.string(), itemId: z.number() }),
  type: z.literal("reset"),
});

const logError = (message: string, error: unknown): void => {
  // eslint-disable-next-line no-console
  console.error(message, error);
};

const sendTo = (ws: WSContext, data: ContentLiveServerMessage): void => {
  try {
    ws.send(JSON.stringify({ data, id: contentLiveChannel.id }));
  } catch {
    return;
  }
};

const roomOf = (message: ContentLiveClientMessage): ContentLiveRoomRef =>
  "room" in message
    ? message.room
    : {
        contentTypeId: message.doc.contentTypeId,
        itemId: message.doc.itemId,
      };

export const createContentLiveServer = ({
  authorize = authorizeContentLive,
  authTtlMs,
  createStore = createContentDocumentStore,
  isDocValid = isContentLiveDocValid,
  now = Date.now,
  publish = snapshot => {
    publishToInstances(CONTENT_LIVE_PRESENCE_TOPIC, snapshot);
  },
  registry = wsRegistry,
  userLeft = contentLiveUserLeft,
}: {
  authorize?: (
    c: Context,
    room: ContentLiveRoomRef,
  ) => Promise<ContentLiveAuthorization>;
  authTtlMs?: number;
  createStore?: (c: Context) => ContentDocumentStore;
  isDocValid?: typeof isContentLiveDocValid;
  now?: () => number;
  publish?: (snapshot: ContentLivePresenceSnapshot) => void;
  registry?: Pick<typeof wsRegistry, "join" | "leave" | "toRoom">;
  userLeft?: typeof contentLiveUserLeft;
} = {}) => {
  const auth = createContentLiveAuthCache({ authorize, now, ttlMs: authTtlMs });
  const connections = new WeakMap<WSContext, ContentLiveConnection>();
  const queues = new WeakMap<WSContext, Promise<void>>();

  const presence = createContentLivePresence<ContentLiveConnection>({
    deliver: (room, members) => {
      registry.toRoom(contentLiveRoom(room), contentLiveChannel.id, {
        members,
        room,
        type: "presence",
      } satisfies ContentLiveServerMessage);
    },
    now,
    publish,
  });

  const documents = createContentDocuments<ContentLiveConnection>({
    join: ({ ws }, room, clientId) => {
      registry.join(ws, room, clientId);
    },
    leave: ({ ws }, room, clientId) => {
      registry.leave(ws, room, clientId);
    },
    relay: (room, message) => {
      realtime.toRoom(room, contentLiveChannel, message);
    },
    send: ({ ws }, message) => {
      sendTo(ws, message);
    },
  });

  const connectionOf = (c: Context, ws: WSContext): ContentLiveConnection => {
    const existing = connections.get(ws);
    if (existing) return existing;
    const created = { c, ws };
    connections.set(ws, created);

    return created;
  };

  const afterLeft = async (entries: LocalMember[]): Promise<void> => {
    const gone = new Map<string, LocalMember>();
    for (const entry of entries) {
      const key = `${contentLiveRoom(entry.room)}|${entry.member.userId}`;
      if (!presence.hasUser(entry.room, entry.member.userId)) {
        gone.set(key, entry);
      }
    }

    await Promise.all(
      entries.map(async ({ connection, member, room }) => {
        registry.leave(connection.ws, contentLiveRoom(room), member.clientId);
        await documents.closeClient(room, member.clientId);
      }),
    );
    await Promise.all(
      [...gone.values()].map(async ({ connection, member, room }) => {
        await userLeft({ c: connection.c, room, userId: member.userId });
      }),
    );
  };

  const removeMembers = async (
    members: { clientId: string; room: ContentLiveRoomRef }[],
  ): Promise<void> => {
    const removed = members.flatMap(
      ({ clientId, room }) => presence.remove(room, clientId) ?? [],
    );
    await afterLeft(removed);
  };

  const removeMember = async (
    room: ContentLiveRoomRef,
    clientId: string,
  ): Promise<void> => {
    await removeMembers([{ clientId, room }]);
  };

  const isMember = (
    connection: ContentLiveConnection,
    room: ContentLiveRoomRef,
    clientId: string,
  ): boolean => presence.get(room, clientId)?.connection === connection;

  let sweeper: ReturnType<typeof setInterval> | undefined;

  const sweep = async (): Promise<void> => {
    const removed = presence.sweep();
    presence.refresh();
    await afterLeft(removed);
    await documents.retrySeeding();
  };

  const startSweeper = (): void => {
    if (sweeper) return;
    sweeper = setInterval(() => {
      sweep().catch((error: unknown) => {
        logError("Content live sweep error:", error);
      });
    }, CONTENT_LIVE_HEARTBEAT_MS);
    sweeper.unref?.();
  };

  const handleMessage = async (
    connection: ContentLiveConnection,
    message: ContentLiveClientMessage,
  ): Promise<void> => {
    const { c, ws } = connection;
    const { clientId } = message;
    const room = roomOf(message);
    const fail = (code: ContentLiveErrorCode): void => {
      sendTo(ws, { clientId, code, room, type: "error" });
    };

    const guard = async (): Promise<ContentLiveAuthorization> => {
      const result = await auth.authorize(c, ws, room);
      if (!result.ok) {
        if (isMember(connection, room, clientId)) {
          await removeMember(room, clientId);
        }
        fail(result.code);
      }

      return result;
    };

    if (message.type === "join") {
      const result = await guard();
      if (!result.ok) return;

      const previous = presence.get(room, clientId);
      if (previous && previous.connection !== connection) {
        if (previous.member.userId !== result.user.id) {
          fail("FORBIDDEN");

          return;
        }
        registry.leave(previous.connection.ws, contentLiveRoom(room), clientId);
      }
      registry.join(ws, contentLiveRoom(room), clientId);
      const members = presence.join({
        connection,
        member: {
          avatarColor: result.user.avatarColor,
          clientId,
          field: previous?.member.field ?? null,
          locale: message.locale,
          name: result.user.name,
          nameCode: result.user.nameCode,
          userId: result.user.id,
        },
        room,
      });
      sendTo(ws, { clientId, members, room, type: "joined" });
      startSweeper();

      return;
    }

    if (message.type === "leave") {
      if (isMember(connection, room, clientId)) {
        await removeMember(room, clientId);
      }

      return;
    }

    if (!isMember(connection, room, clientId)) {
      fail("NOT_JOINED");

      return;
    }

    const result = await guard();
    if (!result.ok) return;

    switch (message.type) {
      case "doc:awareness":
      case "doc:update": {
        const args = {
          clientId,
          connection,
          doc: message.doc,
          update: message.update,
        };
        const outcome =
          message.type === "doc:update"
            ? documents.update({ ...args, userId: result.user.id })
            : documents.awareness(args);
        if (outcome !== "ok") fail(outcome);

        return;
      }
      case "doc:close": {
        await documents.close({ clientId, connection, doc: message.doc });

        return;
      }
      case "doc:open": {
        if (!(await isDocValid(c, message.doc))) {
          fail("NOT_FOUND");

          return;
        }
        const outcome = await documents.open({
          baseVersion: result.version,
          clientId,
          connection,
          doc: message.doc,
          stateVector: message.stateVector,
          store: createStore(c),
          userId: result.user.id,
        });
        if (outcome !== "ok") fail(outcome);

        return;
      }
      case "focus": {
        presence.focus(room, clientId, {
          field: message.field,
          locale: message.locale,
        });

        return;
      }
      case "heartbeat": {
        presence.heartbeat(room, clientId);

        return;
      }
    }
  };

  return {
    documents,
    handle: async ({
      c,
      data,
      ws,
    }: {
      c: Context;
      data: unknown;
      ws: WSContext;
    }): Promise<void> => {
      const parsed = contentLiveClientMessageSchema.safeParse(data);
      if (!parsed.success) {
        sendTo(ws, {
          clientId: clientIdOf(data),
          code: "INVALID_MESSAGE",
          type: "error",
        });

        return;
      }

      const connection = connectionOf(c, ws);
      const previous = queues.get(ws) ?? Promise.resolve();
      const current = previous.then(async () => {
        await handleMessage(connection, parsed.data);
      });
      const settled = current.catch((error: unknown) => {
        logError("Content live message error:", error);
      });
      queues.set(ws, settled);
      await settled;
    },
    onConnectionClose: (
      ws: WSContext,
      left: { memberId: string; room: string }[],
    ): void => {
      const connection = connections.get(ws);
      if (!connection) return;

      const work: Promise<void>[] = [];
      for (const { memberId, room } of left) {
        if (room.startsWith(DOC_ROOM_PREFIX)) {
          work.push(documents.closeRoom(room, memberId, connection));
        }
      }
      work.push(
        removeMembers(
          presence
            .localMembers()
            .filter(entry => entry.connection === connection)
            .map(({ member, room }) => ({ clientId: member.clientId, room })),
        ),
      );

      void Promise.all(work).catch((error: unknown) => {
        logError("Content live close error:", error);
      });
    },
    onInstanceMessage: ({
      data,
      origin,
      topic,
    }: {
      data: unknown;
      origin: string;
      topic: string;
    }): void => {
      if (topic !== CONTENT_LIVE_PRESENCE_TOPIC) return;
      const parsed = snapshotSchema.safeParse(data);
      if (!parsed.success) return;

      if (presence.applyRemote(origin, parsed.data)) {
        presence.refresh(parsed.data.room);
      }
    },
    onRemoteRoomMessage: (room: string, id: string, data: unknown): void => {
      if (id !== contentLiveChannel.id) return;
      if (room.startsWith(DOC_ROOM_PREFIX)) {
        documents.applyRemote(room, data);

        return;
      }
      const reset = resetSchema.safeParse(data);
      if (reset.success) documents.resetRecord(reset.data.room);
    },
    onReset: async ({
      c,
      room,
    }: {
      c: Context;
      room: ContentLiveRoomRef;
    }): Promise<void> => {
      documents.resetRecord(room);
      await createStore(c).deleteRecord(room);
    },
    presence,
    stop: (): void => {
      clearInterval(sweeper);
      sweeper = undefined;
    },
    sweep,
  };
};

export type ContentLiveServer = ReturnType<typeof createContentLiveServer>;
