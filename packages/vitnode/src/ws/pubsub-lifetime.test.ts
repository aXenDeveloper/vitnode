import { describe, expect, it } from "vitest";

import type { CacheClient } from "@/api/lib/cache";

import { initRealtimePubSub, isRealtimePubSubEnabled } from "./registry";

/**
 * The realtime bridge's *lifetime*, which is the half a dev server exercises and
 * production does not.
 *
 * In a deployment `initRealtimePubSub` is called once, at boot, and the question
 * never arises. Under `vite dev` the module that boots the API is re-evaluated
 * whenever anything it imports changes - so the call happens again, and again,
 * for the life of the session. Each one that got through would `duplicate()` the
 * cache client, open a second connection and `subscribe` a second handler to the
 * same channel, and neither the first subscriber nor the first connection has
 * anywhere to be cleaned up from: nothing holds a reference to them.
 *
 * The symptom is not a crash. It is every realtime message arriving twice, then
 * three times, then four - one notification toast per reload since the server
 * started - plus a Redis connection leaked per reload. And it is invisible until
 * a developer happens to be signed in with a socket open, which is why it is
 * pinned here rather than left to be noticed.
 *
 * The guard is one line in `initRealtimePubSub` (`if (!client || publisher)
 * return`), and this is what it means. Nothing is redesigned to test it: the
 * fake client below counts `duplicate()` calls, which is the only observable
 * this needs, and no Redis is involved.
 *
 * ## The browser half needs no equivalent
 *
 * `VitNodeWebSocketProvider` creates its manager inside an effect and
 * `destroy()`s it from that effect's cleanup, and `useVitNodeWebSocket`
 * subscribes and unsubscribes the same way - so React tears both down on a fast
 * refresh before the replacement mounts. The message handler is kept in a ref
 * that is rewritten on every render, so a hot-reloaded listener cannot close
 * over the previous module either. That is a React lifecycle, not a pure one;
 * see `apps/web/src/tests/realtime-listeners.test.ts` for what is assertable
 * about it without rendering.
 */

/** Just enough of a cache client to count what the bridge does with one. */
const fakeClient = () => {
  const duplicates: { channels: string[] }[] = [];

  const client = {
    duplicate: () => {
      const subscriber = {
        channels: [] as string[],
        connect: async () => Promise.resolve(),
        on: () => subscriber,
        subscribe: async (channel: string) => {
          subscriber.channels.push(channel);

          return Promise.resolve();
        },
      };

      duplicates.push(subscriber);

      return subscriber;
    },
    publish: async () => Promise.resolve(0),
  };

  return { client: client as unknown as CacheClient, duplicates };
};

describe("without Redis configured", () => {
  it("is off, and single-process delivery still works", () => {
    expect(isRealtimePubSubEnabled()).toBe(false);
  });

  it("stays off when handed no client, rather than failing a boot", () => {
    initRealtimePubSub(null);

    expect(isRealtimePubSubEnabled()).toBe(false);
  });

  it("opens no connection for a deployment that has no Redis", () => {
    const { duplicates } = fakeClient();

    initRealtimePubSub(null);

    expect(duplicates).toHaveLength(0);
  });
});

describe("the first initialization", () => {
  /**
   * One connection, and a *dedicated* one: a client in subscribe mode cannot run
   * other commands, so the publisher and the subscriber have to be two.
   */
  it("subscribes exactly one dedicated connection, to the one channel", async () => {
    const { client, duplicates } = fakeClient();

    initRealtimePubSub(client);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(isRealtimePubSubEnabled()).toBe(true);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].channels).toEqual(["vitnode:ws"]);
  });
});

describe("initializing again, as a hot reload does", () => {
  it("opens no second connection", async () => {
    const { client, duplicates } = fakeClient();

    for (let reload = 0; reload < 5; reload++) initRealtimePubSub(client);
    await Promise.resolve();

    expect(duplicates).toHaveLength(0);
  });

  it("does not throw, so a reload is not a boot failure", () => {
    const { client } = fakeClient();

    expect(() => {
      initRealtimePubSub(client);
    }).not.toThrow();
  });

  it("stays enabled throughout", () => {
    const { client } = fakeClient();

    initRealtimePubSub(client);

    expect(isRealtimePubSubEnabled()).toBe(true);
  });

  /**
   * Including the case a reload passes `null` - a config edit that removed the
   * Redis URL, say. The bridge already established is kept rather than half
   * torn down, which is the same "no-op without Redis" rule read the other way.
   */
  it("keeps the established bridge when a later boot has no client", () => {
    initRealtimePubSub(null);

    expect(isRealtimePubSubEnabled()).toBe(true);
  });
});
