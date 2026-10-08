import type { Context } from "hono";

import type { ContentLiveRoomRef } from "@/content/live/protocol";

import { broadcastContentLive } from "./broadcast";

/**
 * Lifecycle seams between the live socket and the HTTP side of live editing,
 * so neither imports the other. Listeners register at module load.
 */

type UserLeftListener = (args: {
  c: Context;
  room: ContentLiveRoomRef;
  userId: number;
}) => Promise<void> | void;

type ResetListener = (args: {
  c: Context;
  reason: "deleted" | "restored";
  room: ContentLiveRoomRef;
}) => Promise<void> | void;

const userLeftListeners = new Set<UserLeftListener>();
const resetListeners = new Set<ResetListener>();

/** Runs when a user has no member (tab) left in a record's room. */
export const onContentLiveUserLeft = (
  listener: UserLeftListener,
): (() => void) => {
  userLeftListeners.add(listener);

  return () => {
    userLeftListeners.delete(listener);
  };
};

/** Runs when a record's working state must be thrown away. */
export const onContentLiveReset = (listener: ResetListener): (() => void) => {
  resetListeners.add(listener);

  return () => {
    resetListeners.delete(listener);
  };
};

const runAll = async <T>(
  listeners: Set<(args: T) => Promise<void> | void>,
  args: T,
): Promise<void> => {
  const results = await Promise.allSettled(
    [...listeners].map(async listener => {
      await listener(args);
    }),
  );

  for (const result of results) {
    if (result.status === "rejected") {
      // eslint-disable-next-line no-console
      console.error("Content live listener error:", result.reason);
    }
  }
};

export const contentLiveUserLeft = async (
  args: Parameters<UserLeftListener>[0],
): Promise<void> => {
  await runAll(userLeftListeners, args);
};

/**
 * Drop a record's drafts, locks and collaborative documents, then tell every
 * member to reload. Called after a revision restore and after a delete.
 */
export const resetContentLiveRecord = async (
  c: Context,
  room: ContentLiveRoomRef,
  reason: "deleted" | "restored",
): Promise<void> => {
  await runAll(resetListeners, { c, reason, room });
  broadcastContentLive(room, { reason, room, type: "reset" });
};
