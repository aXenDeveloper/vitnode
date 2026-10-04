import React from "react";

import type { NotificationState } from "@/lib/notifications/types";

export interface NotificationStateSnapshot extends NotificationState {
  userId: number;
}

type Listener = () => void;

export const createNotificationStateStore = () => {
  let snapshot: NotificationStateSnapshot | null = null;
  const listeners = new Set<Listener>();

  const emit = () => listeners.forEach(listener => listener());

  return {
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

export const notificationStateStore = createNotificationStateStore();

const NO_SERVER_SNAPSHOT = () => null;

export const useNotificationState = (
  userId: number,
): NotificationState | null => {
  const snapshot = React.useSyncExternalStore(
    notificationStateStore.subscribe,
    notificationStateStore.get,
    NO_SERVER_SNAPSHOT,
  );

  return snapshot?.userId === userId
    ? { revision: snapshot.revision, unread: snapshot.unread }
    : null;
};
