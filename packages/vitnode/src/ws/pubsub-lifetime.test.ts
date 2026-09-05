import { describe, expect, it } from "vitest";

import type { CacheClient } from "@/api/lib/cache";

import { initRealtimePubSub, isRealtimePubSubEnabled } from "./registry";

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

  it("keeps the established bridge when a later boot has no client", () => {
    initRealtimePubSub(null);

    expect(isRealtimePubSubEnabled()).toBe(true);
  });
});
