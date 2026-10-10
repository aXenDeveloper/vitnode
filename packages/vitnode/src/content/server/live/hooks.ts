import type { Context } from "hono";

import type {
  ContentLiveResetReason,
  ContentLiveRoomRef,
} from "@/content/live/protocol";

import { broadcastContentLive } from "./broadcast";

type UserLeftListener = (args: {
  c: Context;
  room: ContentLiveRoomRef;
  userId: number;
}) => Promise<void> | void;

type ResetListener = (args: {
  c: Context;
  reason: ContentLiveResetReason;
  room: ContentLiveRoomRef;
}) => Promise<void> | void;

const userLeftListeners = new Set<UserLeftListener>();
const resetListeners = new Set<ResetListener>();

export const onContentLiveUserLeft = (
  listener: UserLeftListener,
): (() => void) => {
  userLeftListeners.add(listener);

  return () => {
    userLeftListeners.delete(listener);
  };
};

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

export const resetContentLiveRecord = async (
  c: Context,
  room: ContentLiveRoomRef,
  reason: ContentLiveResetReason,
): Promise<void> => {
  await runAll(resetListeners, { c, reason, room });
  broadcastContentLive(room, { reason, room, type: "reset" });
};
