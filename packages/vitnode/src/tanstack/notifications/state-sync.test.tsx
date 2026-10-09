// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  notificationStateStore,
  useNotificationState,
} from "@/views/notifications/notification-state-store";
import { notificationsStateChannel } from "@/ws/notifications";
import { VitNodeWebSocketProvider } from "@/ws/provider";

import { SESSION_QUERY_KEY } from "../auth/state";
import { NotificationStateSync } from "./state-sync";

const USER_ID = 7;
const SAME_ORIGIN_API_URL = "http://localhost:3000";

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

  push(data: { reason: string; revision: number; unread: number }) {
    this.onmessage?.({
      data: JSON.stringify({ data, id: notificationsStateChannel.id }),
    });
  }

  send() {}
}

let sockets: FakeWebSocket[] = [];

const Count = () => {
  const state = useNotificationState(USER_ID);

  return (
    <output>{state ? `${state.unread}@${state.revision}` : "none"}</output>
  );
};

const mount = (
  fetchState: () => Promise<{ revision: number; unread: number }>,
) => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(SESSION_QUERY_KEY, {
    user: { id: USER_ID, notifications: { revision: 5, unread: 1 } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <VitNodeWebSocketProvider>
        <NotificationStateSync fetchState={fetchState} />
        <Count />
      </VitNodeWebSocketProvider>
    </QueryClientProvider>,
  );

  return queryClient;
};

describe("NotificationStateSync", () => {
  beforeEach(() => {
    sockets = [];
    notificationStateStore.reset();
    vi.stubEnv("VITNODE_API_URL", "http://localhost:8000");
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubGlobal("BroadcastChannel", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("applies only newer revisions, whatever order they arrive in", async () => {
    const fetchState = vi.fn(
      async () => await Promise.resolve({ revision: 6, unread: 2 }),
    );
    const queryClient = mount(fetchState);

    expect(screen.getByRole("status").textContent).toBe("1@5");

    act(() => sockets[0]?.open());
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("2@6"),
    );

    act(() => sockets[0]?.push({ reason: "created", revision: 8, unread: 4 }));
    act(() => sockets[0]?.push({ reason: "read", revision: 7, unread: 3 }));
    expect(screen.getByRole("status").textContent).toBe("4@8");

    act(() => {
      queryClient.setQueryData(SESSION_QUERY_KEY, {
        user: { id: USER_ID, notifications: { revision: 6, unread: 2 } },
      });
    });
    expect(screen.getByRole("status").textContent).toBe("4@8");
  });

  it("re-reads the count after a reconnect, since missed messages are not replayed", async () => {
    const fetchState = vi
      .fn<() => Promise<{ revision: number; unread: number }>>()
      .mockResolvedValueOnce({ revision: 5, unread: 1 })
      .mockResolvedValueOnce({ revision: 12, unread: 0 });
    mount(fetchState);

    act(() => sockets[0]?.open());
    await waitFor(() => expect(fetchState).toHaveBeenCalledTimes(1));

    act(() => sockets[0]?.drop());
    await waitFor(() => expect(sockets).toHaveLength(2), { timeout: 4_000 });
    act(() => sockets[1]?.open());

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("0@12"),
    );
    expect(fetchState).toHaveBeenCalledTimes(2);
  });

  it("polls the count every minute when there is no socket to listen on", () => {
    vi.stubEnv("VITNODE_API_URL", SAME_ORIGIN_API_URL);
    vi.useFakeTimers();
    const fetchState = vi.fn(
      async () => await Promise.resolve({ revision: 9, unread: 3 }),
    );
    mount(fetchState);

    expect(sockets).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(fetchState).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
