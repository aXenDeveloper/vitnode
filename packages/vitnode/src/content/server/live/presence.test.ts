// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { ContentLiveMember } from "@/content/live/protocol";

import { CONTENT_LIVE_MEMBER_TIMEOUT_MS } from "@/content/live/protocol";
import { createLiveHarness, ofType } from "@/tests/content-live";

import type { ContentLivePresenceSnapshot } from "./presence";

import { CONTENT_LIVE_PRESENCE_TOPIC } from "./server";

const room = { contentTypeId: "test.note", itemId: 1 };

const harnesses: ReturnType<typeof createLiveHarness>[] = [];
const harness = (options?: Parameters<typeof createLiveHarness>[0]) => {
  const created = createLiveHarness(options);
  harnesses.push(created);

  return created;
};

afterEach(() => {
  harnesses.splice(0).forEach(created => created.stop());
});

const lastPresence = (messages: Parameters<typeof ofType>[0]) =>
  ofType(messages, "presence")
    .at(-1)
    ?.members.map(({ clientId, field, locale }) => ({
      clientId,
      field,
      locale,
    }));

describe("joining a record", () => {
  it("replies joined to the tab and shows everyone the new member", async () => {
    const live = harness();
    const anna = live.socket({ id: 1, name: "Anna" });
    const ben = live.socket({ id: 2, name: "Ben" });

    await live.send(anna, {
      clientId: "anna-1",
      locale: "en",
      room,
      type: "join",
    });
    await live.send(ben, {
      clientId: "ben-1",
      locale: "pl",
      room,
      type: "join",
    });

    expect(ofType(ben.received(), "joined")).toEqual([
      {
        clientId: "ben-1",
        members: [
          expect.objectContaining({
            clientId: "anna-1",
            name: "Anna",
            userId: 1,
          }),
          expect.objectContaining({
            clientId: "ben-1",
            name: "Ben",
            userId: 2,
          }),
        ],
        room,
        type: "joined",
      },
    ]);
    expect(lastPresence(anna.received())).toEqual([
      { clientId: "anna-1", field: null, locale: "en" },
      { clientId: "ben-1", field: null, locale: "pl" },
    ]);
  });

  it("refuses a tab the authorization refuses, and keeps it out", async () => {
    const live = harness();
    const anna = live.socket({ id: 1 });
    const intruder = live.socket({ id: 2 });
    live.deny(intruder);

    await live.send(anna, {
      clientId: "anna-1",
      locale: null,
      room,
      type: "join",
    });
    await live.send(intruder, {
      clientId: "x",
      locale: null,
      room,
      type: "join",
    });

    expect(ofType(intruder.received(), "error")).toEqual([
      { clientId: "x", code: "FORBIDDEN", room, type: "error" },
    ]);
    expect(live.server.presence.membersOf(room).map(m => m.clientId)).toEqual([
      "anna-1",
    ]);
  });

  it("lets a tab move to a new socket, but nobody else take its clientId", async () => {
    const live = harness();
    const annaOld = live.socket({ id: 1 });
    const annaNew = live.socket({ id: 1 });
    const mallory = live.socket({ id: 2 });
    await live.send(annaOld, {
      clientId: "anna-1",
      locale: null,
      room,
      type: "join",
    });

    await live.send(mallory, {
      clientId: "anna-1",
      locale: null,
      room,
      type: "join",
    });

    expect(ofType(mallory.received(), "error").at(-1)?.code).toBe("FORBIDDEN");
    expect(live.server.presence.get(room, "anna-1")?.member.userId).toBe(1);

    await live.send(annaNew, {
      clientId: "anna-1",
      locale: null,
      room,
      type: "join",
    });
    live.disconnect(annaOld);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(live.server.presence.membersOf(room).map(m => m.clientId)).toEqual([
      "anna-1",
    ]);
    expect(live.userLeft).toEqual([]);
  });

  it("answers a malformed message with INVALID_MESSAGE", async () => {
    const live = harness();
    const anna = live.socket({ id: 1 });

    await live.send(anna, {
      clientId: "anna-1",
      room: { itemId: "1" },
      type: "join",
    });
    await live.send(anna, { type: "dance" });

    expect(ofType(anna.received(), "error")).toEqual([
      { clientId: "anna-1", code: "INVALID_MESSAGE", type: "error" },
      { clientId: "", code: "INVALID_MESSAGE", type: "error" },
    ]);
  });
});

