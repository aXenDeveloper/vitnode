import type { WSContext } from "hono/ws";

import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CacheClient } from "@/api/lib/cache";
import type { EnvVitNode } from "@/api/middlewares/global.middleware";

type SubscriberEvent = "end" | "error" | "ready" | "reconnecting";

/**
 * A Redis client whose subscriber connection the test drives: `subscribe`
 * answers from `subscribeResults` in turn (pending forever once they run out)
 * and `emit` fires what node-redis would.
 */
const fakeRedis = ({
  connect = async () => await Promise.resolve(),
  subscribeResults = [] as (() => Promise<void>)[],
} = {}) => {
  const listeners = new Map<SubscriberEvent, (() => void)[]>();
  const published: Promise<number>[] = [];
  const subscribe = vi.fn(
    async () =>
      await (subscribeResults.shift() ?? (async () => new Promise(() => {})))(),
  );

  const subscriber = {
    connect,
    on: (event: SubscriberEvent, listener: () => void) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);

      return subscriber;
    },
    subscribe,
  };

  const client = {
    duplicate: () => subscriber,
    publish: async () => {
      const task = Promise.resolve(1);
      published.push(task);

      return await task;
    },
  };

  return {
    client: client as unknown as CacheClient,
    emit: (event: SubscriberEvent) => {
      listeners.get(event)?.forEach(listener => {
        listener();
      });
    },
    subscribe,
  };
};

/** `initRealtimePubSub` runs once per module instance, so each test gets its own. */
const freshRegistry = async () => {
  vi.resetModules();

  return await import("./registry");
};

const flush = async () => {
  for (let tick = 0; tick < 5; tick++) await Promise.resolve();
};

const settled = <T>(promise: Promise<T>) => {
  const state: { value?: T } = {};
  void promise.then(value => {
    state.value = value;
  });

  return state;
};

afterEach(() => {
  vi.useRealTimers();
});

describe("waitForRealtimePubSub", () => {
  it("is ready at once without Redis", async () => {
    const { waitForRealtimePubSub } = await freshRegistry();

    await expect(waitForRealtimePubSub()).resolves.toBe(true);
  });

  it("waits until this instance is subscribed", async () => {
    let subscribed!: () => void;
    const redis = fakeRedis({
      subscribeResults: [
        async () =>
          await new Promise<void>(resolve => {
            subscribed = resolve;
          }),
      ],
    });
    const { initRealtimePubSub, waitForRealtimePubSub } = await freshRegistry();
    initRealtimePubSub(redis.client);

    const ready = settled(waitForRealtimePubSub());
    await flush();
    expect(ready.value).toBeUndefined();

    subscribed();
    await flush();

    expect(ready.value).toBe(true);
  });

  it("gives up after the timeout when the subscription never lands", async () => {
    vi.useFakeTimers();
    const redis = fakeRedis();
    const { initRealtimePubSub, waitForRealtimePubSub } = await freshRegistry();
    initRealtimePubSub(redis.client);

    const ready = waitForRealtimePubSub(1000);
    await vi.advanceTimersByTimeAsync(1000);

    await expect(ready).resolves.toBe(false);
  });
});

describe("recovering the subscription", () => {
  it.each([
    [
      "the first connect fails",
      {
        connect: async () => await Promise.reject(new Error("ECONNREFUSED")),
        subscribeResults: [async () => await Promise.resolve()],
      },
    ],
    [
      "the first subscribe fails",
      {
        subscribeResults: [
          async () => await Promise.reject(new Error("LOADING")),
          async () => await Promise.resolve(),
        ],
      },
    ],
  ])("subscribes on the next ready when %s", async (_, options) => {
    const redis = fakeRedis(options);
    const { initRealtimePubSub, waitForRealtimePubSub } = await freshRegistry();
    initRealtimePubSub(redis.client);
    await flush();
    const ready = settled(waitForRealtimePubSub());
    await flush();
    expect(ready.value).toBeUndefined();

    redis.emit("ready");
    await flush();

    expect(ready.value).toBe(true);
  });

  it.each(["reconnecting", "end"] as const)(
    "holds handshakes after %s and reconnects local sockets once ready again",
    async event => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const redis = fakeRedis({
        subscribeResults: [async () => await Promise.resolve()],
      });
      const { initRealtimePubSub, waitForRealtimePubSub, wsRegistry } =
        await freshRegistry();
      initRealtimePubSub(redis.client);
      await flush();
      const close = vi.fn();
      wsRegistry.add({ close, send: vi.fn() } as unknown as WSContext, null);

      redis.emit("ready");
      expect(close).not.toHaveBeenCalled();

      redis.emit(event);
      const ready = settled(waitForRealtimePubSub());
      await flush();
      expect(ready.value).toBeUndefined();

      redis.emit("ready");
      await flush();

      expect(ready.value).toBe(true);
      expect(close).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalledWith(1012, "Realtime resync");
      expect(redis.subscribe).toHaveBeenCalledTimes(1);
    },
  );
});

describe("the WebSocket handshake", () => {
  it("answers 503 while this instance is not subscribed", async () => {
    vi.useFakeTimers();
    const { initRealtimePubSub } = await freshRegistry();
    const { handleVitNodeWebSocket } = await import("./handle");
    const { createVitNodeWebSocketHooks, upgradeWebSocket } =
      await import("./crossws.server");
    initRealtimePubSub(fakeRedis().client);
    const app = new Hono<EnvVitNode>().basePath("/api");
    app.get("/ws", upgradeWebSocket(handleVitNodeWebSocket()));
    const hooks = createVitNodeWebSocketHooks({
      api: async request => await app.fetch(request),
    });

    const rejection = hooks
      .upgrade(new Request("https://site.example/api/ws"))
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(5000);

    const response = await rejection;
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(503);
  });
});

describe("runWithRealtimeKeepAlive", () => {
  it("hands over every publish started inside it, and none outside", async () => {
    const redis = fakeRedis({
      subscribeResults: [async () => await Promise.resolve()],
    });
    const {
      initRealtimePubSub,
      publishToInstances,
      realtime,
      runWithRealtimeKeepAlive,
    } = await freshRegistry();
    initRealtimePubSub(redis.client);
    const keepAlive = vi.fn();
    const channel = { id: "test" };

    await runWithRealtimeKeepAlive(keepAlive, async () => {
      realtime.broadcast(channel, 1);
      await Promise.resolve();
      realtime.sendToUser(1, channel, 2);
      publishToInstances("presence", 3);
    });
    realtime.broadcast(channel, 4);

    expect(keepAlive).toHaveBeenCalledTimes(3);
    for (const [task] of keepAlive.mock.calls) {
      expect(task).toBeInstanceOf(Promise);
    }
  });
});
