import type { WSContext } from "hono/ws";

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type {
  ContentRefreshScope,
  ContentRefreshServerMessage,
} from "@/content/live/refresh";

import { CacheModel } from "@/api/lib/cache";
import { contentRefreshRoom } from "@/content/live/refresh";
import {
  BOARD,
  createPolicyWorld,
  POLICY_LIVE,
  policyReplies,
  policyReplyRow,
  policyTopicRow,
  USER,
} from "@/tests/content-policies";
import { markWebSocketEnabled, realtime, wsRegistry } from "@/ws/registry";

import { onContentRefreshRootChanged } from "./publish";

const REPLY_TYPE = policyReplies.definition.id;
const TOPIC = { APPROVE: 30, LIVE: 10 } as const;

const threadOf = (rootId: number): ContentRefreshScope => ({
  contentTypeId: REPLY_TYPE,
  kind: "thread",
  rootId,
});
const REPLIES_LIST: ContentRefreshScope = {
  contentTypeId: REPLY_TYPE,
  kind: "admin",
};

/**
 * Topic 10:
 *
 *   100 ─ 101 ─ 102
 *         └ 103 (hidden)
 *   110
 */
const world = async () =>
  await createPolicyWorld({
    replies: [
      policyReplyRow(100, TOPIC.LIVE),
      policyReplyRow(101, TOPIC.LIVE, { parent: 100 }),
      policyReplyRow(102, TOPIC.LIVE, { parent: 101 }),
      policyReplyRow(103, TOPIC.LIVE, {
        hiddenAt: POLICY_LIVE,
        hiddenBy: USER.ROOT,
        parent: 101,
      }),
      policyReplyRow(110, TOPIC.LIVE),
    ],
    topics: [
      policyTopicRow(TOPIC.LIVE, BOARD.OPEN),
      policyTopicRow(TOPIC.APPROVE, BOARD.APPROVE),
    ],
  });

const sockets: WSContext[] = [];

/** A browser tab following `scope`, as a successful join leaves it. */
const listen = (scope: ContentRefreshScope) => {
  const received: ContentRefreshServerMessage[] = [];
  const ws = {
    send: (raw: string) => {
      received.push(
        (JSON.parse(raw) as { data: ContentRefreshServerMessage }).data,
      );
    },
  } as unknown as WSContext;
  wsRegistry.add(ws, null);
  wsRegistry.join(ws, contentRefreshRoom(scope), "tab");
  sockets.push(ws);

  return { received, ws };
};

const unique = <T>(messages: T[]): T[] => [
  ...new Map(
    messages.map(message => [JSON.stringify(message), message]),
  ).values(),
];

const signalsOf = (messages: ContentRefreshServerMessage[]) =>
  messages.flatMap(message =>
    message.type === "changed" ? [message.signal] : [],
  );

beforeAll(() => {
  markWebSocketEnabled();
});

afterEach(() => {
  sockets.splice(0).forEach(ws => {
    wsRegistry.remove(ws);
  });
  vi.restoreAllMocks();
});

