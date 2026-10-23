import type { WSContext, WSEvents } from "hono/ws";

import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WebSocketConfig } from "@/api/lib/websocket";
import type {
  EnvVariablesVitNode,
  EnvVitNode,
} from "@/api/middlewares/global.middleware";

import { buildWebSocket } from "@/api/lib/websocket";
import { websocketOriginMiddleware } from "@/api/middlewares/websocket-origin.middleware";
import { core_notification_user_state } from "@/database/notifications";
import { configureInProcessApi } from "@/lib/fetcher/in-process-api.server";
import { createMemoryDb } from "@/tests/memory-db";

import type { VitNodeCrosswsHooks, VitNodeCrosswsPeer } from "./crossws.server";

import {
  createVitNodeWebSocketHooks,
  upgradeWebSocket,
} from "./crossws.server";
import { handleVitNodeWebSocket } from "./handle";
import { notificationsStateChannel } from "./notifications";
import { wsRegistry } from "./registry";
import { getWebSocketId, WS_PING_ID, WS_PONG_ID } from "./types";

const ORIGIN = "https://site.example";
const WS_URL = `${ORIGIN}/api/ws`;

const handled: { data: unknown; ws: WSContext }[] = [];

const roomsSocket: WebSocketConfig = {
  ...buildWebSocket<{ room: string }, { joined: string }>({
    id: "rooms",
    onMessage: ({ data, send, ws }) => {
      handled.push({ data, ws });
      wsRegistry.join(ws, data.room, "tab-a");
      send({ joined: data.room });
    },
  }),
  module: "test",
  pluginId: "@vitnode/test",
};
const ROOMS_ID = getWebSocketId(roomsSocket);

/**
 * The embedded API's `/api/ws` route as an app mounts it, behind a stand-in for
 * the global middleware: the `user` cookie plays the session.
 */
const buildApp = () => {
  const inline = {
    onClose: vi.fn<NonNullable<WSEvents["onClose"]>>(),
    onError: vi.fn<NonNullable<WSEvents["onError"]>>(),
    onMessage: vi.fn<NonNullable<WSEvents["onMessage"]>>(),
  };
  const createEvents = vi.fn(() => inline);
  const { db } = createMemoryDb([
    [
      core_notification_user_state,
      [{ revision: 3, unreadCount: 2, userId: 7 }],
    ],
  ]);

  const app = new Hono<EnvVitNode>().basePath("/api");
  app.use("*", async (c, next) => {
    c.set("core", {
      authorization: { deviceCookieName: "vitnode_device" },
      webSockets: [roomsSocket],
    } as unknown as EnvVariablesVitNode["core"]);
    c.set("db", db as unknown as EnvVariablesVitNode["db"]);
    const userId = /(?:^|; )user=(\d+)/.exec(c.req.header("cookie") ?? "")?.[1];
    c.set(
      "user",
      userId
        ? ({ id: Number(userId) } as unknown as EnvVariablesVitNode["user"])
        : null,
    );
    if (c.req.header("x-refresh-session")) {
      c.header("set-cookie", "session=fresh; Path=/", { append: true });
      c.header("set-cookie", "csrf=token; Path=/", { append: true });
    }
    await next();
  });
  app.get(
    "/ws",
    websocketOriginMiddleware(),
    upgradeWebSocket(handleVitNodeWebSocket(createEvents)),
  );

  return { app, createEvents, inline };
};

const handshake = (headers: Record<string, string> = {}) =>
  new Request(WS_URL, { headers: { origin: ORIGIN, ...headers } });

const peers: { hooks: VitNodeCrosswsHooks; peer: VitNodeCrosswsPeer }[] = [];

/** The accepted upgrade, or a failure naming the status it was refused with. */
const accept = async (upgrade: ReturnType<VitNodeCrosswsHooks["upgrade"]>) => {
  const result = await upgrade;
  if (result instanceof Response) {
    throw new Error(`Upgrade refused with ${result.status}`);
  }

  return result;
};

const fakePeer = (context: Record<string, unknown>) => {
  const sent: unknown[] = [];
  const peer = {
    close: vi.fn<VitNodeCrosswsPeer["close"]>(),
    // crossws merges the context `upgrade` returned into the peer's own.
    context: { ...context },
    request: { url: WS_URL },
    send: (data: ArrayBuffer | string | Uint8Array) => {
      sent.push(typeof data === "string" ? JSON.parse(data) : data);
    },
    websocket: { readyState: 1 },
  } satisfies VitNodeCrosswsPeer;

  return { peer, sent };
};

