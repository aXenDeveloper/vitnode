import type { ContentId } from "@/content/ids";

import { contentIdKey } from "@/content/ids";
import { createWebSocketChannel } from "@/ws/types";

/**
 * What one live refresh subscription watches:
 *
 * - `admin`: the generated AdminCP list of one content type. Joining needs an
 *   AdminCP session with the content type's `can_view`.
 * - `thread`: the public thread of one threaded content type under one root
 *   record. Joining needs the same access the `GET /thread` route asks for.
 *
 * Browser-safe.
 */
export type ContentRefreshScope =
  | { contentTypeId: string; kind: "admin" }
  | { contentTypeId: string; kind: "thread"; rootId: ContentId };

/**
 * A hint that something a subscriber shows changed. It never carries values:
 * HTTP stays the source of truth, and the receiver reads it again.
 *
 * - `list`: an admin list of this content type changed.
 * - `branch`: a public change inside one top-level branch of a thread.
 *   `branchId` is the top-level comment's id - public, or shown as a
 *   placeholder, before or after the change. `removedId` is set when a
 *   comment that was public stopped being so, so a receiver whose refetch
 *   fails can still take it off screen.
 * - `thread`: the thread's root record changed in a way that can move who may
 *   read it. Read the thread again, and drop it when that is refused.
 */
export type ContentRefreshSignal =
  | { branchId: ContentId; kind: "branch"; removedId?: ContentId }
  | { kind: "list" }
  | { kind: "thread" };

export interface ContentRefreshClientMessage {
  clientId: string;
  scope: ContentRefreshScope;
  type: "join" | "leave";
}

export type ContentRefreshErrorCode =
  | "FORBIDDEN"
  | "INVALID_MESSAGE"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TOO_MANY_SUBSCRIPTIONS";

export type ContentRefreshServerMessage =
  | {
      clientId: string;
      code: "FORBIDDEN" | "NOT_FOUND";
      room: string;
      type: "revoked";
    }
  | {
      clientId: string;
      code: ContentRefreshErrorCode;
      room?: string;
      type: "error";
    }
  | { clientId: string; room: string; type: "joined" }
  | { room: string; signal: ContentRefreshSignal; type: "changed" };

/** Core's channel for Content Engine live refresh, on the shared WebSocket. */
export const contentRefreshChannel = createWebSocketChannel<
  ContentRefreshClientMessage,
  ContentRefreshServerMessage
>({ pluginId: "@vitnode/core", module: "content", id: "refresh" });

export const CONTENT_REFRESH_ROOM_PREFIX = "content-refresh:";

/**
 * The room one scope maps to - a routing key, never a permission. Content type
 * ids hold no `:`, and ids are compared as decimal or UUID strings, so a
 * bigint id is never rounded through a `number`.
 */
export const contentRefreshRoom = (scope: ContentRefreshScope): string =>
  scope.kind === "admin"
    ? `${CONTENT_REFRESH_ROOM_PREFIX}admin:${scope.contentTypeId}`
    : `${CONTENT_REFRESH_ROOM_PREFIX}thread:${scope.contentTypeId}:${contentIdKey(scope.rootId)}`;

/** Subscriptions one connection may hold at once, over every tab sharing it. */
export const CONTENT_REFRESH_MAX_SUBSCRIPTIONS = 64;

/** Join requests one connection may send per minute. */
export const CONTENT_REFRESH_MAX_JOINS_PER_MINUTE = 120;

/** How long a successful join is trusted before the server checks it again. */
export const CONTENT_REFRESH_REAUTH_MS = 60_000;

/** How often the server looks for subscriptions due for that check. */
export const CONTENT_REFRESH_SWEEP_MS = 20_000;

/** A burst of signals is applied this long after the last one... */
export const CONTENT_REFRESH_DEBOUNCE_MS = 400;

/** ...but never later than this after the first, so traffic cannot starve it. */
export const CONTENT_REFRESH_MAX_WAIT_MS = 2_000;

/** Top-level branches one `GET /thread/branches` request reads. */
export const CONTENT_THREAD_BRANCHES_MAX = 10;
