import type { Context } from "hono";
import type { WSContext } from "hono/ws";

import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  ContentRefreshScope,
  ContentRefreshServerMessage,
} from "@/content/live/refresh";

import {
  CONTENT_REFRESH_MAX_JOINS_PER_MINUTE,
  CONTENT_REFRESH_MAX_SUBSCRIPTIONS,
  contentRefreshRoom,
} from "@/content/live/refresh";
import { wsRegistry } from "@/ws/registry";

import type { ContentRefreshAuthorization } from "./auth";

import { createContentRefreshServer } from "./server";

const REAUTH_MS = 60_000;

const ADMIN: ContentRefreshScope = {
  contentTypeId: "blog.post",
  kind: "admin",
};
const THREAD: ContentRefreshScope = {
  contentTypeId: "blog.comment",
  kind: "thread",
  rootId: 7,
};

const cleanups: (() => void)[] = [];

afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup());
});

const setup = ({
  shareKey = () => null,
}: {
  shareKey?: (c: Context, scope: ContentRefreshScope) => null | string;
} = {}) => {
  let at = 1_000_000;
  const denied = new Map<Context, ContentRefreshAuthorization>();
  const authorize = vi.fn(
    async (c: Context): Promise<ContentRefreshAuthorization> =>
      await Promise.resolve(denied.get(c) ?? { ok: true }),
  );
  const server = createContentRefreshServer({
    authorize,
    now: () => at,
    reauthMs: REAUTH_MS,
    shareKey,
  });
  const stopClose = wsRegistry.onConnectionClose(server.onConnectionClose);
  const sockets: WSContext[] = [];
  cleanups.push(() => {
    server.stop();
    stopClose();
    sockets.forEach(ws => wsRegistry.remove(ws));
  });

  const socket = () => {
    const received: ContentRefreshServerMessage[] = [];
    const ws = {
      readyState: 1,
      send: (raw: string) => {
        received.push(
          (JSON.parse(raw) as { data: ContentRefreshServerMessage }).data,
        );
      },
    } as unknown as WSContext;
    const c = {} as Context;
    wsRegistry.add(ws, null);
    sockets.push(ws);

    const send = async (data: unknown) => {
      await server.handle({ c, data, ws });
    };

    return {
      c,
      join: async (scope: ContentRefreshScope, clientId = "tab-a") => {
        await send({ clientId, scope, type: "join" });
      },
      leave: async (scope: ContentRefreshScope, clientId = "tab-a") => {
        await send({ clientId, scope, type: "leave" });
      },
      received,
      send,
      ws,
    };
  };

  const members = (scope: ContentRefreshScope) =>
    wsRegistry
      .membersOf(contentRefreshRoom(scope))
      .map(({ memberId }) => memberId);

  return {
    advance: (ms: number) => {
      at += ms;
    },
    authorize,
    deny: (
      target: { c: Context },
      code: "FORBIDDEN" | "NOT_FOUND" = "FORBIDDEN",
    ) => {
      denied.set(target.c, { code, ok: false });
    },
    members,
    server,
    socket,
  };
};

describe("content refresh joins", () => {
  it.each([
    ["an admin list", ADMIN, "content-refresh:admin:blog.post"],
    [
      "a thread, with a bigint root kept as its exact string",
      {
        contentTypeId: "blog.comment",
        kind: "thread",
        rootId: "9223372036854775807",
      } satisfies ContentRefreshScope,
      "content-refresh:thread:blog.comment:9223372036854775807",
    ],
  ])("acks an authorized join to %s", async (_label, scope, room) => {
    const { members, server, socket } = setup();
    const tab = socket();

    await tab.join(scope);

    expect(tab.received).toStrictEqual([
      { clientId: "tab-a", room, type: "joined" },
    ]);
    expect(members(scope)).toStrictEqual(["tab-a"]);
    expect(server.memberCount()).toBe(1);
  });

  it.each(["FORBIDDEN", "NOT_FOUND"] as const)(
    "answers a refused join with %s and no membership",
    async code => {
      const { deny, members, server, socket } = setup();
      const tab = socket();
      deny(tab, code);

      await tab.join(THREAD);

      expect(tab.received).toStrictEqual([
        {
          clientId: "tab-a",
          code,
          room: contentRefreshRoom(THREAD),
          type: "error",
        },
      ]);
      expect(members(THREAD)).toStrictEqual([]);
      expect(server.memberCount()).toBe(0);
    },
  );

  it.each([
    [
      "a scope without a content type",
      { clientId: "tab-a", scope: { kind: "admin" }, type: "join" },
      "tab-a",
    ],
    [
      "an unknown field",
      { clientId: "tab-a", extra: 1, scope: ADMIN, type: "join" },
      "tab-a",
    ],
    [
      "an unknown type",
      { clientId: "tab-a", scope: ADMIN, type: "subscribe" },
      "tab-a",
    ],
    ["no object at all", "join", ""],
  ])("answers %s with INVALID_MESSAGE", async (_label, data, clientId) => {
    const { server, socket } = setup();
    const tab = socket();

    await tab.send(data);

    expect(tab.received).toStrictEqual([
      { clientId, code: "INVALID_MESSAGE", type: "error" },
    ]);
    expect(server.memberCount()).toBe(0);
  });

  it("keeps tabs sharing a socket apart: one leaving keeps the other", async () => {
    const { members, server, socket } = setup();
    const tab = socket();

    await tab.join(THREAD, "tab-a");
    await tab.join(THREAD, "tab-b");
    await tab.leave(THREAD, "tab-a");

    expect(members(THREAD)).toStrictEqual(["tab-b"]);
    expect(server.memberCount()).toBe(1);

    await tab.leave(THREAD, "tab-b");

    expect(members(THREAD)).toStrictEqual([]);
    expect(server.memberCount()).toBe(0);
  });

  it("refuses a subscription over the limit with TOO_MANY_SUBSCRIPTIONS", async () => {
    const { authorize, server, socket } = setup();
    const tab = socket();
    for (let index = 0; index < CONTENT_REFRESH_MAX_SUBSCRIPTIONS; index++) {
      await tab.join({ contentTypeId: `type-${index}`, kind: "admin" });
    }
    authorize.mockClear();

    await tab.join({ contentTypeId: "one-more", kind: "admin" });

    expect(tab.received.at(-1)).toMatchObject({
      code: "TOO_MANY_SUBSCRIPTIONS",
      type: "error",
    });
    expect(authorize).not.toHaveBeenCalled();
    expect(server.memberCount()).toBe(CONTENT_REFRESH_MAX_SUBSCRIPTIONS);
  });

  it("refuses joins over the per-minute limit with RATE_LIMITED, until the minute passes", async () => {
    const { advance, socket } = setup();
    const tab = socket();
    for (let index = 0; index < CONTENT_REFRESH_MAX_JOINS_PER_MINUTE; index++) {
      await tab.join(ADMIN);
    }

    await tab.join(ADMIN);

    expect(tab.received.at(-1)).toMatchObject({
      code: "RATE_LIMITED",
      type: "error",
    });

    advance(60_000);
    await tab.join(ADMIN);

    expect(tab.received.at(-1)).toMatchObject({ type: "joined" });
  });
});

