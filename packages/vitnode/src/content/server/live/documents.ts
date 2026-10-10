import {
  applyAwarenessUpdate,
  Awareness,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import * as Y from "yjs";

import type {
  ContentLiveDocRef,
  ContentLiveRoomRef,
  ContentLiveServerMessage,
} from "@/content/live/protocol";

import {
  CONTENT_DOCUMENT_PERSIST_MS,
  contentLiveDocRoom,
  sameContentLiveRoom,
} from "@/content/live/protocol";

import {
  CONTENT_LIVE_MAX_UPDATE_BYTES,
  decodeContentLiveBytes,
  encodeContentLiveBytes,
} from "./messages";

export interface ContentDocumentStore {
  claimSeed: (doc: ContentLiveDocRef) => Promise<boolean>;
  deleteRecord: (room: ContentLiveRoomRef) => Promise<void>;
  load: (doc: ContentLiveDocRef) => Promise<null | Uint8Array>;
  releaseSeed: (doc: ContentLiveDocRef) => Promise<void>;
  save: (
    doc: ContentLiveDocRef,
    state: Uint8Array,
    meta: { baseVersion: null | number; userId: null | number },
  ) => Promise<void>;
}

export type ContentDocumentResult = "INVALID_MESSAGE" | "NOT_JOINED" | "ok";

const REMOTE_ORIGIN = Symbol("content-live-remote");
const SERVER_ORIGIN = Symbol("content-live-server");

interface DocMember<TConnection> {
  awarenessIds: Set<number>;
  connection: TConnection;
}

interface LoadedDoc<TConnection> {
  awareness: Awareness;
  baseVersion: null | number;
  claimed: boolean;
  dirty: boolean;
  doc: Y.Doc;
  members: Map<string, DocMember<TConnection>>;
  needsSeed: boolean;
  persistTimer: ReturnType<typeof setTimeout> | undefined;
  ref: ContentLiveDocRef;
  room: string;
  seeder: null | string;
  store: ContentDocumentStore;
  updatedBy: null | number;
}

const isEmptyDoc = (doc: Y.Doc): boolean => doc.store.clients.size === 0;

const unrefTimer = (timer: unknown): void => {
  if (
    typeof timer === "object" &&
    timer !== null &&
    "unref" in timer &&
    typeof timer.unref === "function"
  ) {
    timer.unref();
  }
};

const logError = (message: string, error: unknown): void => {
  // eslint-disable-next-line no-console
  console.error(message, error);
};

const asRelayedUpdate = (
  data: unknown,
): null | { type: string; update: string } => {
  if (typeof data !== "object" || data === null) return null;
  const type: unknown = Reflect.get(data, "type");
  const update: unknown = Reflect.get(data, "update");
  if (typeof type !== "string" || typeof update !== "string") return null;

  return { type, update };
};

export const createContentDocuments = <TConnection>({
  join,
  leave,
  relay,
  send,
}: {
  join: (connection: TConnection, room: string, clientId: string) => void;
  leave: (connection: TConnection, room: string, clientId: string) => void;
  relay: (room: string, message: ContentLiveServerMessage) => void;
  send: (connection: TConnection, message: ContentLiveServerMessage) => void;
}) => {
  const docs = new Map<string, LoadedDoc<TConnection>>();
  const loading = new Map<string, Promise<LoadedDoc<TConnection>>>();

  const trackAwareness = (entry: LoadedDoc<TConnection>): void => {
    entry.awareness.on(
      "update",
      (
        {
          added,
          removed,
          updated,
        }: { added: number[]; removed: number[]; updated: number[] },
        origin: unknown,
      ) => {
        if (typeof origin !== "string") return;
        const member = entry.members.get(origin);
        if (!member) return;
        for (const id of [...added, ...updated]) member.awarenessIds.add(id);
        for (const id of removed) member.awarenessIds.delete(id);
      },
    );
  };

  const load = async (
    ref: ContentLiveDocRef,
    store: ContentDocumentStore,
    baseVersion: null | number,
  ): Promise<LoadedDoc<TConnection>> => {
    const room = contentLiveDocRoom(ref);
    const existing = docs.get(room);
    if (existing) return existing;

    const pending = loading.get(room);
    if (pending) return await pending;

    const promise = (async () => {
      const state = await store.load(ref);
      const doc = new Y.Doc({ gc: true });
      if (state && state.byteLength > 0) Y.applyUpdate(doc, state);

      const awareness = new Awareness(doc);
      awareness.setLocalState(null);
      unrefTimer(awareness._checkInterval);

      const entry: LoadedDoc<TConnection> = {
        awareness,
        baseVersion,
        claimed: false,
        dirty: false,
        doc,
        members: new Map(),
        needsSeed: isEmptyDoc(doc),
        persistTimer: undefined,
        ref,
        room,
        seeder: null,
        store,
        updatedBy: null,
      };
      trackAwareness(entry);
      docs.set(room, entry);

      return entry;
    })();

    loading.set(room, promise);
    try {
      return await promise;
    } finally {
      loading.delete(room);
    }
  };

  const persist = async (entry: LoadedDoc<TConnection>): Promise<void> => {
    clearTimeout(entry.persistTimer);
    entry.persistTimer = undefined;
    if (!entry.dirty || isEmptyDoc(entry.doc)) return;

    entry.dirty = false;
    try {
      await entry.store.save(entry.ref, Y.encodeStateAsUpdate(entry.doc), {
        baseVersion: entry.baseVersion,
        userId: entry.updatedBy,
      });
      entry.claimed = false;
    } catch (error) {
      entry.dirty = true;
      logError("Content document persist error:", error);
    }
  };

  const schedulePersist = (entry: LoadedDoc<TConnection>): void => {
    entry.dirty = true;
    clearTimeout(entry.persistTimer);
    entry.persistTimer = setTimeout(() => {
      void persist(entry);
    }, CONTENT_DOCUMENT_PERSIST_MS);
    unrefTimer(entry.persistTimer);
  };

  const unload = (entry: LoadedDoc<TConnection>): void => {
    clearTimeout(entry.persistTimer);
    entry.persistTimer = undefined;
    entry.awareness.destroy();
    entry.doc.destroy();
    if (docs.get(entry.room) === entry) docs.delete(entry.room);
  };

  const markSeeded = (entry: LoadedDoc<TConnection>): void => {
    if (!entry.needsSeed || isEmptyDoc(entry.doc)) return;
    entry.needsSeed = false;
    entry.seeder = null;
  };

  const pickSeeder = async (entry: LoadedDoc<TConnection>): Promise<void> => {
    if (!entry.needsSeed || entry.seeder !== null) return;
    if (entry.members.size === 0) return;

    if (!entry.claimed) {
      try {
        entry.claimed = await entry.store.claimSeed(entry.ref);
      } catch (error) {
        logError("Content document seed claim error:", error);
      }
    }
    if (!entry.claimed || !entry.needsSeed || entry.seeder !== null) return;

    const [first] = entry.members;
    if (!first) return;
    const [clientId, member] = first;
    entry.seeder = clientId;
    send(member.connection, { clientId, doc: entry.ref, type: "doc:seed" });
  };

  const memberOf = (
    ref: ContentLiveDocRef,
    clientId: string,
    connection: TConnection,
  ): LoadedDoc<TConnection> | undefined => {
    const entry = docs.get(contentLiveDocRoom(ref));

    return entry?.members.get(clientId)?.connection === connection
      ? entry
      : undefined;
  };

  const decode = (value: string): null | Uint8Array => {
    const bytes = decodeContentLiveBytes(value);

    return bytes.byteLength > CONTENT_LIVE_MAX_UPDATE_BYTES ? null : bytes;
  };

  const closeEntry = async (
    entry: LoadedDoc<TConnection>,
    clientId: string,
  ): Promise<void> => {
    const member = entry.members.get(clientId);
    if (!member) return;

    entry.members.delete(clientId);
    leave(member.connection, entry.room, clientId);

    const ids = [...member.awarenessIds].filter(id =>
      entry.awareness.states.has(id),
    );
    if (ids.length > 0) {
      removeAwarenessStates(entry.awareness, ids, SERVER_ORIGIN);
      relay(entry.room, {
        doc: entry.ref,
        from: null,
        type: "doc:awareness",
        update: encodeContentLiveBytes(
          encodeAwarenessUpdate(entry.awareness, ids),
        ),
      });
    }

    if (entry.seeder === clientId) {
      entry.seeder = null;
      await pickSeeder(entry);
    }

    if (entry.members.size > 0) return;

    await persist(entry);
    if (entry.members.size > 0) return;

    if (entry.claimed && entry.needsSeed) {
      entry.claimed = false;
      try {
        await entry.store.releaseSeed(entry.ref);
      } catch (error) {
        logError("Content document seed release error:", error);
      }
    }
    if (entry.members.size === 0) unload(entry);
  };

  return {
    applyRemote: (room: string, data: unknown): void => {
      const entry = docs.get(room);
      const message = asRelayedUpdate(data);
      if (!entry || !message) return;

      try {
        const bytes = decodeContentLiveBytes(message.update);
        if (message.type === "doc:update") {
          Y.applyUpdate(entry.doc, bytes, REMOTE_ORIGIN);
          markSeeded(entry);
          schedulePersist(entry);
        } else if (message.type === "doc:awareness") {
          applyAwarenessUpdate(entry.awareness, bytes, REMOTE_ORIGIN);
        }
      } catch (error) {
        logError("Content document remote update error:", error);
      }
    },
    awareness: ({
      clientId,
      connection,
      doc,
      update,
    }: {
      clientId: string;
      connection: TConnection;
      doc: ContentLiveDocRef;
      update: string;
    }): ContentDocumentResult => {
      const entry = memberOf(doc, clientId, connection);
      if (!entry) return "NOT_JOINED";
      const bytes = decode(update);
      if (!bytes) return "INVALID_MESSAGE";

      try {
        applyAwarenessUpdate(entry.awareness, bytes, clientId);
      } catch {
        return "INVALID_MESSAGE";
      }
      relay(entry.room, {
        doc: entry.ref,
        from: clientId,
        type: "doc:awareness",
        update,
      });

      return "ok";
    },
    close: async ({
      clientId,
      connection,
      doc,
    }: {
      clientId: string;
      connection: TConnection;
      doc: ContentLiveDocRef;
    }): Promise<void> => {
      const entry = memberOf(doc, clientId, connection);
      if (entry) await closeEntry(entry, clientId);
    },
    closeClient: async (
      room: ContentLiveRoomRef,
      clientId: string,
    ): Promise<void> => {
      const entries = [...docs.values()].filter(
        entry =>
          sameContentLiveRoom(entry.ref, room) && entry.members.has(clientId),
      );
      await Promise.all(
        entries.map(async entry => await closeEntry(entry, clientId)),
      );
    },
    closeRoom: async (
      room: string,
      clientId: string,
      connection: TConnection,
    ): Promise<void> => {
      const entry = docs.get(room);
      if (entry?.members.get(clientId)?.connection === connection) {
        await closeEntry(entry, clientId);
      }
    },
    loaded: (doc: ContentLiveDocRef): undefined | Y.Doc =>
      docs.get(contentLiveDocRoom(doc))?.doc,
    open: async ({
      baseVersion,
      clientId,
      connection,
      doc,
      stateVector,
      store,
      userId,
    }: {
      baseVersion: null | number;
      clientId: string;
      connection: TConnection;
      doc: ContentLiveDocRef;
      stateVector: string;
      store: ContentDocumentStore;
      userId: number;
    }): Promise<ContentDocumentResult> => {
      const vector = decode(stateVector);
      if (!vector) return "INVALID_MESSAGE";
      if (vector.byteLength > 0) {
        try {
          Y.decodeStateVector(vector);
        } catch {
          return "INVALID_MESSAGE";
        }
      }

      const entry = await load(doc, store, baseVersion);
      const missing = Y.encodeStateAsUpdate(
        entry.doc,
        vector.byteLength > 0 ? vector : undefined,
      );

      const previous = entry.members.get(clientId);
      if (previous && previous.connection !== connection) {
        leave(previous.connection, entry.room, clientId);
      }
      entry.members.set(clientId, {
        awarenessIds: previous?.awarenessIds ?? new Set(),
        connection,
      });
      entry.baseVersion = baseVersion ?? entry.baseVersion;
      entry.updatedBy ??= userId;
      join(connection, entry.room, clientId);

      send(connection, {
        doc: entry.ref,
        from: null,
        type: "doc:update",
        update: encodeContentLiveBytes(missing),
      });
      send(connection, {
        clientId,
        doc: entry.ref,
        stateVector: encodeContentLiveBytes(Y.encodeStateVector(entry.doc)),
        type: "doc:state-vector",
      });
      const peers = [...entry.awareness.states.keys()];
      if (peers.length > 0) {
        send(connection, {
          doc: entry.ref,
          from: null,
          type: "doc:awareness",
          update: encodeContentLiveBytes(
            encodeAwarenessUpdate(entry.awareness, peers),
          ),
        });
      }

      await pickSeeder(entry);

      return "ok";
    },
    resetRecord: (room: ContentLiveRoomRef): void => {
      for (const entry of [...docs.values()]) {
        if (!sameContentLiveRoom(entry.ref, room)) continue;
        for (const [clientId, member] of entry.members) {
          leave(member.connection, entry.room, clientId);
        }
        entry.members.clear();
        unload(entry);
      }
    },
    retrySeeding: async (): Promise<void> => {
      await Promise.all(
        [...docs.values()].map(async entry => await pickSeeder(entry)),
      );
    },
    update: ({
      clientId,
      connection,
      doc,
      update,
      userId,
    }: {
      clientId: string;
      connection: TConnection;
      doc: ContentLiveDocRef;
      update: string;
      userId: number;
    }): ContentDocumentResult => {
      const entry = memberOf(doc, clientId, connection);
      if (!entry) return "NOT_JOINED";
      const bytes = decode(update);
      if (!bytes) return "INVALID_MESSAGE";

      try {
        Y.applyUpdate(entry.doc, bytes, clientId);
      } catch {
        return "INVALID_MESSAGE";
      }
      markSeeded(entry);
      entry.updatedBy = userId;
      relay(entry.room, {
        doc: entry.ref,
        from: clientId,
        type: "doc:update",
        update,
      });
      schedulePersist(entry);

      return "ok";
    },
  };
};