describe("focus", () => {
  it("tells the room which field and language a member is in", async () => {
    const live = harness();
    const anna = live.socket({ id: 1 });
    const ben = live.socket({ id: 2 });
    await live.send(anna, {
      clientId: "anna-1",
      locale: "en",
      room,
      type: "join",
    });
    await live.send(ben, {
      clientId: "ben-1",
      locale: "en",
      room,
      type: "join",
    });

    await live.send(anna, {
      clientId: "anna-1",
      field: "title",
      locale: "pl",
      room,
      type: "focus",
    });

    expect(lastPresence(ben.received())).toEqual([
      { clientId: "anna-1", field: "title", locale: "pl" },
      { clientId: "ben-1", field: null, locale: "en" },
    ]);
  });

  it("is applied after a join sent right before it, without waiting", async () => {
    const live = harness();
    const anna = live.socket({ id: 1 });

    await Promise.all([
      live.send(anna, { clientId: "anna-1", locale: "en", room, type: "join" }),
      live.send(anna, {
        clientId: "anna-1",
        field: "title",
        locale: "en",
        room,
        type: "focus",
      }),
    ]);

    expect(lastPresence(anna.received())).toEqual([
      { clientId: "anna-1", field: "title", locale: "en" },
    ]);
  });

  it("is NOT_JOINED for a tab outside the room, or another socket's tab", async () => {
    const live = harness();
    const anna = live.socket({ id: 1 });
    const ben = live.socket({ id: 2 });
    await live.send(anna, {
      clientId: "anna-1",
      locale: "en",
      room,
      type: "join",
    });

    await live.send(ben, {
      clientId: "anna-1",
      field: "title",
      locale: "en",
      room,
      type: "focus",
    });

    expect(ofType(ben.received(), "error")).toEqual([
      { clientId: "anna-1", code: "NOT_JOINED", room, type: "error" },
    ]);
    expect(live.server.presence.membersOf(room)[0]?.field).toBeNull();
  });
});

describe("leaving", () => {
  it("removes the tab and reports the user gone after their last tab", async () => {
    const live = harness();
    const anna = live.socket({ id: 1 });
    const ben = live.socket({ id: 2 });
    await live.send(anna, {
      clientId: "anna-1",
      locale: null,
      room,
      type: "join",
    });
    await live.send(anna, {
      clientId: "anna-2",
      locale: null,
      room,
      type: "join",
    });
    await live.send(ben, {
      clientId: "ben-1",
      locale: null,
      room,
      type: "join",
    });

    await live.send(anna, { clientId: "anna-1", room, type: "leave" });

    expect(live.userLeft).toEqual([]);
    expect(lastPresence(ben.received())?.map(m => m.clientId)).toEqual([
      "anna-2",
      "ben-1",
    ]);

    await live.send(anna, { clientId: "anna-2", room, type: "leave" });

    expect(live.userLeft).toEqual([{ room, userId: 1 }]);
    expect(lastPresence(ben.received())?.map(m => m.clientId)).toEqual([
      "ben-1",
    ]);
  });

  it("removes every tab of a socket that closes", async () => {
    const live = harness();
    const anna = live.socket({ id: 1 });
    const ben = live.socket({ id: 2 });
    await live.send(anna, {
      clientId: "anna-1",
      locale: null,
      room,
      type: "join",
    });
    await live.send(anna, {
      clientId: "anna-2",
      locale: null,
      room,
      type: "join",
    });
    await live.send(ben, {
      clientId: "ben-1",
      locale: null,
      room,
      type: "join",
    });

    live.disconnect(anna);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(lastPresence(ben.received())?.map(m => m.clientId)).toEqual([
      "ben-1",
    ]);
    expect(live.userLeft).toEqual([{ room, userId: 1 }]);
  });

  it("drops a member whose heartbeats stopped", async () => {
    let now = 0;
    const live = harness({ now: () => now });
    const anna = live.socket({ id: 1 });
    const ben = live.socket({ id: 2 });
    await live.send(anna, {
      clientId: "anna-1",
      locale: null,
      room,
      type: "join",
    });
    await live.send(ben, {
      clientId: "ben-1",
      locale: null,
      room,
      type: "join",
    });

    now = CONTENT_LIVE_MEMBER_TIMEOUT_MS - 1_000;
    await live.send(ben, { clientId: "ben-1", room, type: "heartbeat" });
    now = CONTENT_LIVE_MEMBER_TIMEOUT_MS;
    await live.server.sweep();

    expect(live.server.presence.membersOf(room).map(m => m.clientId)).toEqual([
      "ben-1",
    ]);
    expect(live.userLeft).toEqual([{ room, userId: 1 }]);

    await live.send(anna, { clientId: "anna-1", room, type: "heartbeat" });

    expect(ofType(anna.received(), "error").at(-1)?.code).toBe("NOT_JOINED");
  });

  it("removes a member whose access was revoked, once the cache expires", async () => {
    let now = 0;
    const live = harness({ authTtlMs: 60_000, now: () => now });
    const anna = live.socket({ id: 1 });
    await live.send(anna, {
      clientId: "anna-1",
      locale: null,
      room,
      type: "join",
    });

    live.deny(anna);
    await live.send(anna, { clientId: "anna-1", room, type: "heartbeat" });

    expect(live.server.presence.membersOf(room)).toHaveLength(1);

    now = 60_000;
    await live.send(anna, { clientId: "anna-1", room, type: "heartbeat" });

    expect(ofType(anna.received(), "error").at(-1)?.code).toBe("FORBIDDEN");
    expect(live.server.presence.membersOf(room)).toEqual([]);
  });
});

