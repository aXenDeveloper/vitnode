import type { ChatLiveServerMessage } from "@vitnode/api/lib/chat/live/protocol";
import type { ChatState } from "@vitnode/api/lib/chat/types";

import { useQueryClient } from "@tanstack/react-query";
import { CHAT_LIMITS } from "@vitnode/api/lib/chat/const";
import { chatLiveChannel } from "@vitnode/api/lib/chat/live/protocol";
import React from "react";

import { useVitNodeWebSocket } from "@/ws/use-websocket";

import { useSessionQuery } from "../auth/session-query";
import {
  chatDetailsKey,
  chatListRoot,
  chatMessagesKey,
  chatStateKey,
  invalidateChatOverview,
  patchCachedMessage,
  upsertCachedMessage,
} from "./query";

const SOCKET_OPEN = 1;
const POLL_STATE_MS = 60_000;

type TypingListener = () => void;

/** Who is typing in which chat, expiring on its own. Browser-only. */
const createTypingStore = () => {
  const typing = new Map<number, Map<number, number>>();
  const listeners = new Set<TypingListener>();
  const snapshots = new Map<number, number[]>();
  const emit = () => {
    snapshots.clear();
    for (const listener of listeners) listener();
  };

  return {
    add(chatId: number, userId: number) {
      const chat = typing.get(chatId) ?? new Map<number, number>();
      chat.set(userId, Date.now() + CHAT_LIMITS.typingExpireSeconds * 1000);
      typing.set(chatId, chat);
      emit();
      setTimeout(
        () => {
          const expires = typing.get(chatId)?.get(userId);
          if (expires !== undefined && expires <= Date.now()) {
            typing.get(chatId)?.delete(userId);
            emit();
          }
        },
        CHAT_LIMITS.typingExpireSeconds * 1000 + 50,
      );
    },
    clear(chatId: number, userId: number) {
      if (typing.get(chatId)?.delete(userId)) emit();
    },
    get(chatId: number): number[] {
      const cached = snapshots.get(chatId);
      if (cached) return cached;
      const now = Date.now();
      const ids = [...(typing.get(chatId)?.entries() ?? [])]
        .filter(([, expires]) => expires > now)
        .map(([id]) => id);
      snapshots.set(chatId, ids);

      return ids;
    },
    subscribe(listener: TypingListener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
};

export const chatTypingStore = createTypingStore();

const NO_ONE: number[] = [];

/** Ids of the members typing in `chatId` right now. */
export const useChatTyping = (chatId: number): number[] =>
  React.useSyncExternalStore(
    chatTypingStore.subscribe,
    () => chatTypingStore.get(chatId),
    () => NO_ONE,
  );

/** Sends "typing" signals for one chat, at most every few seconds. */
export const useChatTypingSender = (chatId: number) => {
  const { readyState, send } = useVitNodeWebSocket(chatLiveChannel);
  const lastSent = React.useRef(0);

  return React.useCallback(() => {
    if (readyState !== SOCKET_OPEN) return;
    const now = Date.now();
    if (now - lastSent.current < CHAT_LIMITS.typingThrottleSeconds * 1000) {
      return;
    }
    lastSent.current = now;
    send({ chatId, type: "typing" });
  }, [chatId, readyState, send]);
};

/**
 * Applies the chat channel's pushes to the query cache: new, edited and
 * deleted messages, reactions, read state and the unread counts. Without a
 * socket it polls the counts instead. Rendered once by `RealtimeListeners`.
 */
export const ChatLiveSync = () => {
  const queryClient = useQueryClient();
  const { data: session } = useSessionQuery();
  const userId = session?.user?.id ?? null;
  const userIdRef = React.useRef(userId);
  React.useEffect(() => {
    userIdRef.current = userId;
  });

  const { connectionId, readyState } = useVitNodeWebSocket(chatLiveChannel, {
    onMessage: (message: ChatLiveServerMessage) => {
      const current = userIdRef.current;
      if (current === null) return;
      switch (message.type) {
        case "chat":
          void invalidateChatOverview(queryClient, current, message.chatId);
          void queryClient.invalidateQueries({
            queryKey: chatMessagesKey(current, message.chatId),
          });
          break;
        case "message":
          chatTypingStore.clear(
            message.chatId,
            message.message.author?.id ?? 0,
          );
          upsertCachedMessage(queryClient, current, message.message);
          void queryClient.invalidateQueries({
            queryKey: chatListRoot(current),
          });
          break;
        case "message_deleted":
          patchCachedMessage(
            queryClient,
            current,
            message.chatId,
            message.messageId,
            item => ({ ...item, body: null, deleted: true, reactions: [] }),
          );
          break;
        case "message_updated":
          upsertCachedMessage(queryClient, current, message.message);
          break;
        case "reactions":
          patchCachedMessage(
            queryClient,
            current,
            message.chatId,
            message.messageId,
            item => ({ ...item, reactions: message.reactions }),
          );
          break;
        case "read":
          void queryClient.invalidateQueries({
            queryKey: chatDetailsKey(current, message.chatId),
          });
          break;
        case "state":
          queryClient.setQueryData<ChatState>(chatStateKey(current), state =>
            state
              ? {
                  ...state,
                  requests: message.requests,
                  unreadChats: message.unreadChats,
                }
              : state,
          );
          void queryClient.invalidateQueries({
            queryKey: chatListRoot(current),
          });
          break;
        case "typing":
          chatTypingStore.add(message.chatId, message.userId);
          break;
      }
    },
  });

  // A reconnect may have missed pushes: reload what is on screen.
  React.useEffect(() => {
    if (connectionId === null || userId === null) return;
    void queryClient.invalidateQueries({ queryKey: ["chat", "user", userId] });
  }, [connectionId, queryClient, userId]);

  React.useEffect(() => {
    if (readyState === SOCKET_OPEN || userId === null) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void queryClient.invalidateQueries({ queryKey: chatStateKey(userId) });
      }
    }, POLL_STATE_MS);

    return () => {
      clearInterval(timer);
    };
  }, [queryClient, readyState, userId]);

  return null;
};
