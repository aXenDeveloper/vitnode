import {
  applyAwarenessUpdate,
  Awareness,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import * as Y from "yjs";

import type {
  ContentLiveClientMessage,
  ContentLiveDocRef,
  ContentLiveServerMessage,
} from "@/content/live/protocol";

import {
  sameContentLiveDoc,
  sameContentLiveRoom,
} from "@/content/live/protocol";

export interface ContentDocTransport {
  isLive: () => boolean;
  onLiveChange: (listener: (live: boolean) => void) => () => void;
  send: (message: ContentLiveClientMessage) => void;
  subscribe: (
    listener: (message: ContentLiveServerMessage) => void,
  ) => () => void;
}

export interface ContentDocUser {
  color: string;
  name: string;
}

export interface ContentDocProvider {
  awareness: Awareness;
  destroy: () => void;
  doc: ContentLiveDocRef;
  onSeed: (listener: () => void) => () => void;
  subscribeSynced: (listener: () => void) => () => void;
  synced: () => boolean;
}

const REMOTE_ORIGIN = Symbol("content-doc-remote");

const BASE64_CHUNK = 0x80_00;

export const encodeContentDocBytes = (bytes: Uint8Array): string => {
  let binary = "";
  for (let start = 0; start < bytes.length; start += BASE64_CHUNK) {
    binary += String.fromCharCode(
      ...bytes.subarray(start, start + BASE64_CHUNK),
    );
  }

  return btoa(binary);
};

export const decodeContentDocBytes = (value: string): Uint8Array =>
  Uint8Array.from(atob(value), char => char.charCodeAt(0));

const isEmptyUpdate = (update: Uint8Array): boolean => {
  const { ds, structs } = Y.decodeUpdate(update);

  return structs.length === 0 && ds.clients.size === 0;
};

export const createContentDocProvider = ({
  clientId,
  doc,
  transport,
  user,
  ydoc,
}: {
  clientId: string;
  doc: ContentLiveDocRef;
  transport: ContentDocTransport;
  user: ContentDocUser;
  ydoc: Y.Doc;
}): ContentDocProvider => {
  const awareness = new Awareness(ydoc);
  awareness.setLocalStateField("user", user);

  let destroyed = false;
  let seated = transport.isLive();
  let stopped = false;
  let opened = false;
  let awaitingOpen = false;
  let synced = false;
  let seed: "handled" | "none" | "pending" = "none";
  const seedListeners = new Set<() => void>();
  const syncedListeners = new Set<() => void>();

  const canSend = (): boolean => !destroyed && !stopped && opened && seated;

  const sendAwareness = (): void => {
    if (!canSend() || !awareness.states.has(ydoc.clientID)) return;

    transport.send({
      clientId,
      doc,
      type: "doc:awareness",
      update: encodeContentDocBytes(
        encodeAwarenessUpdate(awareness, [ydoc.clientID]),
      ),
    });
  };

  const open = (): void => {
    if (destroyed || stopped) return;

    opened = true;
    awaitingOpen = true;
    transport.send({
      clientId,
      doc,
      stateVector: encodeContentDocBytes(Y.encodeStateVector(ydoc)),
      type: "doc:open",
    });
    sendAwareness();
  };

  const deliverSeed = (): void => {
    if (seed !== "pending" || seedListeners.size === 0) return;

    seed = "handled";
    for (const listener of seedListeners) listener();
  };

  const markSynced = (): void => {
    if (synced) return;

    synced = true;
    for (const listener of syncedListeners) listener();
  };

  const onUpdate = (update: Uint8Array, origin: unknown): void => {
    if (origin === REMOTE_ORIGIN || !canSend()) return;

    transport.send({
      clientId,
      doc,
      type: "doc:update",
      update: encodeContentDocBytes(update),
    });
  };
  ydoc.on("update", onUpdate);

  const onAwareness = (
    {
      added,
      removed,
      updated,
    }: { added: number[]; removed: number[]; updated: number[] },
    origin: unknown,
  ): void => {
    if (origin === REMOTE_ORIGIN) return;
    const changed = [...added, ...updated, ...removed];
    if (!changed.includes(ydoc.clientID) || !canSend()) return;

    transport.send({
      clientId,
      doc,
      type: "doc:awareness",
      update: encodeContentDocBytes(
        encodeAwarenessUpdate(awareness, [ydoc.clientID]),
      ),
    });
  };
  awareness.on("update", onAwareness);

  const sendMissingUpdate = (stateVector: string): void => {
    try {
      const missing = Y.encodeStateAsUpdate(
        ydoc,
        decodeContentDocBytes(stateVector),
      );
      if (!isEmptyUpdate(missing) && canSend()) {
        transport.send({
          clientId,
          doc,
          type: "doc:update",
          update: encodeContentDocBytes(missing),
        });
      }
    } catch {
      return;
    }
  };

  const onMessage = (message: ContentLiveServerMessage): void => {
    if (destroyed) return;

    switch (message.type) {
      case "doc:awareness":
      case "doc:update": {
        if (!sameContentLiveDoc(message.doc, doc)) return;
        if (message.from === clientId) return;

        try {
          const bytes = decodeContentDocBytes(message.update);
          if (message.type === "doc:update") {
            Y.applyUpdate(ydoc, bytes, REMOTE_ORIGIN);
          } else {
            applyAwarenessUpdate(awareness, bytes, REMOTE_ORIGIN);
          }
        } catch {
          return;
        }

        return;
      }
      case "doc:seed":
        if (message.clientId !== clientId) return;
        if (!sameContentLiveDoc(message.doc, doc)) return;
        if (seed === "none") seed = "pending";
        deliverSeed();

        return;
      case "doc:state-vector": {
        if (message.clientId !== clientId) return;
        if (!sameContentLiveDoc(message.doc, doc)) return;

        awaitingOpen = false;
        sendMissingUpdate(message.stateVector);
        markSynced();

        return;
      }
      case "error":
        if (message.clientId !== clientId || message.code !== "NOT_JOINED") {
          return;
        }
        if (message.room && !sameContentLiveRoom(message.room, doc)) return;
        if (!awaitingOpen && seated) open();

        return;
      case "joined":
        if (message.clientId !== clientId) return;
        if (!sameContentLiveRoom(message.room, doc)) return;
        seated = true;
        open();

        return;
      case "reset":
        if (sameContentLiveRoom(message.room, doc)) stopped = true;

        return;
      default:
        return;
    }
  };
  const unsubscribe = transport.subscribe(onMessage);

  const stopLive = transport.onLiveChange(live => {
    seated = live;
    if (!live) {
      opened = false;
      awaitingOpen = false;

      return;
    }
    if (!opened) open();
  });

  if (seated) open();

  return {
    awareness,
    destroy: () => {
      if (destroyed) return;

      removeAwarenessStates(awareness, [ydoc.clientID], "local");
      if (canSend()) transport.send({ clientId, doc, type: "doc:close" });
      destroyed = true;

      unsubscribe();
      stopLive();
      ydoc.off("update", onUpdate);
      awareness.off("update", onAwareness);
      awareness.destroy();
      seedListeners.clear();
      syncedListeners.clear();
    },
    doc,
    onSeed: listener => {
      seedListeners.add(listener);
      deliverSeed();

      return () => {
        seedListeners.delete(listener);
      };
    },
    subscribeSynced: listener => {
      syncedListeners.add(listener);

      return () => {
        syncedListeners.delete(listener);
      };
    },
    synced: () => synced,
  };
};
