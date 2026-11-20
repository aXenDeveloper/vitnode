import { createWebSocketChannel } from "@/ws/types";

/** The browser's request to follow (or stop following) some targets of one type. */
export interface ReactionsLiveClientMessage {
  /** One tab's id; tabs sharing a connection never ride on each other's joins. */
  clientId: string;
  ids: string[];
  pluginId: string;
  targetType: string;
  type: "join" | "leave";
}

export type ReactionsLiveErrorCode =
  | "INVALID_MESSAGE"
  | "RATE_LIMITED"
  | "TOO_MANY_SUBSCRIPTIONS";

/** One target's counts after a write. The same for every reader, so it carries the values. */
export interface ReactionsLiveCountsMessage {
  counts: { code: string; count: number }[];
  room: string;
  /** Grows with every write to the target; drop anything older than what you have. */
  seq: number;
  total: number;
  type: "counts";
}

export type ReactionsLiveServerMessage =
  | ReactionsLiveCountsMessage
  | {
      clientId: string;
      /** Rooms refused: unreadable, missing or an unknown type - never which. */
      refused: string[];
      /** Rooms joined now. */
      rooms: string[];
      type: "joined";
    }
  | {
      clientId: string;
      code: ReactionsLiveErrorCode;
      type: "error";
    }
  | { room: string; type: "revoked" };

/** Core's channel for live reaction counts, on the shared WebSocket. Browser-safe. */
export const reactionsLiveChannel = createWebSocketChannel<
  ReactionsLiveClientMessage,
  ReactionsLiveServerMessage
>({ pluginId: "@vitnode/core", module: "reactions", id: "live" });

export const REACTIONS_LIVE_ROOM_PREFIX = "reactions:";

/** The room of one target - a routing key, never a permission. Browser-safe. */
export const reactionsLiveRoom = (target: {
  id: string;
  pluginId: string;
  type: string;
}): string =>
  `${REACTIONS_LIVE_ROOM_PREFIX}${target.pluginId}:${target.type}:${target.id}`;

/** Targets one connection may follow at once, over every tab sharing it. */
export const REACTIONS_LIVE_MAX_SUBSCRIPTIONS = 200;

/** Targets one join or leave message may name. */
export const REACTIONS_LIVE_MAX_IDS_PER_MESSAGE = 50;

/** Join messages one connection may send per minute. */
export const REACTIONS_LIVE_MAX_JOINS_PER_MINUTE = 120;

/** How long a successful join is trusted before the server checks it again. */
export const REACTIONS_LIVE_REAUTH_MS = 60_000;

/** How often the server looks for subscriptions due for that check. */
export const REACTIONS_LIVE_SWEEP_MS = 20_000;
