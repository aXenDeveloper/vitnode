import { isWebSocketEnabled, realtime } from "@/ws/registry";

import type { ReactionsLiveServerMessage } from "./protocol";

import { reactionsLiveChannel, reactionsLiveRoom } from "./protocol";

type RoomRevokedListener = (room: string) => void;

const revokedListeners = new Set<RoomRevokedListener>();

/** Runs `listener` with every room revoked on this instance. Returns an unsubscribe function. */
export const onReactionRoomRevoked = (
  listener: RoomRevokedListener,
): (() => void) => {
  revokedListeners.add(listener);

  return () => {
    revokedListeners.delete(listener);
  };
};

/**
 * Pushes one target's new counts to everyone following it. Best effort and
 * fire-and-forget; does nothing without the WebSocket.
 */
export const publishReactionCounts = (
  target: { id: string; pluginId: string; type: string },
  counts: {
    counts: { code: string; count: number }[];
    seq: number;
    total: number;
  },
): void => {
  if (!isWebSocketEnabled()) return;
  const room = reactionsLiveRoom(target);
  realtime.toRoom(room, reactionsLiveChannel, {
    counts: counts.counts,
    room,
    seq: counts.seq,
    total: counts.total,
    type: "counts",
  } satisfies ReactionsLiveServerMessage);
};

/** Tells everyone following these targets that they are gone, and drops them from the rooms. */
export const revokeReactionRooms = (
  target: { pluginId: string; type: string },
  ids: string[],
): void => {
  if (!isWebSocketEnabled()) return;
  for (const id of ids) {
    const room = reactionsLiveRoom({ ...target, id });
    realtime.toRoom(room, reactionsLiveChannel, {
      room,
      type: "revoked",
    } satisfies ReactionsLiveServerMessage);
    for (const listener of revokedListeners) listener(room);
  }
};
