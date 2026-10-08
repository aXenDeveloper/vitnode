// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";

import type {
  ContentLiveClientMessage,
  ContentLiveDocRef,
  ContentLiveServerMessage,
} from "@/content/live/protocol";

import {
  createLiveHarness,
  type FakeLiveSocket,
  ofType,
} from "@/tests/content-live";

import {
  type ContentDocProvider,
  type ContentDocTransport,
  createContentDocProvider,
  decodeContentDocBytes,
  encodeContentDocBytes,
} from "./doc-provider";

const room = { contentTypeId: "test.guide", itemId: 1 };
const doc: ContentLiveDocRef = { ...room, field: "content", locale: "en" };
const polish: ContentLiveDocRef = { ...doc, locale: "pl" };

const harnesses: ReturnType<typeof createLiveHarness>[] = [];
const providers: ContentDocProvider[] = [];

afterEach(() => {
  providers.splice(0).forEach(provider => provider.destroy());
  harnesses.splice(0).forEach(live => live.stop());
});

/**
 * The real live server behind fake sockets. A "browser" is one socket shared by
 * its tabs, the way the WebSocket manager shares one across tabs.
 */
const setup = () => {
  const live = createLiveHarness();
  harnesses.push(live);
  const pending = new Set<Promise<void>>();

  /** Waits until the server has handled everything sent so far. */
  const settle = async () => {
    while (pending.size > 0) await Promise.all([...pending]);
  };

  const browser = (userId: number) => {
    let socket: FakeLiveSocket = live.socket({ id: userId });
    let isLive = false;
    const sent: ContentLiveClientMessage[] = [];
    const liveListeners = new Set<(next: boolean) => void>();
    const messageListeners = new Set<
      (message: ContentLiveServerMessage) => void
    >();
    const received: ContentLiveServerMessage[] = [];
    const relay = (message: ContentLiveServerMessage) => {
      received.push(message);
      for (const listener of messageListeners) listener(message);
    };
    let stopListening = socket.listen(relay);

    const send = (message: ContentLiveClientMessage) => {
      sent.push(message);
      const task: Promise<void> = live.send(socket, message).then(() => {
        pending.delete(task);
      });
      pending.add(task);
    };

    const setLive = (next: boolean) => {
      if (next === isLive) return;
      isLive = next;
      for (const listener of liveListeners) listener(next);
    };

    const transport: ContentDocTransport = {
      isLive: () => isLive,
      onLiveChange: listener => {
        liveListeners.add(listener);

        return () => {
          liveListeners.delete(listener);
        };
      },
      send,
      subscribe: listener => {
        messageListeners.add(listener);

        return () => {
          messageListeners.delete(listener);
        };
      },
    };

    return {
      /** Hand the tabs a message as if the socket had delivered it. */
      deliver: relay,
      /** The socket closes: the server forgets every seat on it. */
      drop: () => {
        setLive(false);
        stopListening();
        live.disconnect(socket);
      },
      join: async (clientId: string) => {
        send({ clientId, locale: "en", room, type: "join" });
        await settle();
        setLive(true);
      },
      opensBy: (clientId: string) =>
        sent.filter(
          message =>
            message.type === "doc:open" && message.clientId === clientId,
        ),
      received: () => received,
      reconnect: () => {
        socket = live.socket({ id: userId });
        stopListening = socket.listen(relay);
      },
      tab: (clientId: string, name: string, ref = doc) => {
        const ydoc = new Y.Doc();
        const provider = createContentDocProvider({
          clientId,
          doc: ref,
          transport,
          user: { color: "#2563eb", name },
          ydoc,
        });
        providers.push(provider);

        return {
          provider,
          text: () => ydoc.getText("content").toJSON(),
          type: (change: (text: Y.Text) => void) => {
            change(ydoc.getText("content"));
          },
          ydoc,
        };
      },
    };
  };

  const serverText = (ref = doc) =>
    live.server.documents.loaded(ref)?.getText("content").toJSON();

  return { browser, live, serverText, settle };
};

