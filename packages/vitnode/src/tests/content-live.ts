import type { Context } from "hono";
import type { WSContext } from "hono/ws";

import type {
  ContentLiveClientMessage,
  ContentLiveDocRef,
  ContentLiveServerMessage,
} from "@/content/live/protocol";
import type { ContentLiveUser } from "@/content/server/live/auth";
import type { ContentDocumentStore } from "@/content/server/live/documents";

import { createContentLiveServer } from "@/content/server/live/server";
import { wsRegistry } from "@/ws/registry";

type ServerOptions = NonNullable<Parameters<typeof createContentLiveServer>[0]>;

/** An in-memory document store that counts what it was asked to do. */
export const createFakeDocumentStore = () => {
  const rows = new Map<string, Uint8Array>();
  const claims = new Set<string>();
  const keyOf = (doc: ContentLiveDocRef) =>
    `${doc.contentTypeId}:${doc.itemId}:${doc.field}:${doc.locale ?? ""}`;
  const saves: { doc: ContentLiveDocRef; userId: null | number }[] = [];

  const store: ContentDocumentStore = {
    claimSeed: async doc => {
      const key = keyOf(doc);
      if (rows.has(key) || claims.has(key)) return Promise.resolve(false);
      claims.add(key);

      return Promise.resolve(true);
    },
    deleteRecord: async room => {
      const prefix = `${room.contentTypeId}:${room.itemId}:`;
      for (const key of [...rows.keys(), ...claims]) {
        if (!key.startsWith(prefix)) continue;
        rows.delete(key);
        claims.delete(key);
      }

      return Promise.resolve();
    },
    load: async doc => Promise.resolve(rows.get(keyOf(doc)) ?? null),
    releaseSeed: async doc => {
      claims.delete(keyOf(doc));

      return Promise.resolve();
    },
    save: async (doc, state, { userId }) => {
      rows.set(keyOf(doc), state);
      claims.delete(keyOf(doc));
      saves.push({ doc, userId });

      return Promise.resolve();
    },
  };

  return {
    claims,
    has: (doc: ContentLiveDocRef) => rows.has(keyOf(doc)),
    saves,
    store,
  };
};

export interface FakeLiveSocket {
  c: Context;
  /** Every live message this socket received, oldest first. */
  received: () => ContentLiveServerMessage[];
  ws: WSContext;
}

/**
 * A live server on fake sockets: each socket has its own `c`, and so its own
 * editor. Authorization is granted per socket, which the tests flip.
 */
export const createLiveHarness = (options: Partial<ServerOptions> = {}) => {
  const users = new Map<Context, ContentLiveUser>();
  const denied = new Set<Context>();
  const sockets: WSContext[] = [];
  const store = createFakeDocumentStore();
  const userLeft: { room: unknown; userId: number }[] = [];

  const server = createContentLiveServer({
    authorize: async c => {
      const user = users.get(c);
      if (!user || denied.has(c)) {
        return Promise.resolve({
          code: "FORBIDDEN" as const,
          ok: false as const,
        });
      }

      return Promise.resolve({ ok: true as const, user, version: 3 });
    },
    createStore: () => store.store,
    isDocValid: async (_c, doc) => Promise.resolve(doc.field === "content"),
    userLeft: async ({ room, userId }) => {
      userLeft.push({ room, userId });

      return Promise.resolve();
    },
    ...options,
  });
  const usesRealRegistry = !options.registry;
  const stopClose = usesRealRegistry
    ? wsRegistry.onConnectionClose(server.onConnectionClose)
    : () => {};

  const socket = (user: Partial<ContentLiveUser> & { id: number }) => {
    const sent: { data: ContentLiveServerMessage; id: string }[] = [];
    const ws = {
      send: (raw: string) => {
        sent.push(
          JSON.parse(raw) as { data: ContentLiveServerMessage; id: string },
        );
      },
    } as unknown as WSContext;
    const c = {} as Context;
    users.set(c, {
      avatarColor: null,
      name: `user-${user.id}`,
      nameCode: null,
      ...user,
    });
    if (usesRealRegistry) wsRegistry.add(ws, user.id);
    sockets.push(ws);

    return {
      c,
      received: () => sent.map(message => message.data),
      ws,
    } satisfies FakeLiveSocket;
  };

  const send = async (
    target: FakeLiveSocket,
    message: ContentLiveClientMessage | Record<string, unknown>,
  ): Promise<void> => {
    await server.handle({ c: target.c, data: message, ws: target.ws });
  };

  return {
    deny: (target: FakeLiveSocket) => denied.add(target.c),
    /** Close a socket the way the registry does. */
    disconnect: (target: FakeLiveSocket) => {
      wsRegistry.remove(target.ws);
    },
    send,
    server,
    socket,
    stop: () => {
      server.stop();
      stopClose();
      sockets.splice(0).forEach(ws => wsRegistry.remove(ws));
    },
    store,
    userLeft,
  };
};

// An intersection rather than `Extract`: `doc:update` and `doc:awareness` share
// one union member, which `Extract` would drop.
type MessageOfType<TType> = ContentLiveServerMessage & { type: TType };

export const ofType = <TType extends ContentLiveServerMessage["type"]>(
  messages: ContentLiveServerMessage[],
  type: TType,
): MessageOfType<TType>[] =>
  messages.filter(
    (message): message is MessageOfType<TType> => message.type === type,
  );