describe("content refresh re-checks", () => {
  it("revokes a membership that lost access once it is due, and keeps the others", async () => {
    const { advance, authorize, deny, members, socket, server } = setup();
    const kept = socket();
    const lost = socket();
    await kept.join(THREAD);
    await lost.join(THREAD, "tab-b");
    authorize.mockClear();
    deny(lost, "NOT_FOUND");

    advance(REAUTH_MS - 1);
    await server.sweep();

    expect(authorize).not.toHaveBeenCalled();

    advance(1);
    await server.sweep();

    expect(lost.received.at(-1)).toStrictEqual({
      clientId: "tab-b",
      code: "NOT_FOUND",
      room: contentRefreshRoom(THREAD),
      type: "revoked",
    });
    expect(members(THREAD)).toStrictEqual(["tab-a"]);
    expect(kept.received.at(-1)).toMatchObject({ type: "joined" });
  });

  it("re-checks one room at once, asking once per share key", async () => {
    const shareKey = vi.fn(
      (c: Context) => (c as unknown as { key?: string }).key ?? null,
    );
    const { authorize, deny, members, server, socket } = setup({ shareKey });
    const guests = [socket(), socket()];
    const member = socket();
    const elsewhere = socket();
    for (const guest of guests) {
      Object.assign(guest.c, { key: "guest" });
      await guest.join(THREAD);
    }
    Object.assign(member.c, { key: "user-1" });
    await member.join(THREAD);
    await elsewhere.join(ADMIN);
    authorize.mockClear();
    guests.forEach(guest => {
      deny(guest);
    });

    await server.revalidateRoom(contentRefreshRoom(THREAD));

    expect(authorize).toHaveBeenCalledTimes(2);
    expect(authorize.mock.calls.map(([c]) => c)).not.toContain(elsewhere.c);
    expect(members(THREAD)).toHaveLength(1);
    expect(members(ADMIN)).toStrictEqual(["tab-a"]);
  });

  it("forgets every membership of a closed socket", async () => {
    const { authorize, server, socket } = setup();
    const tab = socket();
    await tab.join(THREAD);
    authorize.mockClear();

    wsRegistry.remove(tab.ws);
    await server.revalidateRoom(contentRefreshRoom(THREAD));

    expect(server.memberCount()).toBe(0);
    expect(authorize).not.toHaveBeenCalled();
  });

  it("does not register a socket that closed while its join was checked", async () => {
    const { authorize, members, server, socket } = setup();
    const tab = socket();
    let answer: (value: ContentRefreshAuthorization) => void = () => undefined;
    authorize.mockImplementationOnce(
      async () =>
        await new Promise(resolve => {
          answer = resolve;
        }),
    );

    const joining = tab.join(THREAD);
    await vi.waitFor(() => {
      expect(authorize).toHaveBeenCalledOnce();
    });
    Object.assign(tab.ws, { readyState: 3 });
    wsRegistry.remove(tab.ws);
    answer({ ok: true });
    await joining;

    expect(tab.received).toStrictEqual([]);
    expect(members(THREAD)).toStrictEqual([]);
    expect(server.memberCount()).toBe(0);
  });
});