describe("members on another instance", () => {
  /** Two servers, each instance telling the other through a fake Redis. */
  const twoInstances = () => {
    let now = 0;
    const delivered: { data: unknown; room: string }[] = [];
    const rooms = new Map<string, Set<string>>();
    const peers: {
      first?: ReturnType<typeof createLiveHarness>;
      second?: ReturnType<typeof createLiveHarness>;
    } = {};

    const forward =
      (
        origin: string,
        target: () => ReturnType<typeof createLiveHarness> | undefined,
      ) =>
      (snapshot: ContentLivePresenceSnapshot) => {
        target()?.server.onInstanceMessage({
          data: JSON.parse(JSON.stringify(snapshot)),
          origin,
          topic: CONTENT_LIVE_PRESENCE_TOPIC,
        });
      };

    const first = harness({
      now: () => now,
      publish: forward("a", () => peers.second),
    });
    const second = harness({
      now: () => now,
      publish: forward("b", () => peers.first),
      // The second instance has its own sockets, so its own registry.
      registry: {
        join: (_ws, room, memberId) => {
          const members = rooms.get(room) ?? new Set();
          rooms.set(room, members);
          members.add(memberId);

          return true;
        },
        leave: (_ws, room, memberId) =>
          rooms.get(room)?.delete(memberId) ?? false,
        toRoom: (room, _id, data) => {
          delivered.push({ data, room });
        },
      },
    });
    peers.first = first;
    peers.second = second;

    return {
      delivered,
      first,
      second,
      setNow: (value: number) => {
        now = value;
      },
    };
  };

  const ids = (members: ContentLiveMember[] | undefined) =>
    members?.map(member => member.clientId);

  it("lists the union of both instances' members", async () => {
    const { first, second } = twoInstances();
    const anna = first.socket({ id: 1 });
    const ben = second.socket({ id: 2 });

    await first.send(anna, {
      clientId: "anna-1",
      locale: null,
      room,
      type: "join",
    });
    await second.send(ben, {
      clientId: "ben-1",
      locale: null,
      room,
      type: "join",
    });

    expect(ids(ofType(ben.received(), "joined")[0]?.members)).toEqual([
      "ben-1",
      "anna-1",
    ]);
    expect(ids(ofType(anna.received(), "presence").at(-1)?.members)).toEqual([
      "anna-1",
      "ben-1",
    ]);

    await second.send(ben, {
      clientId: "ben-1",
      field: "title",
      locale: null,
      room,
      type: "focus",
    });

    expect(
      ofType(anna.received(), "presence")
        .at(-1)
        ?.members.find(member => member.clientId === "ben-1")?.field,
    ).toBe("title");

    await second.send(ben, { clientId: "ben-1", room, type: "leave" });

    expect(ids(ofType(anna.received(), "presence").at(-1)?.members)).toEqual([
      "anna-1",
    ]);
  });

  it("tells a newcomer instance about its members right away", async () => {
    const { delivered, first, second } = twoInstances();
    const anna = first.socket({ id: 1 });
    await first.send(anna, {
      clientId: "anna-1",
      locale: null,
      room,
      type: "join",
    });
    const ben = second.socket({ id: 2 });

    await second.send(ben, {
      clientId: "ben-1",
      locale: null,
      room,
      type: "join",
    });

    const latest = delivered.at(-1)?.data as { members: ContentLiveMember[] };
    expect(ids(latest.members)).toEqual(["ben-1", "anna-1"]);
  });

  it("forgets another instance's members when it stops refreshing them", async () => {
    const { first, second, setNow } = twoInstances();
    const anna = first.socket({ id: 1 });
    const ben = second.socket({ id: 2 });
    await first.send(anna, {
      clientId: "anna-1",
      locale: null,
      room,
      type: "join",
    });
    await second.send(ben, {
      clientId: "ben-1",
      locale: null,
      room,
      type: "join",
    });

    // The second instance dies: no refresh, no goodbye. The first one keeps
    // its own member alive.
    second.server.stop();
    setNow(CONTENT_LIVE_MEMBER_TIMEOUT_MS - 1_000);
    await first.send(anna, { clientId: "anna-1", room, type: "heartbeat" });
    setNow(CONTENT_LIVE_MEMBER_TIMEOUT_MS);
    await first.server.sweep();

    expect(ids(ofType(anna.received(), "presence").at(-1)?.members)).toEqual([
      "anna-1",
    ]);
  });
});
