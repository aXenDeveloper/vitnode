import type { WSContext } from "hono/ws";

import { describe, expect, it } from "vitest";

import type { CacheClient } from "@/api/lib/cache";

import { contentRefreshRoom } from "@/content/live/refresh";
import {
  BOARD,
  createPolicyWorld,
  policyReplies,
  policyTopicRow,
  USER,
} from "@/tests/content-policies";
import {
  initRealtimePubSub,
  markWebSocketEnabled,
  wsRegistry,
} from "@/ws/registry";

/** One Redis channel between this instance and another one. */
const bus = () => {
  const published: string[] = [];
  let deliver: ((raw: string) => void) | undefined;
  const client = {
    duplicate: () => {
      const subscriber = {
        connect: async () => await Promise.resolve(),
        on: () => subscriber,
        subscribe: async (
          _channel: string,
          listener: (raw: string) => void,
        ) => {
          deliver = listener;

          return await Promise.resolve();
        },
      };

      return subscriber;
    },
    publish: async (_channel: string, raw: string) => {
      published.push(raw);

      return await Promise.resolve(1);
    },
  };

  return {
    client: client as unknown as CacheClient,
    /** Hands a message to this process as if another instance sent it. */
    fromOtherInstance: (message: Record<string, unknown>) => {
      deliver?.(JSON.stringify({ ...message, origin: "other-instance" }));
    },
    published: () =>
      published.map(raw => JSON.parse(raw) as Record<string, unknown>),
  };
};

describe("content refresh across instances", () => {
  it("relays a root change to a thread followed only on another instance", async () => {
    const pubsub = bus();
    initRealtimePubSub(pubsub.client);
    markWebSocketEnabled();
    await Promise.resolve();
    const room = contentRefreshRoom({
      contentTypeId: policyReplies.definition.id,
      kind: "thread",
      rootId: 10,
    });
    const { send } = await createPolicyWorld({
      topics: [policyTopicRow(10, BOARD.OPEN)],
    });

    await send("POST", "/topics/10/hide", { body: {}, user: USER.ROOT });

    const message = pubsub.published().find(entry => entry.room === room);
    expect(message).toMatchObject({
      data: { room, signal: { kind: "thread" }, type: "changed" },
      type: "room",
    });

    const received: unknown[] = [];
    const ws = {
      send: (raw: string) => {
        received.push((JSON.parse(raw) as { data: unknown }).data);
      },
    } as unknown as WSContext;
    wsRegistry.add(ws, null);
    wsRegistry.join(ws, room, "tab");
    pubsub.fromOtherInstance(message ?? {});
    wsRegistry.remove(ws);

    expect(received).toStrictEqual([
      { room, signal: { kind: "thread" }, type: "changed" },
    ]);
  });
});
