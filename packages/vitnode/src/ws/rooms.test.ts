import type { WSContext } from "hono/ws";

import { afterEach, describe, expect, it, vi } from "vitest";

import { realtime, wsRegistry } from "./registry";
import { createWebSocketChannel } from "./types";

const sockets: WSContext[] = [];

const socket = (userId: null | number = 1) => {
  const sent: { data: unknown; id: string }[] = [];
  const ws = {
    send: (raw: string) => {
      sent.push(JSON.parse(raw) as { data: unknown; id: string });
    },
  } as unknown as WSContext;

  wsRegistry.add(ws, userId);
  sockets.push(ws);

  return { sent, ws };
};

afterEach(() => {
  sockets.splice(0).forEach(ws => wsRegistry.remove(ws));
});

describe("rooms", () => {
  it("delivers a room message only to sockets with a member in the room", () => {
    const inside = socket();
    const outside = socket();

    wsRegistry.join(inside.ws, "content:blog.post:1", "tab-a");
    wsRegistry.toRoom("content:blog.post:1", "live", { hello: true });

    expect(inside.sent).toEqual([{ data: { hello: true }, id: "live" }]);
    expect(outside.sent).toEqual([]);
  });

  it("sends once per socket, however many of its tabs joined", () => {
    const shared = socket();

    wsRegistry.join(shared.ws, "room", "tab-a");
    wsRegistry.join(shared.ws, "room", "tab-b");
    wsRegistry.toRoom("room", "live", 1);

    expect(shared.sent).toHaveLength(1);
  });

  it("keeps the socket in the room until its last tab leaves", () => {
    const shared = socket();

    wsRegistry.join(shared.ws, "room", "tab-a");
    wsRegistry.join(shared.ws, "room", "tab-b");
    wsRegistry.leave(shared.ws, "room", "tab-a");

    expect(wsRegistry.roomsOf(shared.ws)).toEqual(["room"]);

    wsRegistry.leave(shared.ws, "room", "tab-b");

    expect(wsRegistry.roomsOf(shared.ws)).toEqual([]);
    expect(wsRegistry.membersOf("room")).toEqual([]);
  });

  it("reports whether a join or a leave changed anything", () => {
    const { ws } = socket();

    expect(wsRegistry.join(ws, "room", "tab-a")).toBe(true);
    expect(wsRegistry.join(ws, "room", "tab-a")).toBe(false);
    expect(wsRegistry.leave(ws, "room", "tab-a")).toBe(true);
    expect(wsRegistry.leave(ws, "room", "tab-a")).toBe(false);
  });

  it("lists every member with its socket", () => {
    const first = socket();
    const second = socket(2);

    wsRegistry.join(first.ws, "room", "tab-a");
    wsRegistry.join(second.ws, "room", "tab-b");

    expect(wsRegistry.membersOf("room")).toEqual([
      { memberId: "tab-a", ws: first.ws },
      { memberId: "tab-b", ws: second.ws },
    ]);
  });

  it("tells close listeners which members left with a closed socket", () => {
    const { ws } = socket();
    const listener = vi.fn();
    const unsubscribe = wsRegistry.onConnectionClose(listener);

    wsRegistry.join(ws, "first", "tab-a");
    wsRegistry.join(ws, "second", "tab-b");
    wsRegistry.remove(ws);
    unsubscribe();

    expect(listener).toHaveBeenCalledWith(ws, [
      { memberId: "tab-a", room: "first" },
      { memberId: "tab-b", room: "second" },
    ]);
    expect(wsRegistry.membersOf("first")).toEqual([]);
  });

  it("does not call close listeners for a socket that was in no room", () => {
    const { ws } = socket();
    const listener = vi.fn();
    const unsubscribe = wsRegistry.onConnectionClose(listener);

    wsRegistry.remove(ws);
    unsubscribe();

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("realtime.toRoom", () => {
  it("delivers to the room's local members by channel id", () => {
    const channel = createWebSocketChannel<never, { n: number }>({
      id: "live",
      module: "content",
      pluginId: "@vitnode/core",
    });
    const member = socket();

    wsRegistry.join(member.ws, "room", "tab-a");
    realtime.toRoom("room", channel, { n: 1 });

    expect(member.sent).toEqual([{ data: { n: 1 }, id: channel.id }]);
  });
});
