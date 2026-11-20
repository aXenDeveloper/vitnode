import { z } from "zod";

import type { RealtimeRuntime } from "@/ws/runtime";

import { buildWebSocket } from "@/lib/websocket";
import { currentRealtimeRuntime } from "@/ws/runtime";

import type { ReactionsLiveServer } from "./server";

import { REACTIONS_LIVE_ROOM_PREFIX, reactionsLiveChannel } from "./protocol";
import { onReactionRoomRevoked } from "./publish";
import { createReactionsLiveServer } from "./server";

const REACTIONS_LIVE_SERVICE = "vitnode.reactions.live";

const revokedMessage = z.object({ type: z.literal("revoked") });

/**
 * The live reactions server of the runtime that owns the sockets - one per
 * Node/Bun process, one per Cloudflare hub. A target deleted somewhere else
 * has its room's members here dropped too.
 */
export const reactionsLiveServerOf = (
  runtime: RealtimeRuntime,
): ReactionsLiveServer =>
  runtime.service(REACTIONS_LIVE_SERVICE, owner => {
    const { registry } = owner;
    if (!registry) {
      throw new Error(
        `[VitNode] Live reactions need a socket host; the ${owner.kind} runtime owns no sockets.`,
      );
    }
    const server = createReactionsLiveServer({ bind: owner.bind, registry });
    registry.onConnectionClose(server.onConnectionClose);
    owner.onRemoteRoomMessage((room, id, data) => {
      if (
        id === reactionsLiveChannel.id &&
        room.startsWith(REACTIONS_LIVE_ROOM_PREFIX) &&
        revokedMessage.safeParse(data).success
      ) {
        server.revokeRoom(room);
      }
    });

    return server;
  });

onReactionRoomRevoked(room => {
  const runtime = currentRealtimeRuntime();
  if (!runtime.registry) return;
  reactionsLiveServerOf(runtime).revokeRoom(room);
});

export const reactionsLiveWebSocket = buildWebSocket({
  description:
    "Live reaction counts: authorized subscriptions to the targets on screen, answered with each target's new counts after every reaction.",
  id: "live",
  onMessage: async params => {
    await reactionsLiveServerOf(currentRealtimeRuntime()).handle(params);
  },
});
