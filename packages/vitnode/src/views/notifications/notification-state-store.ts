import React from "react";

import type { NotificationState } from "@/lib/notifications/types";

export interface NotificationStateSnapshot extends NotificationState {
  userId: number;
}

type Listener = () => void;

/**
 * The unread count the bell shows, owned by nobody but this store. Three
 * sources feed it - the session payload, realtime messages and explicit
 * refreshes - and each carries the server's per-user revision. Whatever
 * arrives, only a strictly newer revision replaces what is here, so a slow
 * session response can never undo a realtime update that overtook it.
 */
export const createNotificationStateStore = () => {
  let snapshot: NotificationStateSnapshot | null = null;
  const listeners = new Set<Listener>();

  const emit = () => listeners.forEach(listener => listener());

  return {
    /** Returns `true` when `next` was newer and replaced the snapshot. */
    apply: (userId: number, next: NotificationState): boolean => {
      if (snapshot?.userId === userId && next.revision <= snapshot.revision) {
        return false;
      }

      snapshot = {
        revision: next.revision,
        unread: Math.max(0, next.unread),
        userId,
      };
      emit();

      return true;
    },
    get: () => snapshot,
    /** Forget everything - on sign-out, or when another user signs in. */
    reset: () => {
      if (snapshot === null) return;
      snapshot = null;
      emit();
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
};

export type NotificationStateStore = ReturnType<
  typeof createNotificationStateStore
>;

/** One per browser tab. Tabs stay in step through the shared WebSocket. */
export const notificationStateStore = createNotificationStateStore();

/** The current user's unread state, or `null` before anything arrived. */
export const useNotificationState = (
  userId: null | number | undefined,
  store: NotificationStateStore = notificationStateStore,
): NotificationState | null => {
  // The server never holds anyone's count, so hydration always starts from
  // `null` - matching the HTML - and picks up the live value right after.
  const snapshot = React.useSyncExternalStore(
    store.subscribe,
    store.get,
    () => null,
  );

  return snapshot && snapshot.userId === userId
    ? { revision: snapshot.revision, unread: snapshot.unread }
    : null;
};
