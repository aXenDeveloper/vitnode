import type { QueryClient } from "@tanstack/react-query";
import type { ContentTarget } from "@vitnode/api/content/target";
import type {
  ReactionsLiveClientMessage,
  ReactionsLiveServerMessage,
} from "@vitnode/api/lib/reactions/live/protocol";

import { useQueryClient } from "@tanstack/react-query";
import {
  REACTIONS_LIVE_MAX_IDS_PER_MESSAGE,
  reactionsLiveChannel,
  reactionsLiveRoom,
} from "@vitnode/api/lib/reactions/live/protocol";
import React from "react";

import { useOptionalVitNodeWebSocketContext } from "@/ws/provider";

import {
  applyLiveCounts,
  isReactionSummaryKeyOf,
  REACTIONS_QUERY_ROOT,
} from "./query";

type SocketContext = NonNullable<
  ReturnType<typeof useOptionalVitNodeWebSocketContext>
>;

interface Following {
  count: number;
  target: ContentTarget;
}

/**
 * Who this tab follows on one connection. Joins and leaves of every bar on
 * the page are gathered for a tick and sent as one message per target type.
 */
const createLiveFollower = (
  send: SocketContext["send"],
  queryClient: QueryClient,
) => {
  const clientId = `r-${Math.random().toString(36).slice(2, 12)}`;
  const following = new Map<string, Following>();
  const joins = new Map<string, Set<string>>();
  const leaves = new Map<string, Set<string>>();
  let scheduled = false;
  let open = false;

  const keyOf = (target: ContentTarget) =>
    `${target.pluginId}\u0000${target.type}`;

  const flush = () => {
    scheduled = false;
    if (!open) {
      joins.clear();
      leaves.clear();

      return;
    }
    for (const [type, pending] of [
      ["join", joins],
      ["leave", leaves],
    ] as const) {
      for (const [key, ids] of pending) {
        const [pluginId, targetType] = key.split("\u0000");
        const list = [...ids];
        for (
          let index = 0;
          index < list.length;
          index += REACTIONS_LIVE_MAX_IDS_PER_MESSAGE
        ) {
          send(reactionsLiveChannel.id, {
            clientId,
            ids: list.slice(index, index + REACTIONS_LIVE_MAX_IDS_PER_MESSAGE),
            pluginId,
            targetType,
            type,
          } satisfies ReactionsLiveClientMessage);
        }
      }
      pending.clear();
    }
  };

  const queue = (
    pending: Map<string, Set<string>>,
    target: ContentTarget,
  ): void => {
    const key = keyOf(target);
    pending.set(key, (pending.get(key) ?? new Set()).add(target.id));
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(flush);
    }
  };

  return {
    acquire: (target: ContentTarget) => {
      const room = reactionsLiveRoom(target);
      const current = following.get(room);
      if (current) {
        current.count++;

        return;
      }
      following.set(room, { count: 1, target });
      leaves.get(keyOf(target))?.delete(target.id);
      queue(joins, target);
    },
    receive: (message: ReactionsLiveServerMessage) => {
      if (message.type === "counts") {
        const entry = following.get(message.room);
        if (entry) applyLiveCounts(queryClient, entry.target, message);

        return;
      }
      if (message.type === "revoked") {
        const entry = following.get(message.room);
        if (!entry) return;
        void queryClient.invalidateQueries({
          predicate: query =>
            isReactionSummaryKeyOf(query.queryKey, entry.target),
        });
      }
    },
    release: (target: ContentTarget) => {
      const room = reactionsLiveRoom(target);
      const current = following.get(room);
      if (!current) return;
      current.count--;
      if (current.count > 0) return;
      following.delete(room);
      joins.get(keyOf(target))?.delete(target.id);
      queue(leaves, target);
    },
    /**
     * The connection (re)opened: the server forgot this tab, and nothing sent
     * meanwhile was replayed. Join everything again and read it once.
     */
    reopened: () => {
      open = true;
      for (const { target } of following.values()) queue(joins, target);
      if (following.size > 0) {
        void queryClient.invalidateQueries({
          queryKey: [...REACTIONS_QUERY_ROOT, "summary"],
        });
      }
    },
    closed: () => {
      open = false;
    },
  };
};

type LiveFollower = ReturnType<typeof createLiveFollower>;

const followers = new WeakMap<SocketContext["subscribe"], LiveFollower>();

/**
 * Follows `target`'s counts over the shared WebSocket while `ref`'s element is
 * on screen (with a 200 px margin), writing each new count into the query
 * cache. Does nothing without a WebSocket or when `enabled` is `false`.
 */
export const useReactionsLive = (
  target: ContentTarget,
  ref: React.RefObject<HTMLElement | null>,
  enabled: boolean,
): void => {
  const socket = useOptionalVitNodeWebSocketContext();
  const queryClient = useQueryClient();
  const follower = React.useMemo(() => {
    if (!socket) return null;
    let existing = followers.get(socket.subscribe);
    if (!existing) {
      existing = createLiveFollower(socket.send, queryClient);
      followers.set(socket.subscribe, existing);
      const created = existing;
      socket.subscribe(reactionsLiveChannel.id, data => {
        // Only the server writes to this channel, always in its protocol.
        created.receive(data as ReactionsLiveServerMessage);
      });
    }

    return existing;
  }, [socket, queryClient]);

  const connectionId = socket?.connectionId ?? null;
  React.useEffect(() => {
    if (!follower) return;
    if (connectionId) follower.reopened();
    else follower.closed();
  }, [follower, connectionId]);

  const { id, pluginId, type } = target;
  React.useEffect(() => {
    const element = ref.current;
    if (!follower || !enabled || !element) return;
    const current = { id, pluginId, type };
    let visible = false;

    const observer = new IntersectionObserver(
      entries => {
        const isVisible = entries.some(entry => entry.isIntersecting);
        if (isVisible === visible) return;
        visible = isVisible;
        if (visible) follower.acquire(current);
        else follower.release(current);
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      if (visible) follower.release(current);
    };
  }, [follower, enabled, id, pluginId, type, ref]);
};