const textMessage = (rawData: unknown) => ({
  arrayBuffer: () => new ArrayBuffer(0),
  rawData,
});

const setup = () => {
  const built = buildApp();
  const hooks = createVitNodeWebSocketHooks({
    api: async request => await built.app.fetch(request),
  });

  const connect = async (headers: Record<string, string> = {}) => {
    const { context } = await accept(hooks.upgrade(handshake(headers)));
    const client = fakePeer(context);
    peers.push({ hooks, peer: client.peer });
    hooks.open(client.peer);

    return {
      ...client,
      say: (message: unknown) => {
        hooks.message(client.peer, textMessage(JSON.stringify(message)));
      },
    };
  };

  return { ...built, connect, hooks };
};

beforeEach(() => {
  handled.length = 0;
});

afterEach(() => {
  peers.splice(0).forEach(({ hooks, peer }) => {
    hooks.close(peer, { code: 1000 });
  });
  vi.restoreAllMocks();
});

describe("the shared protocol through crossws", () => {
  it("answers the client's ping with a pong", async () => {
    const { connect } = setup();
    const client = await connect();

    client.say({ data: null, id: WS_PING_ID });

    expect(client.sent).toEqual([{ data: null, id: WS_PONG_ID }]);
  });

  it("routes messages to their socket's handler with one stable connection object", async () => {
    const { connect } = setup();
    const client = await connect();

    client.say({ data: { room: "a" }, id: ROOMS_ID });
    client.say({ data: { room: "b" }, id: ROOMS_ID });

    expect(handled.map(({ data }) => data)).toEqual([
      { room: "a" },
      { room: "b" },
    ]);
    expect(handled[0]?.ws).toBe(handled[1]?.ws);
    expect(wsRegistry.roomsOf(handled[0].ws)).toEqual(["a", "b"]);
    expect(client.sent).toEqual([
      { data: { joined: "a" }, id: ROOMS_ID },
      { data: { joined: "b" }, id: ROOMS_ID },
    ]);
  });

  it("hands unmatched, non-JSON and binary messages to the connection's own handler", async () => {
    const { connect, hooks, inline } = setup();
    const client = await connect();
    const bytes = new Uint8Array([1, 2, 3]).buffer;

    client.say({ data: 1, id: "@vitnode/test_test_missing" });
    hooks.message(client.peer, textMessage("not json"));
    hooks.message(client.peer, {
      arrayBuffer: () => bytes,
      rawData: new Uint8Array(bytes),
    });

    expect(inline.onMessage.mock.calls.map(([event]) => event.data)).toEqual([
      JSON.stringify({ data: 1, id: "@vitnode/test_test_missing" }),
      "not json",
      bytes,
    ]);
    expect(handled).toEqual([]);
    expect(client.sent).toEqual([]);
  });
});

describe("the handshake", () => {
  it("rejects another site with the API's 403 before any connection events exist", async () => {
    const { createEvents, hooks } = setup();

    const rejection: unknown = await hooks
      .upgrade(handshake({ origin: "https://evil.example" }))
      .catch((error: unknown) => error);

    expect(rejection).toBeInstanceOf(Response);
    expect((rejection as Response).status).toBe(403);
    expect(createEvents).not.toHaveBeenCalled();
  });

  it("closes a peer that opens without an accepted handshake and never registers it", () => {
    const { hooks } = setup();
    const { peer, sent } = fakePeer({});

    hooks.open(peer);
    hooks.message(peer, textMessage(JSON.stringify({ id: WS_PING_ID })));
    wsRegistry.broadcast("test", 1);

    expect(peer.close).toHaveBeenCalledWith(1011, "Missing handshake");
    expect(sent).toEqual([]);
  });

  it("answers a plain GET of the route with 426", async () => {
    const { app } = setup();

    const res = await app.request(WS_URL, { headers: { origin: ORIGIN } });

    expect(res.status).toBe(426);
  });

  it("passes the session cookies the handshake set on to the upgrade", async () => {
    const { hooks } = setup();

    const { headers } = await accept(
      hooks.upgrade(handshake({ "x-refresh-session": "1" })),
    );

    expect(headers).toEqual([
      ["set-cookie", expect.stringContaining("session=fresh")],
      ["set-cookie", expect.stringContaining("csrf=token")],
    ]);
  });

  it("registers a signed-in connection as its user and a guest as nobody", async () => {
    const { connect } = setup();
    const member = await connect({ cookie: "user=7" });
    const guest = await connect();

    wsRegistry.sendToUser(7, "inbox", { n: 1 });

    expect(member.sent).toContainEqual({ data: { n: 1 }, id: "inbox" });
    expect(guest.sent).toEqual([]);
  });

  it("sends a signed-in connection its notification state as it opens", async () => {
    const { connect } = setup();

    const member = await connect({ cookie: "user=7" });

    await vi.waitFor(() => {
      expect(member.sent).toEqual([
        {
          data: { reason: "reconciled", revision: 3, unread: 2 },
          id: notificationsStateChannel.id,
        },
      ]);
    });
  });
});

