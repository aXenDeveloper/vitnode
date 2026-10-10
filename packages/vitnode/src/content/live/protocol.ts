import { createWebSocketChannel } from "@/ws/types";

export interface ContentLiveRoomRef {
  contentTypeId: string;
  itemId: number;
}

export interface ContentLiveDocRef extends ContentLiveRoomRef {
  field: string;
  locale: null | string;
}

export interface ContentLiveMember {
  avatarColor: null | string;
  clientId: string;
  field: null | string;
  locale: null | string;
  name: string;
  nameCode: null | string;
  userId: number;
}

export interface ContentFieldLock {
  expiresAt: string;
  field: string;
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

export type ContentLiveResetReason = "deleted" | "discarded" | "restored";

export type ContentLiveServerMessage =
  | {
      by: { id: number; name: string };
      locale: null | string;
      room: ContentLiveRoomRef;
      type: "draft";
      updatedAt: string;
      values: Record<string, unknown>;
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
      doc: ContentLiveDocRef;
      type: "doc:seed";
    }
  | {
      clientId: string;
      members: ContentLiveMember[];
      room: ContentLiveRoomRef;
      type: "joined";
    }
  | {
      doc: ContentLiveDocRef;
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
    }
  | {
      reason: ContentLiveResetReason;
      room: ContentLiveRoomRef;
      type: "reset";
    }
  | {
      room: ContentLiveRoomRef;
      type: "committed";
    };

export const contentLiveChannel = createWebSocketChannel<
  ContentLiveClientMessage,
  ContentLiveServerMessage
>({ pluginId: "@vitnode/core", module: "content", id: "live" });

export const contentLiveRoom = ({
  contentTypeId,
  itemId,
}: ContentLiveRoomRef): string => `content:${contentTypeId}:${itemId}`;

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

export const CONTENT_FIELD_LOCK_LEASE_MS = 60_000;
export const CONTENT_FIELD_LOCK_RENEW_MS = 20_000;
export const CONTENT_LIVE_HEARTBEAT_MS = 15_000;
export const CONTENT_LIVE_MEMBER_TIMEOUT_MS = 45_000;
export const CONTENT_DRAFT_AUTOSAVE_MS = 1_500;
export const CONTENT_LIVE_POLL_MS = 10_000;
export const CONTENT_DOCUMENT_PERSIST_MS = 2_000;
export const CONTENT_LIVE_STALE_DAYS = 30;
export const CONTENT_LIVE_SHARED_LOCALE = "";
