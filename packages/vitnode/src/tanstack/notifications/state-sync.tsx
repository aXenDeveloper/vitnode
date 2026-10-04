import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import type { NotificationStateMessage } from "@/lib/notifications/types";

import { createCoalescer } from "@/views/notifications/coalesce";
import { notificationStateStore } from "@/views/notifications/notification-state-store";
import { fetchNotificationState } from "@/views/notifications/notifications-query";
import { notificationsStateChannel } from "@/ws/notifications";
import { useVitNodeWebSocket } from "@/ws/use-websocket";

import { useSessionQuery } from "../auth/session-query";
import { invalidateNotificationLists } from "./cache";

/** How long a tab may sit in the background before it re-reads the count. */
const STALE_AFTER_HIDDEN_MS = 30_000;
/**
 * Without a socket - none configured, or it is down - the count is re-read at
 * this pace while the tab is visible. One primary-key read per tab.
 */
const POLL_WITHOUT_SOCKET_MS = 60_000;
const OPEN = 1;

/**
 * Keeps the unread count in step for the signed-in user:
 *
 * - seeds it from the session payload;
 * - applies every realtime state message, newest revision wins;
 * - re-reads it when the socket (re)connects - messages sent while offline
 *   are not replayed - and when a long-hidden tab comes back;
 * - without a socket, re-reads it every minute while the tab is visible;
 * - refreshes open notification lists once per burst, not once per message.
 */
export const NotificationStateSync = ({
  fetchState = fetchNotificationState,
}: {
  /** How the authoritative state is re-read. Replaceable for tests. */
  fetchState?: () => Promise<{ revision: number; unread: number }>;
} = {}) => {
  const queryClient = useQueryClient();
  const { data: session } = useSessionQuery();
  const user = session?.user ?? null;
  const userId = user?.id ?? null;

  const userIdRef = React.useRef(userId);
  React.useEffect(() => {
    userIdRef.current = userId;
  });

  React.useEffect(() => {
    if (userId === null) notificationStateStore.reset();
  }, [userId]);

  const sessionState = user?.notifications;
  React.useEffect(() => {
    if (userId !== null && sessionState) {
      notificationStateStore.apply(userId, sessionState);
    }
  }, [sessionState, userId]);

  // Created in an effect, not during render: it closes over refs.
  const coalescerRef = React.useRef<null | ReturnType<typeof createCoalescer>>(
    null,
  );
  React.useEffect(() => {
    const coalescer = createCoalescer(
      () => {
        const current = userIdRef.current;
        if (current !== null) {
          void invalidateNotificationLists(queryClient, current);
        }
      },
      { maxWait: 5_000, wait: 1_000 },
    );
    coalescerRef.current = coalescer;

    return () => {
      coalescer.cancel();
      coalescerRef.current = null;
    };
  }, [queryClient]);

  const refresh = React.useCallback(async () => {
    const current = userIdRef.current;
    if (current === null) return;
    try {
      if (notificationStateStore.apply(current, await fetchState())) {
        coalescerRef.current?.schedule();
      }
    } catch {
      // Offline or signed out; the next successful read corrects it.
    }
  }, [fetchState]);

  const { readyState } = useVitNodeWebSocket(notificationsStateChannel, {
    onMessage: (message: NotificationStateMessage) => {
      const current = userIdRef.current;
      if (current === null) return;
      if (notificationStateStore.apply(current, message)) {
        coalescerRef.current?.schedule();
      }
    },
  });

  React.useEffect(() => {
    if (readyState === OPEN) void refresh();
  }, [readyState, refresh]);

  React.useEffect(() => {
    if (readyState === OPEN || userId === null) return;

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_WITHOUT_SOCKET_MS);

    return () => clearInterval(timer);
  }, [readyState, refresh, userId]);

  React.useEffect(() => {
    let hiddenAt: null | number = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (hiddenAt !== null) {
        if (Date.now() - hiddenAt > STALE_AFTER_HIDDEN_MS) void refresh();
        hiddenAt = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refresh]);

  return null;
};
