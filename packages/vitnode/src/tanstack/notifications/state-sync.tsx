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

const STALE_AFTER_HIDDEN_MS = 30_000;
const POLL_WITHOUT_SOCKET_MS = 60_000;
const SOCKET_OPEN = 1;

export const NotificationStateSync = ({
  fetchState = fetchNotificationState,
}: {
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

  const refresh = React.useEffectEvent(async () => {
    if (userId === null) return;
    const latest = await fetchState().catch(() => null);
    if (latest && notificationStateStore.apply(userId, latest)) {
      coalescerRef.current?.schedule();
    }
  });

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
    if (readyState === SOCKET_OPEN) void refresh();
  }, [readyState]);

  React.useEffect(() => {
    if (readyState === SOCKET_OPEN || userId === null) return;

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_WITHOUT_SOCKET_MS);

    return () => clearInterval(timer);
  }, [readyState, userId]);

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
  }, []);

  return null;
};
