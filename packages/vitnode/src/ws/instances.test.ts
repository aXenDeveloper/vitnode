import type { WSContext } from "hono/ws";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { CacheClient } from "@/api/lib/cache";

import {
  getRealtimeInstanceId,
  initRealtimePubSub,
  onInstanceMessage,
  onRemoteRoomMessage,
  publishToInstances,
  wsRegistry,
} from "./registry";

/** A pub/sub client whose subscriber callback the test can call itself. */
const bus = () => {
  const published: string[] = [];
  let deliver: ((raw: string) => void) | undefined;

  const client = {
    duplicate: () => {
      const subscriber = {
        connect: async () => Promise.resolve(),
        on: () => subscriber,
        subscribe: async (
          _channel: string,
          listener: (raw: string) => void,
        ) => {
          deliver = listener;

          return Promise.resolve();
        },
      };

      return subscriber;
    },
    publish: async (_channel: string, raw: string) => {
      published.push(raw);

      return Promise.resolve(1);
    },
  };

  return {
    client: client as unknown as CacheClient,
    /** Hand a message to this instance as if another instance published it. */
    fromOtherInstance: (message: Record<string, unknown>) => {
      deliver?.(JSON.stringify({ origin: "other-instance", ...message }));
    },
    published: () =>
      published.map(raw => JSON.parse(raw) as Record<string, unknown>),
  };
};

const pubsub = bus();
initRealtimePubSub(pubsub.client);
await Promise.resolve();
await Promise.resolve();

const sockets: WSContext[] = [];

const socket = () => {
  const sent: unknown[] = [];
  const ws = {
    send: (raw: string) => {
      sent.push(JSON.parse(raw));
    },
  } as unknown as WSContext;
  wsRegistry.add(ws, 1);
  sockets.push(ws);

  return { sent, ws };
};

afterEach(() => {
  sockets.splice(0).forEach(ws => wsRegistry.remove(ws));
});

describe("instance messages", () => {
  it("are published with this instance as the origin", () => {
    publishToInstances("presence", { n: 1 });

    expect(pubsub.published().at(-1)).toEqual({
      data: { n: 1 },
      id: "presence",
      origin: getRealtimeInstanceId(),
      type: "instance",
    });
  });

  it("reach instance listeners of the other instances, never a socket", () => {
    const member = socket();
    wsRegistry.join(member.ws, "room", "tab-a");
    const listener = vi.fn();
    const rooms = vi.fn();
    const stop = onInstanceMessage(listener);
    const stopRooms = onRemoteRoomMessage(rooms);

    pubsub.fromOtherInstance({
      data: { n: 2 },
      id: "presence",
      type: "instance",
    });
    stop();
    stopRooms();

    expect(listener).toHaveBeenCalledWith({
      data: { n: 2 },
      origin: "other-instance",
      topic: "presence",
    });
    expect(rooms).not.toHaveBeenCalled();
    expect(member.sent).toEqual([]);
  });

  it("are ignored when they come back from this instance", () => {
    const listener = vi.fn();
    const stop = onInstanceMessage(listener);

    pubsub.fromOtherInstance({
      data: {},
      id: "presence",
      origin: getRealtimeInstanceId(),
      type: "instance",
    });
    stop();

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("room messages from another instance", () => {
  it("are observed first, then delivered to the room's local members", () => {
    const member = socket();
    const outside = socket();
    wsRegistry.join(member.ws, "content:test.note:1", "tab-a");
    const observed: unknown[] = [];
    const stop = onRemoteRoomMessage((room, id, data) => {
      observed.push({ data, id, room, sentBefore: member.sent.length });
    });

    pubsub.fromOtherInstance({
      data: { type: "reset" },
      id: "live",
      room: "content:test.note:1",
      type: "room",
    });
    stop();

    expect(observed).toEqual([
      {
        data: { type: "reset" },
        id: "live",
        room: "content:test.note:1",
        sentBefore: 0,
      },
    ]);
    expect(member.sent).toEqual([{ data: { type: "reset" }, id: "live" }]);
    expect(outside.sent).toEqual([]);
  });
});
