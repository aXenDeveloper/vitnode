import { createWebSocketChannel } from "@/ws/types";

/**
 * The wire contract of Content Engine live editing: presence, field locks,
 * the shared draft and the collaborative rich text documents. One WebSocket
 * channel carries all of it; every message names its record room.
 *
 * A browser shares one socket across its tabs, so every client message carries
 * the `clientId` of the tab that sent it, and every tab filters what it
 * receives by room and document.
 */

/** The fields that identify one record of one content type. */
export interface ContentLiveRoomRef {
  contentTypeId: string;
  itemId: number;
}

/** One collaborative rich text document: a field of a record in a language. */
export interface ContentLiveDocRef extends ContentLiveRoomRef {
  field: string;
  /** `null` for a field that is not localized. */
  locale: null | string;
}

export interface ContentLiveMember {
  avatarColor: null | string;
  /** The tab: one person in two tabs is two members. */
  clientId: string;
  /** The field the member is in, or `null` when no field has focus. */
  field: null | string;
  /** The language the member is editing, `null` for a non-localized form. */
  locale: null | string;
  name: string;
  nameCode: null | string;
  userId: number;
}

export interface ContentFieldLock {
  expiresAt: string;
  field: string;
  /** `null` for a shared (non-localized) field. */
  locale: null | string;
  user: { id: number; name: string };
}

export type ContentLiveClientMessage =
  | {
      clientId: string;
      doc: ContentLiveDocRef;
      stateVector: string;
      type: "doc:open";
    }
  | {
      clientId: string;
      doc: ContentLiveDocRef;
      type: "doc:awareness" | "doc:update";
      /** A base64 Yjs update, or a base64 awareness update. */
      update: string;
    }
  | {
      clientId: string;
      doc: ContentLiveDocRef;
      type: "doc:close";
    }
  | {
      clientId: string;
      field: null | string;
      locale: null | string;
      room: ContentLiveRoomRef;
      type: "focus";
    }
  | {
      clientId: string;
      locale: null | string;
      room: ContentLiveRoomRef;
      type: "join";
    }
  | {
      clientId: string;
      room: ContentLiveRoomRef;
      type: "heartbeat" | "leave";
    };

export type ContentLiveErrorCode =
  | "FORBIDDEN"
  | "INVALID_MESSAGE"
  | "NOT_FOUND"
  | "NOT_JOINED";

export type ContentLiveServerMessage =
  | {
      /** The person whose write changed the draft. */
      by: { id: number; name: string };
      locale: null | string;
      room: ContentLiveRoomRef;
      type: "draft";
      updatedAt: string;
      values: Record<string, unknown>;
    }
  | {
      /** The tab that must seed the empty document from the record's JSON. */
      clientId: string;
      doc: ContentLiveDocRef;
      type: "doc:seed";
    }
  | {
      room: ContentLiveRoomRef;
      type: "committed";
    }
  | {
      /** Why every member must reload the record, its draft and documents. */
      reason: "deleted" | "restored";
      room: ContentLiveRoomRef;
      type: "reset";
    }
  | {
      clientId: string;
      code: ContentLiveErrorCode;
      room?: ContentLiveRoomRef;
      type: "error";
    }
  | {
      clientId: string;
      doc: ContentLiveDocRef;
      stateVector: string;
      type: "doc:state-vector";
    }
  | {
      clientId: string;
      members: ContentLiveMember[];
      room: ContentLiveRoomRef;
      type: "joined";
    }
  | {
      doc: ContentLiveDocRef;
      /**
       * The member that sent the update, so its own tab can ignore the echo
       * (applying it again would be harmless anyway).
       */
      from: null | string;
      type: "doc:awareness" | "doc:update";
      update: string;
    }
  | {
      locks: ContentFieldLock[];
      room: ContentLiveRoomRef;
      type: "locks";
    }
  | {
      members: ContentLiveMember[];
      room: ContentLiveRoomRef;
      type: "presence";
    };

export const contentLiveChannel = createWebSocketChannel<
  ContentLiveClientMessage,
  ContentLiveServerMessage
>({ pluginId: "@vitnode/core", module: "content", id: "live" });

/** The registry room of one record. */
export const contentLiveRoom = ({
  contentTypeId,
  itemId,
}: ContentLiveRoomRef): string => `content:${contentTypeId}:${itemId}`;

/** The registry room of one collaborative document. */
export const contentLiveDocRoom = ({
  contentTypeId,
  field,
  itemId,
  locale,
}: ContentLiveDocRef): string =>
  `content-doc:${contentTypeId}:${itemId}:${field}:${locale ?? "_"}`;

export const sameContentLiveRoom = (
  a: ContentLiveRoomRef,
  b: ContentLiveRoomRef,
): boolean => a.contentTypeId === b.contentTypeId && a.itemId === b.itemId;

export const sameContentLiveDoc = (
  a: ContentLiveDocRef,
  b: ContentLiveDocRef,
): boolean =>
  sameContentLiveRoom(a, b) && a.field === b.field && a.locale === b.locale;

/** A field lock lives this long unless its holder renews it. */
export const CONTENT_FIELD_LOCK_LEASE_MS = 60_000;
/** How often a holder renews a lock while the field has focus. */
export const CONTENT_FIELD_LOCK_RENEW_MS = 20_000;
/** How often a tab tells the room it is still there. */
export const CONTENT_LIVE_HEARTBEAT_MS = 15_000;
/** A member that missed heartbeats for this long is gone. */
export const CONTENT_LIVE_MEMBER_TIMEOUT_MS = 45_000;
/** How long the client waits after the last keystroke before autosaving. */
export const CONTENT_DRAFT_AUTOSAVE_MS = 1_500;
/** How often a tab without a socket polls locks and the draft. */
export const CONTENT_LIVE_POLL_MS = 10_000;
/** How long the server waits after the last update before persisting a document. */
export const CONTENT_DOCUMENT_PERSIST_MS = 2_000;
/** Drafts and documents behind the record and older than this are removed. */
export const CONTENT_LIVE_STALE_DAYS = 30;
/** The `language` column value of a shared (non-localized) lock or draft. */
export const CONTENT_LIVE_SHARED_LOCALE = "";