describe("publishing content refresh signals", () => {
  it.each([
    {
      expected: { branchId: 100, kind: "branch" },
      name: "a new reply deep in a branch",
      request: [
        "POST",
        "/replies",
        { values: { body: "New", parent: 102, topic: TOPIC.LIVE } },
      ],
      user: USER.MEMBER,
    },
    {
      expected: { branchId: 100, kind: "branch" },
      name: "an edit",
      request: ["PATCH", "/replies/102", { values: { body: "Edited" } }],
      user: USER.MOD_OPEN,
    },
    {
      expected: { branchId: 100, kind: "branch", removedId: 102 },
      name: "a delete",
      request: ["POST", "/replies/102/delete"],
      user: USER.ROOT,
    },
    {
      expected: { branchId: 100, kind: "branch", removedId: 102 },
      name: "a hide",
      request: ["POST", "/replies/102/hide", {}],
      user: USER.ROOT,
    },
    {
      expected: { branchId: 100, kind: "branch" },
      name: "an unhide",
      request: ["POST", "/replies/103/unhide"],
      user: USER.ROOT,
    },
    {
      expected: { branchId: 110, kind: "branch", removedId: 110 },
      name: "a top-level delete",
      request: ["POST", "/replies/110/delete"],
      user: USER.ROOT,
    },
  ] as const)(
    "sends $name to the thread with its top-level branch, and the list to the AdminCP",
    async ({ expected, request: [method, path, body], user }) => {
      const { send } = await world();
      const thread = listen(threadOf(TOPIC.LIVE));
      const list = listen(REPLIES_LIST);

      const response = await send(method, path, { body, user });

      expect(response.status).toBeLessThan(300);
      // A create announces `created` and `published`: one hint per event.
      expect(unique(thread.received)).toStrictEqual([
        {
          room: contentRefreshRoom(threadOf(TOPIC.LIVE)),
          signal: expected,
          type: "changed",
        },
      ]);
      expect(unique(signalsOf(list.received))).toStrictEqual([
        { kind: "list" },
      ]);
    },
  );

  it("keeps a reply that waits for a moderator off the thread, but not off the AdminCP list", async () => {
    const { send } = await world();
    const thread = listen(threadOf(TOPIC.APPROVE));
    const list = listen(REPLIES_LIST);

    const response = await send("POST", "/replies", {
      body: { values: { body: "Pending", topic: TOPIC.APPROVE } },
      user: USER.MEMBER,
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ status: "draft" });
    expect(thread.received).toStrictEqual([]);
    expect(unique(signalsOf(list.received))).toStrictEqual([{ kind: "list" }]);
  });

  it("sends nothing to a thread room nobody on this instance follows", async () => {
    const { send } = await world();
    const toRoom = vi.spyOn(realtime, "toRoom");

    await send("POST", "/replies", {
      body: { values: { body: "Unheard", topic: TOPIC.LIVE } },
      user: USER.MEMBER,
    });

    expect(unique(toRoom.mock.calls.map(([room]) => room))).toStrictEqual([
      contentRefreshRoom(REPLIES_LIST),
    ]);
  });

  it("tells a thread its root was hidden, and re-checks the room's members", async () => {
    const { send } = await world();
    const thread = listen(threadOf(TOPIC.LIVE));
    const rootChanged = vi.fn();
    const stop = onContentRefreshRootChanged(rootChanged);

    const response = await send("POST", `/topics/${TOPIC.LIVE}/hide`, {
      body: {},
      user: USER.ROOT,
    });
    stop();

    expect(response.status).toBe(200);
    expect(signalsOf(thread.received)).toStrictEqual([{ kind: "thread" }]);
    expect(rootChanged).toHaveBeenCalledExactlyOnceWith(
      contentRefreshRoom(threadOf(TOPIC.LIVE)),
    );
  });

  it("signals only after the event went out and the cached public reads expired", async () => {
    const { emitted, send } = await world();
    const setSystem = vi.spyOn(CacheModel.prototype, "setSystem");
    const seen: { bumped: boolean; events: string[] }[] = [];
    const thread = listen(threadOf(TOPIC.LIVE));
    const { send: deliver } = thread.ws as unknown as {
      send: (raw: string) => void;
    };
    Object.assign(thread.ws, {
      send: (raw: string) => {
        seen.push({
          bumped: setSystem.mock.calls.some(
            ([key]) => key === `content:gen:${REPLY_TYPE}`,
          ),
          events: emitted.map(event => event.name),
        });
        deliver(raw);
      },
    });

    await send("POST", "/replies", {
      body: { values: { body: "Ordered", parent: 100, topic: TOPIC.LIVE } },
      user: USER.MEMBER,
    });

    expect(seen).toStrictEqual([
      { bumped: true, events: [`content.${REPLY_TYPE}.created`] },
      {
        bumped: true,
        events: [
          `content.${REPLY_TYPE}.created`,
          `content.${REPLY_TYPE}.published`,
        ],
      },
    ]);
  });

  it.each([
    ["a missing reply", "PATCH", "/replies/999", { body: "Nope" }, 404],
    [
      "a parent from another topic",
      "POST",
      "/replies",
      { body: "Nope", parent: 100, topic: TOPIC.APPROVE },
      400,
    ],
  ] as const)(
    "publishes nothing for a refused write to %s",
    async (_label, method, path, values, status) => {
      const { send } = await world();
      const thread = listen(threadOf(TOPIC.LIVE));
      const list = listen(REPLIES_LIST);

      const response = await send(method, path, {
        body: { values },
        user: USER.MEMBER,
      });

      expect(response.status).toBe(status);
      expect([...thread.received, ...list.received]).toStrictEqual([]);
    },
  );

  it("never fails a committed write when sending a signal throws", async () => {
    const { events, send } = await world();
    listen(threadOf(TOPIC.LIVE));
    vi.spyOn(realtime, "toRoom").mockImplementation(() => {
      throw new Error("Socket layer down.");
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await send("POST", "/replies", {
      body: { values: { body: "Still saved", topic: TOPIC.LIVE } },
      user: USER.MEMBER,
    });

    expect(response.status).toBe(201);
    expect(events()).toStrictEqual([
      `content.${REPLY_TYPE}.created`,
      `content.${REPLY_TYPE}.published`,
    ]);
  });
});
