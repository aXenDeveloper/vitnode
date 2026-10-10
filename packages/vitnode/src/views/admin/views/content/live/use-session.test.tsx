// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ContentLiveClientMessage,
  ContentLiveServerMessage,
} from "@/content/live/protocol";

import {
  CONTENT_LIVE_POLL_MS,
  contentLiveChannel,
} from "@/content/live/protocol";
import { VitNodeWebSocketProvider } from "@/ws/provider";

import type { ContentFormTransport } from "../form/transport";
import type { ContentLiveDraftEvent, ContentLiveSession } from "./use-session";

import { ContentFormTransportProvider } from "../form/transport";
import { useContentLiveSession } from "./use-session";

const ROOM = { contentTypeId: "test.note", itemId: 7 };

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
  sent: ContentLiveClientMessage[] = [];
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

  push(data: ContentLiveServerMessage) {
    this.onmessage?.({
      data: JSON.stringify({ data, id: contentLiveChannel.id }),
    });
  }

  send(raw: string) {
    const message = JSON.parse(raw) as { data: ContentLiveClientMessage };
    this.sent.push(message.data);
  }
}

let sockets: FakeWebSocket[] = [];

const joinsOn = (socket: FakeWebSocket | undefined) =>
  socket?.sent.filter(message => message.type === "join") ?? [];

const Probe = ({
  onDraft,
  onSession,
}: {
  onDraft?: (event: ContentLiveDraftEvent) => void;
  onSession?: (session: ContentLiveSession) => void;
}) => {
  const session = useContentLiveSession({ ...ROOM, locale: "en" });
  React.useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-pass-data-to-parent -- hands the hook's API to the test
    onSession?.(session);
  });

  React.useEffect(() => {
    if (!onDraft) return;

    return session.onDraft(onDraft);
  }, [onDraft, session]);

  return (
    <dl>
      <dt>live</dt>
      <dd data-testid="live">{String(session.live)}</dd>
      <dt>members</dt>
      <dd data-testid="members">
        {session.members.map(member => member.name).join(",")}
      </dd>
      <dt>locks</dt>
      <dd data-testid="locks">
        {session.locks.map(lock => lock.field).join(",")}
      </dd>
    </dl>
  );
};

const transportOf = () => {
  const listLocks = vi.fn<ContentFormTransport["listLocks"]>(
    async () => await Promise.resolve({ locks: [] }),
  );
  const readDraft = vi.fn<ContentFormTransport["readDraft"]>(
    async () =>
      await Promise.resolve({ drafts: { shared: null, translations: {} } }),
  );

  return {
    listLocks,
    readDraft,
    transport: { listLocks, readDraft } as unknown as ContentFormTransport,
  };
};

const mount = (
  onDraft?: (event: ContentLiveDraftEvent) => void,
  onSession?: (session: ContentLiveSession) => void,
) => {
  const fake = transportOf();

  const view = render(
    <ContentFormTransportProvider value={fake.transport}>
      <VitNodeWebSocketProvider>
        <Probe onDraft={onDraft} onSession={onSession} />
      </VitNodeWebSocketProvider>
    </ContentFormTransportProvider>,
  );

  return { ...fake, view };
};

const lockOf = (field: string) => ({
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  field,
  locale: null,
  user: { id: 2, name: "Anna" },
});

const member = (clientId: string, name: string) => ({
  avatarColor: null,
  clientId,
  field: null,
  locale: "en",
  name,
  nameCode: null,
  userId: 2,
});

