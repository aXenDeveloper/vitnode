import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ContentRefreshClientMessage,
  ContentRefreshScope,
  ContentRefreshServerMessage,
} from "@/content/live/refresh";

import {
  contentRefreshChannel,
  contentRefreshRoom,
} from "@/content/live/refresh";
import { VitNodeWebSocketProvider } from "@/ws/provider";

import type { ContentLiveRefreshHandlers } from "./live-refresh";

import { useContentLiveRefresh } from "./live-refresh";

const SCOPE: ContentRefreshScope = {
  contentTypeId: "blog.comment",
  kind: "thread",
  rootId: 7,
};
const ROOM = contentRefreshRoom(SCOPE);

class FakeWebSocket {
  constructor(url: string) {
    this.url = url;
    sockets.push(this);
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
  sent: ContentRefreshClientMessage[] = [];
  readonly url: string;

  close() {
    this.readyState = FakeWebSocket.CLOSED;
  }

  drop() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  push(data: ContentRefreshServerMessage) {
    this.onmessage?.({
      data: JSON.stringify({ data, id: contentRefreshChannel.id }),
    });
  }

  send(raw: string) {
    const message = JSON.parse(raw) as {
      data: ContentRefreshClientMessage;
      id: string;
    };
    if (message.id === contentRefreshChannel.id) this.sent.push(message.data);
  }
}

let sockets: FakeWebSocket[] = [];

const Probe = ({
  handlers,
  scope = SCOPE,
}: {
  handlers: ContentLiveRefreshHandlers;
  scope?: ContentRefreshScope | null;
}) => (
  <output data-testid="status">{useContentLiveRefresh(scope, handlers)}</output>
);

const handlersOf = () => ({
  onDenied: vi.fn(),
  onSignal: vi.fn(),
  onSubscribed: vi.fn(),
});

const status = () => screen.getByTestId("status").textContent;

const mount = () => {
  const handlers = handlersOf();
  const view = render(
    <VitNodeWebSocketProvider>
      <Probe handlers={handlers} />
    </VitNodeWebSocketProvider>,
  );

  return { handlers, view };
};

/** Opens the first socket and answers this tab's join. */
const goLive = () => {
  act(() => sockets[0]?.open());
  const clientId = sockets[0]?.sent[0]?.clientId ?? "";
  act(() => sockets[0]?.push({ clientId, room: ROOM, type: "joined" }));

  return clientId;
};

describe("useContentLiveRefresh", () => {
  beforeEach(() => {
    sockets = [];
    vi.stubEnv("VITNODE_API_URL", "http://localhost:8000");
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubGlobal("BroadcastChannel", undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("joins its scope once the socket opens", () => {
    mount();

    expect(status()).toBe("off");

    act(() => sockets[0]?.open());

    expect(sockets[0]?.sent).toStrictEqual([
      { clientId: expect.any(String), scope: SCOPE, type: "join" },
    ]);
    expect(status()).toBe("joining");
  });

  it("goes live on its own joined answer, never another tab's", () => {
    const { handlers } = mount();
    act(() => sockets[0]?.open());
    const clientId = sockets[0]?.sent[0]?.clientId ?? "";

    act(() =>
      sockets[0]?.push({ clientId: "another-tab", room: ROOM, type: "joined" }),
    );

    expect(status()).toBe("joining");
    expect(handlers.onSubscribed).not.toHaveBeenCalled();

    act(() => sockets[0]?.push({ clientId, room: ROOM, type: "joined" }));

    expect(status()).toBe("live");
    expect(handlers.onSubscribed).toHaveBeenCalledExactlyOnceWith({
      reconnect: false,
    });
  });

  it("passes on only its own room's signals", () => {
    const { handlers } = mount();
    goLive();

    act(() => {
      sockets[0]?.push({
        room: contentRefreshRoom({ ...SCOPE, rootId: 8 }),
        signal: { kind: "thread" },
        type: "changed",
      });
      sockets[0]?.push({
        room: ROOM,
        signal: { branchId: 3, kind: "branch" },
        type: "changed",
      });
    });

    expect(handlers.onSignal).toHaveBeenCalledExactlyOnceWith({
      branchId: 3,
      kind: "branch",
    });
  });

  it("joins again after a reconnect and says it is one", () => {
    const { handlers } = mount();
    const clientId = goLive();

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    act(() => sockets[0]?.drop());
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    act(() => sockets[1]?.open());

    // The leave sent while offline is flushed first, so it never undoes the join.
    expect(sockets[1]?.sent.at(-1)).toStrictEqual({
      clientId,
      scope: SCOPE,
      type: "join",
    });

    act(() => sockets[1]?.push({ clientId, room: ROOM, type: "joined" }));

    expect(handlers.onSubscribed).toHaveBeenLastCalledWith({
      reconnect: true,
    });
    expect(status()).toBe("live");
  });

  it.each([
    {
      code: "NOT_FOUND",
      message: (clientId: string): ContentRefreshServerMessage => ({
        clientId,
        code: "NOT_FOUND",
        room: ROOM,
        type: "revoked",
      }),
      name: "a revoked subscription",
    },
    {
      code: "FORBIDDEN",
      message: (clientId: string): ContentRefreshServerMessage => ({
        clientId,
        code: "FORBIDDEN",
        room: ROOM,
        type: "error",
      }),
      name: "a refused join",
    },
  ])("reports $name as denied", ({ code, message }) => {
    const { handlers } = mount();
    const clientId = goLive();

    act(() => sockets[0]?.push(message("another-tab")));

    expect(status()).toBe("live");

    act(() => sockets[0]?.push(message(clientId)));

    expect(status()).toBe("denied");
    expect(handlers.onDenied).toHaveBeenCalledExactlyOnceWith(code);
  });

  it("asks again later when the server is busy", () => {
    mount();
    act(() => sockets[0]?.open());
    const clientId = sockets[0]?.sent[0]?.clientId ?? "";

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    act(() =>
      sockets[0]?.push({
        clientId,
        code: "RATE_LIMITED",
        room: ROOM,
        type: "error",
      }),
    );

    expect(status()).toBe("off");

    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    expect(sockets[0]?.sent).toStrictEqual([
      { clientId, scope: SCOPE, type: "join" },
      { clientId, scope: SCOPE, type: "join" },
    ]);
  });

  it("leaves when it unmounts", () => {
    const { view } = mount();
    const clientId = goLive();

    view.rerender(<VitNodeWebSocketProvider>{null}</VitNodeWebSocketProvider>);

    expect(sockets[0]?.sent.at(-1)).toStrictEqual({
      clientId,
      scope: SCOPE,
      type: "leave",
    });
  });

  it("stays off without a WebSocket provider", () => {
    render(<Probe handlers={handlersOf()} />);

    expect(status()).toBe("off");
    expect(sockets).toHaveLength(0);
  });
});
