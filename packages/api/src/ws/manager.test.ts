import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createWebSocketManager } from "./manager";

class FakeWebSocket {
  constructor(url: string) {
    this.url = url;
    wsInstances.push(this);
  }

  static readonly CLOSED = 3;
  static readonly CLOSING = 2;
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;

  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onopen: (() => void) | null = null;
  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];

  // Written out rather than declared as a constructor parameter property:
  // `erasableSyntaxOnly` rules those out, and `pnpm test:types` type-checks
  // this file.
  readonly url: string;

  // Real browsers deliver the close event asynchronously, so `close()`
  // deliberately does not invoke `onclose` here.
  close() {
    this.readyState = FakeWebSocket.CLOSED;
  }

  // Simulates the browser delivering the deferred close event.
  fireClose() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }

  fireOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  send(data: string) {
    this.sent.push(data);
  }
}

class FakeBroadcastChannel {
  constructor(name: string) {
    this.name = name;
    bcInstances.push(this);
  }

  closed = false;
  readonly name: string;
  onmessage: ((event: { data: unknown }) => void) | null = null;

  posted: unknown[] = [];

  close() {
    this.closed = true;
  }

  postMessage(message: unknown) {
    if (this.closed) {
      const error = new Error(
        "Failed to execute 'postMessage' on 'BroadcastChannel': Channel is closed",
      );
      error.name = "InvalidStateError";
      throw error;
    }
    this.posted.push(message);
  }
}

let wsInstances: FakeWebSocket[] = [];
let bcInstances: FakeBroadcastChannel[] = [];

beforeEach(() => {
  wsInstances = [];
  bcInstances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
  vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const createManager = () =>
  createWebSocketManager({
    url: "ws://localhost/api/ws",
    onMessage: vi.fn(),
    onReadyStateChange: vi.fn(),
  });

describe("createWebSocketManager", () => {
  it("detaches socket handlers on destroy", () => {
    const manager = createManager();
    const ws = wsInstances.at(-1);
    expect(ws).toBeDefined();
    ws?.fireOpen();

    manager.destroy();

    expect(ws?.onclose).toBeNull();
    expect(ws?.onopen).toBeNull();
    expect(ws?.onmessage).toBeNull();
    expect(ws?.onerror).toBeNull();
  });

  it("does not post on the channel after a deferred close event (InvalidStateError regression)", () => {
    const manager = createManager();
    const ws = wsInstances.at(-1);
    const channel = bcInstances.at(-1);
    ws?.fireOpen();

    manager.destroy();
    expect(channel?.closed).toBe(true);

    // The browser delivers the socket's close event after teardown; it must
    // not attempt to post on the already-closed BroadcastChannel.
    expect(() => ws?.fireClose()).not.toThrow();
  });

  it("guards cross-tab posts once destroyed", () => {
    const manager = createManager();
    const channel = bcInstances.at(-1);

    manager.destroy();

    // A queued cross-tab message arriving during teardown must not throw on
    // the closed channel.
    expect(() =>
      channel?.onmessage?.({ data: { type: "request-state" } }),
    ).not.toThrow();
  });
});

const managers: ReturnType<typeof createWebSocketManager>[] = [];

const managed = (onReadyStateChange = vi.fn()) => {
  const manager = createWebSocketManager({
    onMessage: vi.fn(),
    onReadyStateChange,
    url: "ws://localhost/api/ws",
  });
  managers.push(manager);

  return { channel: bcInstances.at(-1), manager, onReadyStateChange };
};

const readyStatesPosted = (channel: FakeBroadcastChannel | undefined) =>
  channel?.posted.filter(
    message => (message as { type: string }).type === "ready-state",
  );

afterEach(() => {
  managers.splice(0).forEach(manager => manager.destroy());
  vi.useRealTimers();
});

describe("connection ids", () => {
  it("are new for every socket the leader opens, and null while closed", () => {
    vi.useFakeTimers();
    const { onReadyStateChange } = managed();

    wsInstances[0]?.fireOpen();
    wsInstances[0]?.fireClose();
    vi.advanceTimersByTime(1000);
    wsInstances[1]?.fireOpen();

    const calls = onReadyStateChange.mock.calls;
    expect(calls).toEqual([
      [1, expect.any(String)],
      [3, null],
      [1, expect.any(String)],
    ]);
    expect(calls[2]?.[1]).not.toBe(calls[0]?.[1]);
  });

  it("go through CONNECTING to a new one when the leader is asked to reconnect", () => {
    const { channel, manager, onReadyStateChange } = managed();
    wsInstances[0]?.fireOpen();
    const first = manager.getConnectionId();

    manager.reconnect();
    wsInstances[1]?.fireOpen();

    expect(onReadyStateChange.mock.calls.slice(1)).toEqual([
      [0, null],
      [1, manager.getConnectionId()],
    ]);
    expect(manager.getConnectionId()).not.toBe(first);
    expect(readyStatesPosted(channel)).toEqual([
      { connectionId: first, payload: 1, type: "ready-state" },
      { connectionId: null, payload: 0, type: "ready-state" },
      {
        connectionId: manager.getConnectionId(),
        payload: 1,
        type: "ready-state",
      },
    ]);
  });

  it("are told again to a tab that asks for the state late", () => {
    const { channel, manager } = managed();
    wsInstances[0]?.fireOpen();

    channel?.onmessage?.({ data: { type: "request-state" } });

    expect(readyStatesPosted(channel)?.at(-1)).toEqual({
      connectionId: manager.getConnectionId(),
      payload: 1,
      type: "ready-state",
    });
  });
});

describe("a follower tab", () => {
  beforeEach(() => {
    // Another tab holds the leader lock for as long as this test runs.
    vi.stubGlobal("navigator", {
      locks: { request: async () => await new Promise(() => {}) },
    });
  });

  it("takes the leader's connection id and asks the leader to send for it", () => {
    const { channel, manager, onReadyStateChange } = managed();

    channel?.onmessage?.({
      data: { connectionId: "conn-2", payload: 1, type: "ready-state" },
    });
    manager.send({ data: 1, id: "x" });

    expect(wsInstances).toHaveLength(0);
    expect(onReadyStateChange).toHaveBeenLastCalledWith(1, "conn-2");
    expect(manager.getConnectionId()).toBe("conn-2");
    expect(channel?.posted).toContainEqual({
      payload: { data: 1, id: "x" },
      type: "send",
    });
  });
});

describe("the leader tab", () => {
  it("sends a follower's message over its socket", () => {
    const { channel } = managed();
    wsInstances[0]?.fireOpen();

    channel?.onmessage?.({
      data: { payload: { data: 1, id: "x" }, type: "send" },
    });

    expect(wsInstances[0]?.sent).toEqual([
      JSON.stringify({ data: 1, id: "x" }),
    ]);
  });
});
