import { z } from "zod";

import type { ContentLiveServerMessage } from "@/content/live/protocol";
import type { RealtimeRuntime } from "@/ws/runtime";

import { buildWebSocket } from "@/api/lib/websocket";
import { contentAnyIdSchema } from "@/content/ids";
import {
  contentLiveChannel,
  contentLiveDocRoom,
} from "@/content/live/protocol";
import {
  currentRealtimeRuntime,
  registerRealtimeHostCommand,
} from "@/ws/runtime";

import type { ContentLiveServer } from "./server";

import {
  createContentDocumentStore,
  patchStoredContentDocuments,
} from "./document-store";
import { markLiveDocumentFileDeleted } from "./file-references";
import { onContentLiveFileDeleted, onContentLiveReset } from "./hooks";
import { encodeContentLiveBytes } from "./messages";
import { CONTENT_LIVE_PRESENCE_TOPIC, createContentLiveServer } from "./server";

const CONTENT_LIVE_SERVICE = "vitnode.content.live";
const RESET_COMMAND = "vitnode.content.live.reset";
const FILE_DELETED_COMMAND = "vitnode.content.live.file-deleted";

/**
 * The Content Engine live server of the runtime that owns the sockets - one
 * per Node/Bun process, one per Cloudflare hub - wired to that runtime's
 * registry, delivery and cross-instance messages on first use.
 */
export const contentLiveServerOf = (
  runtime: RealtimeRuntime,
): ContentLiveServer =>
  runtime.service(CONTENT_LIVE_SERVICE, owner => {
    const { registry } = owner;
    if (!registry) {
      throw new Error(
        `[VitNode] The Content Engine live server needs a socket host; the ${owner.kind} runtime owns no sockets.`,
      );
    }
    const server = createContentLiveServer({
      bind: owner.bind,
      publish: snapshot => {
        owner.publishToInstances(CONTENT_LIVE_PRESENCE_TOPIC, snapshot);
      },
      realtime: owner.realtime,
      registry,
    });
    registry.onConnectionClose(server.onConnectionClose);
    owner.onRemoteRoomMessage(server.onRemoteRoomMessage);
    owner.onInstanceMessage(server.onInstanceMessage);

    return server;
  });

const roomSchema = z.object({
  contentTypeId: z.string().min(1).max(200),
  itemId: contentAnyIdSchema,
});

// Loaded documents live with the sockets, so a reset or a deleted file that an
// HTTP request handles is applied where they are: in-process on Node/Bun, in
// the hub on Cloudflare.
registerRealtimeHostCommand(RESET_COMMAND, (runtime, payload) => {
  const room = roomSchema.parse(payload);
  contentLiveServerOf(runtime).documents.resetRecord(room);

  return null;
});

registerRealtimeHostCommand(FILE_DELETED_COMMAND, (runtime, payload) => {
  const { fileId } = z.object({ fileId: z.number().int() }).parse(payload);

  return contentLiveServerOf(runtime).patchLoadedFileDeleted(fileId);
});

onContentLiveReset(async ({ c, room }) => {
  // The loaded copy goes first, so it cannot persist itself over the deletion.
  await currentRealtimeRuntime().runOnHost(RESET_COMMAND, room);
  await createContentDocumentStore(c).deleteRecord(room);
});

onContentLiveFileDeleted(async ({ c, fileId }) => {
  const runtime = currentRealtimeRuntime();
  const loaded = new Set(
    z
      .array(z.string())
      .nullable()
      .parse(await runtime.runOnHost(FILE_DELETED_COMMAND, { fileId })) ?? [],
  );
  const stored = await patchStoredContentDocuments(c, {
    mutate: doc => markLiveDocumentFileDeleted(doc, fileId),
    skip: ref => loaded.has(contentLiveDocRoom(ref)),
  });
  for (const { ref, update } of stored) {
    runtime.realtime.toRoom(contentLiveDocRoom(ref), contentLiveChannel, {
      doc: ref,
      from: null,
      type: "doc:update",
      update: encodeContentLiveBytes(update),
    } satisfies ContentLiveServerMessage);
  }
});

export const contentLiveWebSocket = buildWebSocket({
  description:
    "Content Engine live editing: presence and collaborative rich text documents.",
  id: "live",
  onMessage: async ({ c, data, ws }) => {
    await contentLiveServerOf(currentRealtimeRuntime()).handle({ c, data, ws });
  },
});