describe("on a cold instance with no API registered yet", () => {
  afterEach(() => {
    configureInProcessApi(undefined as never);
  });

  it("answers 503 when loading the app registers no API", async () => {
    const warmup = vi.fn(async () => await Promise.resolve());
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const hooks = createVitNodeWebSocketHooks({ warmup });

    const rejection: unknown = await hooks
      .upgrade(handshake())
      .catch((error: unknown) => error);

    expect(warmup).toHaveBeenCalledTimes(1);
    expect(rejection).toBeInstanceOf(Response);
    expect((rejection as Response).status).toBe(503);
  });

  it("loads the app once for concurrent handshakes, then authenticates through it", async () => {
    const { app } = buildApp();
    const warmup = vi.fn(async (_request: Request) => {
      await Promise.resolve();
      configureInProcessApi(async request => await app.fetch(request));
    });
    const hooks = createVitNodeWebSocketHooks({ warmup });

    const accepted = await Promise.all([
      accept(hooks.upgrade(handshake())),
      accept(hooks.upgrade(handshake())),
    ]);

    expect(warmup).toHaveBeenCalledTimes(1);
    expect(warmup.mock.calls[0]?.[0]).toMatchObject({
      method: "GET",
      url: WS_URL,
    });
    expect(accepted).toHaveLength(2);
  });
});

describe("closing a connection", () => {
  it.each([
    [
      "closes",
      (hooks: VitNodeCrosswsHooks, peer: VitNodeCrosswsPeer) => {
        hooks.close(peer, { code: 1000 });
      },
    ],
    [
      "errors and then closes",
      (hooks: VitNodeCrosswsHooks, peer: VitNodeCrosswsPeer) => {
        hooks.error(peer, new Error("reset"));
        hooks.close(peer, { code: 1006 });
      },
    ],
  ])(
    "leaves the registry and every room exactly once when the socket %s",
    async (_, end) => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const { connect, hooks, inline } = setup();
      const client = await connect({ cookie: "user=8" });
      await vi.waitFor(() => {
        expect(client.sent).toHaveLength(1);
      });
      client.say({ data: { room: "a" }, id: ROOMS_ID });
      const ws = handled[0].ws;
      const left = vi.fn();
      const stop = wsRegistry.onConnectionClose(left);

      end(hooks, client.peer);
      stop();
      const sentBefore = client.sent.length;
      wsRegistry.sendToUser(8, "inbox", 1);
      client.say({ data: null, id: WS_PING_ID });

      expect(left).toHaveBeenCalledTimes(1);
      expect(left).toHaveBeenCalledWith(ws, [{ memberId: "tab-a", room: "a" }]);
      expect(inline.onClose).toHaveBeenCalledTimes(1);
      expect(wsRegistry.membersOf("a")).toEqual([]);
      expect(client.sent).toHaveLength(sentBefore);
    },
  );

  it("closes the peer with 1011 and tells the connection's onError on a runtime error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { connect, hooks, inline } = setup();
    const client = await connect();

    hooks.error(client.peer, new Error("reset"));

    expect(inline.onError).toHaveBeenCalledTimes(1);
    expect(client.peer.close).toHaveBeenCalledWith(1011, "Internal error");
  });
});
