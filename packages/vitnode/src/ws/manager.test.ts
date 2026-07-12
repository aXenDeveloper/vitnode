import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createWebSocketManager } from "./manager";

class FakeWebSocket {
  constructor(public url: string) {
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
  constructor(public name: string) {
    bcInstances.push(this);
  }
  closed = false;
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
