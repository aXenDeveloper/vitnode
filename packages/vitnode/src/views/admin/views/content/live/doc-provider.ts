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

/**
 * How a document provider reaches the server: the live channel of the shared
 * socket, and whether this tab holds a seat in the record's room.
 */
export interface ContentDocTransport {
  /** Whether this tab is in the record's room right now. */
  isLive: () => boolean;
  onLiveChange: (listener: (live: boolean) => void) => () => void;
  send: (message: ContentLiveClientMessage) => void;
  /** Every live message the socket delivers - for every tab of the browser. */
  subscribe: (
    listener: (message: ContentLiveServerMessage) => void,
  ) => () => void;
}

/** Who this tab is, as the carets of everyone else show it. */
export interface ContentDocUser {
  color: string;
  name: string;
}

export interface ContentDocProvider {
  /** Carets and selections. `CollaborationCaret` reads `provider.awareness`. */
  awareness: Awareness;
  /** Closes the document on the server and drops this tab's caret. */
  destroy: () => void;
  doc: ContentLiveDocRef;
  /**
   * Called once when the server picks this tab to fill the empty document from
   * the record. A seed that arrives before anyone listens waits for them.
   */
  onSeed: (listener: () => void) => () => void;
  /** Tells `listener` when {@link synced} changes. */
  subscribeSynced: (listener: () => void) => () => void;
  /** Whether the document has caught up with the server once. */
  synced: () => boolean;
}

/** Marks Yjs and awareness changes that came from the server. */
const REMOTE_ORIGIN = Symbol("content-doc-remote");

const BASE64_CHUNK = 0x80_00;

/** Base64 of bytes, without Node's `Buffer`: this runs in the browser. */
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

/**
 * One collaborative rich text document over the live channel: the client half
 * of `content/server/live/documents.ts`.
 *
 * It opens the document whenever the tab has a seat in the record's room - on
 * creation, on every (re)join, and when the server says the tab is not in the
 * document (`NOT_JOINED`, after it unloaded it) - each time with the local
 * state vector, so the server sends what the tab misses, and answers the
 * server's state vector with what the server misses. Edits made while the
 * socket was down travel that way too.
 *
 * Many tabs share one socket, so everything received is filtered by the
 * document and by this tab's `clientId`.
 */
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
  /**
   * The tab holds a seat in the record's room. Set by a `joined` reply as soon
   * as it arrives - before React re-renders with the session's `live`.
   */
  let seated = transport.isLive();
  /** The record was restored or deleted: the form remounts, this goes quiet. */
  let stopped = false;
  /** An open was sent on the current seat. */
  let opened = false;
  /** An open was sent and its state vector has not arrived yet. */
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
    // The server forgot this tab's caret along with its seat.
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
    // Only this tab's own state: remote states that timed out locally are
    // not news to anyone.
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
          // A malformed relay: the next open resyncs the whole state.
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
        try {
          const missing = Y.encodeStateAsUpdate(
            ydoc,
            decodeContentDocBytes(message.stateVector),
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
          // Nothing to answer with; the next open tries again.
        }
        markSynced();

        return;
      }
      case "error":
        if (message.clientId !== clientId || message.code !== "NOT_JOINED") {
          return;
        }
        if (message.room && !sameContentLiveRoom(message.room, doc)) return;
        // The server unloaded the document (or lost the seat): open again,
        // once per round trip.
        if (!awaitingOpen && seated) open();

        return;
      case "joined":
        if (message.clientId !== clientId) return;
        if (!sameContentLiveRoom(message.room, doc)) return;
        // A (re)join is a fresh seat: the server knows nothing of this tab's
        // documents.
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

      // Tell the others this caret is gone, then leave the document.
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