describe("useContentLiveSession", () => {
  describe("with a socket", () => {
    beforeEach(() => {
      sockets = [];
      vi.stubEnv("VITNODE_API_URL", "http://localhost:8000");
      vi.stubGlobal("WebSocket", FakeWebSocket);
      vi.stubGlobal("BroadcastChannel", undefined);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    it("joins the record's room once the socket opens", () => {
      mount();

      expect(joinsOn(sockets[0])).toEqual([]);
      act(() => sockets[0]?.open());

      expect(joinsOn(sockets[0])).toEqual([
        {
          clientId: expect.any(String),
          locale: "en",
          room: ROOM,
          type: "join",
        },
      ]);
    });

    it("goes live on its own joined reply, not another tab's", () => {
      mount();
      act(() => sockets[0]?.open());
      const clientId = joinsOn(sockets[0])[0]?.clientId ?? "";

      act(() =>
        sockets[0]?.push({
          clientId: "another-tab",
          members: [],
          room: ROOM,
          type: "joined",
        }),
      );
      expect(screen.getByTestId("live").textContent).toBe("false");

      act(() =>
        sockets[0]?.push({
          clientId,
          members: [member(clientId, "Anna")],
          room: ROOM,
          type: "joined",
        }),
      );
      expect(screen.getByTestId("live").textContent).toBe("true");
      expect(screen.getByTestId("members").textContent).toBe("Anna");
    });

    it("keeps only its own room's locks, presence and drafts", () => {
      const onDraft = vi.fn();
      mount(onDraft);
      act(() => sockets[0]?.open());
      const other = { contentTypeId: "test.note", itemId: 8 };

      act(() => {
        sockets[0]?.push({
          locks: [lockOf("body")],
          room: other,
          type: "locks",
        });
        sockets[0]?.push({
          members: [member("x", "Ben")],
          room: other,
          type: "presence",
        });
        sockets[0]?.push({
          by: { id: 2, name: "Anna" },
          locale: null,
          room: other,
          type: "draft",
          updatedAt: new Date().toISOString(),
          values: { title: "Elsewhere" },
        });
      });
      expect(screen.getByTestId("locks").textContent).toBe("");
      expect(screen.getByTestId("members").textContent).toBe("");
      expect(onDraft).not.toHaveBeenCalled();

      act(() => {
        sockets[0]?.push({
          locks: [lockOf("title")],
          room: ROOM,
          type: "locks",
        });
        sockets[0]?.push({
          by: { id: 2, name: "Anna" },
          locale: null,
          room: ROOM,
          type: "draft",
          updatedAt: new Date().toISOString(),
          values: { title: "Here" },
        });
      });
      expect(screen.getByTestId("locks").textContent).toBe("title");
      expect(onDraft).toHaveBeenCalledWith(
        expect.objectContaining({ values: { title: "Here" } }),
      );
    });

    it("joins again after a reconnect, since the server forgot the tab", async () => {
      mount();
      act(() => sockets[0]?.open());
      const clientId = joinsOn(sockets[0])[0]?.clientId;

      act(() => sockets[0]?.drop());
      await waitFor(() => expect(sockets).toHaveLength(2), { timeout: 4_000 });
      act(() => sockets[1]?.open());

      expect(joinsOn(sockets[1])).toEqual([
        expect.objectContaining({ clientId, room: ROOM, type: "join" }),
      ]);
    });

    it("leaves the room when the form goes away", () => {
      const { transport, view } = mount();
      act(() => sockets[0]?.open());

      view.rerender(
        <ContentFormTransportProvider value={transport}>
          <VitNodeWebSocketProvider>{null}</VitNodeWebSocketProvider>
        </ContentFormTransportProvider>,
      );

      expect(sockets[0]?.sent.at(-1)).toMatchObject({
        room: ROOM,
        type: "leave",
      });
    });

    it("takes its seat again when the server says it lost it", () => {
      mount();
      act(() => sockets[0]?.open());
      const clientId = joinsOn(sockets[0])[0]?.clientId ?? "";
      act(() =>
        sockets[0]?.push({
          clientId,
          members: [member(clientId, "Anna")],
          room: ROOM,
          type: "joined",
        }),
      );

      act(() => {
        sockets[0]?.push({
          clientId,
          code: "NOT_JOINED",
          room: ROOM,
          type: "error",
        });
        sockets[0]?.push({
          clientId,
          code: "NOT_JOINED",
          room: ROOM,
          type: "error",
        });
      });

      expect(joinsOn(sockets[0])).toHaveLength(2);
      expect(screen.getByTestId("live").textContent).toBe("true");
    });

    it("keeps its seat over a document's error, and loses it when refused", () => {
      mount();
      act(() => sockets[0]?.open());
      const clientId = joinsOn(sockets[0])[0]?.clientId ?? "";
      act(() =>
        sockets[0]?.push({
          clientId,
          members: [member(clientId, "Anna")],
          room: ROOM,
          type: "joined",
        }),
      );

      act(() => {
        sockets[0]?.push({
          clientId,
          code: "NOT_FOUND",
          room: ROOM,
          type: "error",
        });
        sockets[0]?.push({
          clientId,
          code: "INVALID_MESSAGE",
          type: "error",
        });
      });
      expect(screen.getByTestId("live").textContent).toBe("true");

      act(() =>
        sockets[0]?.push({
          clientId,
          code: "FORBIDDEN",
          room: ROOM,
          type: "error",
        }),
      );
      expect(screen.getByTestId("live").textContent).toBe("false");
    });

    it("stays in its language while it moves to a shared field", () => {
      let session: ContentLiveSession | undefined;
      mount(undefined, current => {
        session = current;
      });
      act(() => sockets[0]?.open());

      act(() => {
        session?.focus("title", "pl");
        session?.focus("categoryId", null);
        session?.focus(null, null);
      });

      expect(
        sockets[0]?.sent.filter(message => message.type === "focus"),
      ).toEqual([
        expect.objectContaining({ field: "title", locale: "pl" }),
        expect.objectContaining({ field: "categoryId", locale: "pl" }),
        expect.objectContaining({ field: null, locale: "pl" }),
      ]);
    });
  });

  describe("without a socket", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("polls the locks and the draft over HTTP", async () => {
      const onDraft = vi.fn();
      const { listLocks, readDraft } = mount(onDraft);
      await waitFor(() => expect(listLocks).toHaveBeenCalledTimes(1));

      readDraft.mockResolvedValueOnce({
        drafts: {
          shared: {
            baseVersion: 3,
            updatedAt: "2026-10-08T12:00:00.000Z",
            updatedBy: { id: 2, name: "Anna" },
            values: { title: "Polled" },
          },
          translations: {},
        },
      });
      listLocks.mockResolvedValueOnce({ locks: [lockOf("title")] });

      await act(async () => {
        vi.advanceTimersByTime(CONTENT_LIVE_POLL_MS);
        await Promise.resolve();
      });

      await waitFor(() =>
        expect(screen.getByTestId("locks").textContent).toBe("title"),
      );
      expect(onDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          by: { id: 2, name: "Anna" },
          locale: null,
          values: { title: "Polled" },
        }),
      );
      expect(screen.getByTestId("live").textContent).toBe("false");
    });
  });
});