describe("createContentDocProvider", () => {
  it("encodes bytes as base64 the server can read", () => {
    const bytes = Uint8Array.from(
      { length: 70_000 },
      (_, index) => index % 256,
    );

    expect(decodeContentDocBytes(encodeContentDocBytes(bytes))).toEqual(bytes);
    expect(encodeContentDocBytes(bytes)).toBe(
      Buffer.from(bytes).toString("base64"),
    );
  });

  it("converges two editors through the server", async () => {
    const { browser, serverText, settle } = setup();
    const annaBrowser = browser(1);
    const benBrowser = browser(2);
    await annaBrowser.join("anna-1");
    await benBrowser.join("ben-1");
    const anna = annaBrowser.tab("anna-1", "Anna");
    const ben = benBrowser.tab("ben-1", "Ben");
    expect(anna.provider.synced()).toBe(false);
    await settle();
    expect(anna.provider.synced()).toBe(true);

    anna.type(text => text.insert(0, "Hello"));
    await settle();
    expect(ben.text()).toBe("Hello");

    ben.type(text => text.insert(text.length, " world"));
    anna.type(text => text.insert(0, "> "));
    await settle();

    expect(anna.text()).toBe("> Hello world");
    expect(ben.text()).toBe(anna.text());
    expect(serverText()).toBe(anna.text());
  });

  it("keeps tabs that share one socket on their own documents", async () => {
    const { browser, settle } = setup();
    const shared = browser(1);
    await shared.join("tab-1");
    await shared.join("tab-2");
    await shared.join("tab-3");
    const first = shared.tab("tab-1", "Anna");
    const second = shared.tab("tab-2", "Anna");
    const elsewhere = shared.tab("tab-3", "Anna", polish);
    await settle();

    first.type(text => text.insert(0, "Hi"));
    await settle();

    expect(second.text()).toBe("Hi");
    expect(elsewhere.text()).toBe("");
  });

  it("opens again after a reconnect and sends what the server missed", async () => {
    const { browser, serverText, settle } = setup();
    const annaBrowser = browser(1);
    const benBrowser = browser(2);
    await annaBrowser.join("anna-1");
    await benBrowser.join("ben-1");
    const anna = annaBrowser.tab("anna-1", "Anna");
    const ben = benBrowser.tab("ben-1", "Ben");
    await settle();

    annaBrowser.drop();
    await settle();
    anna.type(text => text.insert(0, "offline "));
    ben.type(text => text.insert(0, "online"));
    await settle();
    expect(anna.text()).toBe("offline ");
    expect(serverText()).toBe("online");

    annaBrowser.reconnect();
    await annaBrowser.join("anna-1");
    await settle();

    expect(annaBrowser.opensBy("anna-1")).toHaveLength(2);
    expect(anna.text()).toBe(ben.text());
    expect(serverText()).toBe(anna.text());
    expect(anna.text()).toContain("offline ");
    expect(anna.text()).toContain("online");
  });

  it("opens again when the server no longer has the tab in the document", async () => {
    const { browser, live, serverText, settle } = setup();
    const annaBrowser = browser(1);
    await annaBrowser.join("anna-1");
    const anna = annaBrowser.tab("anna-1", "Anna");
    await settle();
    anna.type(text => text.insert(0, "Kept"));
    await settle();

    // The instance unloaded the document under the tab.
    live.server.documents.resetRecord(room);
    anna.type(text => text.insert(text.length, " and more"));
    await settle();

    expect(annaBrowser.opensBy("anna-1")).toHaveLength(2);
    expect(serverText()).toBe("Kept and more");
  });

  it("seeds the empty document once, from the tab the server picked", async () => {
    const { browser, settle } = setup();
    const annaBrowser = browser(1);
    const benBrowser = browser(2);
    await annaBrowser.join("anna-1");
    await benBrowser.join("ben-1");
    const anna = annaBrowser.tab("anna-1", "Anna");
    await settle();

    // The seed waited for someone to listen.
    let seeds = 0;
    anna.provider.onSeed(() => {
      seeds += 1;
      anna.type(text => text.insert(0, "From the record"));
    });
    const ben = benBrowser.tab("ben-1", "Ben");
    let benSeeds = 0;
    ben.provider.onSeed(() => {
      benSeeds += 1;
    });
    await settle();

    expect(seeds).toBe(1);
    expect(benSeeds).toBe(0);
    expect(ben.text()).toBe("From the record");
  });

  it("ignores a second seed request for the same document", async () => {
    const { browser, settle } = setup();
    const annaBrowser = browser(1);
    await annaBrowser.join("anna-1");
    const anna = annaBrowser.tab("anna-1", "Anna");
    let seeds = 0;
    // An empty record: the seeder has nothing to write.
    anna.provider.onSeed(() => {
      seeds += 1;
    });
    await settle();

    annaBrowser.drop();
    await settle();
    annaBrowser.reconnect();
    await annaBrowser.join("anna-1");
    await settle();

    // The server asked again after the reconnect; the provider had answered.
    expect(
      ofType(annaBrowser.received(), "doc:seed").filter(
        seed => seed.clientId === "anna-1",
      ),
    ).toHaveLength(2);
    expect(seeds).toBe(1);
  });

  it("shares carets and takes them away when the editor closes", async () => {
    const { browser, settle } = setup();
    const annaBrowser = browser(1);
    const benBrowser = browser(2);
    await annaBrowser.join("anna-1");
    await benBrowser.join("ben-1");
    const anna = annaBrowser.tab("anna-1", "Anna");
    await settle();
    const ben = benBrowser.tab("ben-1", "Ben");
    await settle();

    expect(ben.provider.awareness.getStates().get(anna.ydoc.clientID)).toEqual({
      user: { color: "#2563eb", name: "Anna" },
    });
    expect(anna.provider.awareness.getStates().get(ben.ydoc.clientID)).toEqual({
      user: { color: "#2563eb", name: "Ben" },
    });

    anna.provider.destroy();
    await settle();

    expect(ben.provider.awareness.getStates().has(anna.ydoc.clientID)).toBe(
      false,
    );
    expect(annaBrowser.opensBy("anna-1")).toHaveLength(1);
  });

  it("goes quiet once the record is reset under it", async () => {
    const { browser, live, serverText, settle } = setup();
    const annaBrowser = browser(1);
    await annaBrowser.join("anna-1");
    const anna = annaBrowser.tab("anna-1", "Anna");
    await settle();

    // What the record room hears when a revision is restored: the server
    // drops the documents, and the form remounts on the restored record.
    live.server.documents.resetRecord(room);
    annaBrowser.deliver({ reason: "restored", room, type: "reset" });
    anna.type(text => text.insert(0, "Stale"));
    await settle();

    expect(serverText()).toBe(undefined);
    expect(annaBrowser.opensBy("anna-1")).toHaveLength(1);
  });
});
