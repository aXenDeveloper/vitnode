import { z } from "zod";

import type { RealtimeRuntime } from "@/ws/runtime";

import { buildWebSocket } from "@/api/lib/websocket";
import {
  CONTENT_REFRESH_ROOM_PREFIX,
  contentRefreshChannel,
} from "@/content/live/refresh";
import { currentRealtimeRuntime, currentRealtimeScope } from "@/ws/runtime";

import type { ContentRefreshServer } from "./server";

import { onContentRefreshRootChanged } from "./publish";
import { createContentRefreshServer } from "./server";

const CONTENT_REFRESH_SERVICE = "vitnode.content.refresh";

const threadChangedMessage = z.object({
  signal: z.object({ kind: z.literal("thread") }),
});

/**
 * The live refresh server of the runtime that owns the sockets - one per
 * Node/Bun process, one per Cloudflare hub. A root that changed somewhere else
 * (another instance, or an HTTP request delivering to the hub) has its room's
 * members here checked again too.
 */
export const contentRefreshServerOf = (
  runtime: RealtimeRuntime,
): ContentRefreshServer =>
  runtime.service(CONTENT_REFRESH_SERVICE, owner => {
    const { registry } = owner;
    if (!registry) {
      throw new Error(
        `[VitNode] Content refresh needs a socket host; the ${owner.kind} runtime owns no sockets.`,
      );
    }
    const server = createContentRefreshServer({ bind: owner.bind, registry });
    registry.onConnectionClose(server.onConnectionClose);
    owner.onRemoteRoomMessage((room, id, data) => {
      if (
        id === contentRefreshChannel.id &&
        room.startsWith(CONTENT_REFRESH_ROOM_PREFIX) &&
        threadChangedMessage.safeParse(data).success
      ) {
        const task = server.revalidateRoom(room).catch((error: unknown) => {
          // oxlint-disable-next-line no-console
          console.error("Content refresh revalidation error:", error);
        });
        currentRealtimeScope()?.keepAlive?.(task);
      }
    });

    return server;
  });

// A root changed in this request: the members of its room re-checked where
// they are. Without sockets here (Cloudflare HTTP), the hub does it when the
// room's signal arrives.
onContentRefreshRootChanged(async room => {
  const runtime = currentRealtimeRuntime();
  if (!runtime.registry) return;
  await contentRefreshServerOf(runtime).revalidateRoom(room);
});

export const contentRefreshWebSocket = buildWebSocket({
  description:
    "Content Engine live refresh: authorized subscriptions to AdminCP lists and public threads, answered with small change signals.",
  id: "refresh",
  onMessage: async params => {
    await contentRefreshServerOf(currentRealtimeRuntime()).handle(params);
  },
});
