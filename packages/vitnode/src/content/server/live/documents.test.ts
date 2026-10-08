// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyAwarenessUpdate,
  Awareness,
  encodeAwarenessUpdate,
} from "y-protocols/awareness";
import * as Y from "yjs";

import type { ContentLiveDocRef } from "@/content/live/protocol";

import {
  CONTENT_DOCUMENT_PERSIST_MS,
  contentLiveChannel,
  contentLiveDocRoom,
  contentLiveRoom,
} from "@/content/live/protocol";
import {
  createLiveHarness,
  type FakeLiveSocket,
  ofType,
} from "@/tests/content-live";

import { decodeContentLiveBytes, encodeContentLiveBytes } from "./messages";

const room = { contentTypeId: "test.guide", itemId: 1 };
const doc: ContentLiveDocRef = { ...room, field: "content", locale: "en" };
const otherLocale: ContentLiveDocRef = { ...doc, locale: "pl" };

const harnesses: ReturnType<typeof createLiveHarness>[] = [];

afterEach(() => {
  harnesses.splice(0).forEach(live => live.stop());
  vi.useRealTimers();
});

/** One browser tab with its own Y.Doc, talking to the server. */
const setup = () => {
  const live = createLiveHarness();
  harnesses.push(live);

  const tab = async (
    user: number,
    clientId: string,
    socket?: FakeLiveSocket,
  ) => {
    const target = socket ?? live.socket({ id: user });
    const ydoc = new Y.Doc();
    let seen = 0;

    await live.send(target, { clientId, locale: "en", room, type: "join" });

    /** Apply whatever the server sent this socket since the last sync. */
    const sync = () => {
      const received = target.received();
      for (const message of received.slice(seen)) {
        if (message.type !== "doc:update" || message.from === clientId) {
          continue;
        }
        Y.applyUpdate(ydoc, decodeContentLiveBytes(message.update), "server");
      }
      seen = received.length;
    };

    return {
      clientId,
      close: async (ref = doc) => {
        await live.send(target, { clientId, doc: ref, type: "doc:close" });
      },
      edit: async (change: (text: Y.Text) => void, ref = doc) => {
        sync();
        const before = Y.encodeStateVector(ydoc);
        change(ydoc.getText("content"));
        await live.send(target, {
          clientId,
          doc: ref,
          type: "doc:update",
          update: encodeContentLiveBytes(Y.encodeStateAsUpdate(ydoc, before)),
        });
      },
      open: async (ref = doc) => {
        await live.send(target, {
          clientId,
          doc: ref,
          stateVector: encodeContentLiveBytes(Y.encodeStateVector(ydoc)),
          type: "doc:open",
        });
        sync();
      },
      seeds: () =>
        ofType(target.received(), "doc:seed").filter(
          seed => seed.clientId === clientId,
        ),
      socket: target,
      sync,
      text: () => {
        sync();

        return ydoc.getText("content").toJSON();
      },
      ydoc,
    };
  };

  const serverText = (ref = doc) =>
    live.server.documents.loaded(ref)?.getText("content").toJSON();

  return { live, serverText, tab };
};

describe("opening a document", () => {
  it("requires the tab to be in the record's room", async () => {
    const { live } = setup();
    const stranger = live.socket({ id: 9 });

    await live.send(stranger, {
      clientId: "x",
      doc,
      stateVector: "",
      type: "doc:open",
    });

    expect(ofType(stranger.received(), "error")).toEqual([
      { clientId: "x", code: "NOT_JOINED", room, type: "error" },
    ]);
  });

  it("refuses a field that is not a collaborative document", async () => {
    const { live, tab } = setup();
    const anna = await tab(1, "anna-1");

    await anna.open({ ...doc, field: "title" });

    expect(ofType(anna.socket.received(), "error").at(-1)?.code).toBe(
      "NOT_FOUND",
    );
    expect(live.server.documents.loaded({ ...doc, field: "title" })).toBe(
      undefined,
    );
  });

  it("answers with what the tab misses and the server's state vector", async () => {
    const { tab } = setup();
    const anna = await tab(1, "anna-1");
    await anna.open();
    await anna.edit(text => text.insert(0, "Hello"));
    const ben = await tab(2, "ben-1");

    await ben.open();

    expect(ben.text()).toBe("Hello");
    expect(ofType(ben.socket.received(), "doc:state-vector")).toEqual([
      {
        clientId: "ben-1",
        doc,
        stateVector: encodeContentLiveBytes(Y.encodeStateVector(anna.ydoc)),
        type: "doc:state-vector",
      },
    ]);
  });
});

describe("editing together", () => {
  it("converges two tabs and the server on the same text", async () => {
    const { serverText, tab } = setup();
    const anna = await tab(1, "anna-1");
    const ben = await tab(2, "ben-1");
    await anna.open();
    await ben.open();

    await anna.edit(text => text.insert(0, "Hello"));
    await ben.edit(text => text.insert(text.length, " world"));
    await Promise.all([
      anna.edit(text => text.insert(0, "> ")),
      ben.edit(text => text.insert(text.length, "!")),
    ]);

    expect(anna.text()).toBe("> Hello world!");
    expect(ben.text()).toBe(anna.text());
    expect(serverText()).toBe(anna.text());
  });

  it("relays updates only to the document's room, marked with the sender", async () => {
    const { live, tab } = setup();
    const anna = await tab(1, "anna-1");
    const ben = await tab(2, "ben-1");
    const elsewhere = await tab(3, "cleo-1");
    await anna.open();
    await ben.open();
    await elsewhere.open(otherLocale);
    const outsider = live.socket({ id: 4 });

    await anna.edit(text => text.insert(0, "Hi"));

    const relayed = ofType(ben.socket.received(), "doc:update").at(-1);
    expect(relayed).toMatchObject({ doc, from: "anna-1" });
    expect(
      ofType(elsewhere.socket.received(), "doc:update").filter(
        update => update.from === "anna-1",
      ),
    ).toEqual([]);
    expect(outsider.received()).toEqual([]);
  });

  it("rejects an update from a tab that did not open the document", async () => {
    const { live, tab } = setup();
    const anna = await tab(1, "anna-1");

    await anna.edit(text => text.insert(0, "Hi"));

    expect(ofType(anna.socket.received(), "error").at(-1)?.code).toBe(
      "NOT_JOINED",
    );
    expect(live.server.documents.loaded(doc)).toBe(undefined);
  });

  it("applies an update another instance relayed", async () => {
    const { live, serverText, tab } = setup();
    const anna = await tab(1, "anna-1");
    await anna.open();
    await anna.edit(text => text.insert(0, "Hello"));

    const remote = new Y.Doc();
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(anna.ydoc));
    const before = Y.encodeStateVector(remote);
    remote.getText("content").insert(5, " from afar");
    live.server.onRemoteRoomMessage(
      contentLiveDocRoom(doc),
      contentLiveChannel.id,
      {
        doc,
        from: "remote-tab",
        type: "doc:update",
        update: encodeContentLiveBytes(Y.encodeStateAsUpdate(remote, before)),
      },
    );

    expect(serverText()).toBe("Hello from afar");
  });

  it("gives a newcomer everyone's carets and drops a leaver's", async () => {
    const { live, tab } = setup();
    const anna = await tab(1, "anna-1");
    await anna.open();
    const annaAwareness = new Awareness(anna.ydoc);
    annaAwareness.setLocalState({ user: { name: "Anna" } });
    await live.send(anna.socket, {
      clientId: "anna-1",
      doc,
      type: "doc:awareness",
      update: encodeContentLiveBytes(
        encodeAwarenessUpdate(annaAwareness, [anna.ydoc.clientID]),
      ),
    });
    annaAwareness.destroy();
    const ben = await tab(2, "ben-1");

    await ben.open();

    const benAwareness = new Awareness(ben.ydoc);
    const apply = () => {
      for (const message of ofType(ben.socket.received(), "doc:awareness")) {
        applyAwarenessUpdate(
          benAwareness,
          decodeContentLiveBytes(message.update),
          "server",
        );
      }
    };
    apply();

    expect(benAwareness.getStates().get(anna.ydoc.clientID)).toEqual({
      user: { name: "Anna" },
    });

    await anna.close();
    apply();

    expect(benAwareness.getStates().has(anna.ydoc.clientID)).toBe(false);
    benAwareness.destroy();
  });
});

describe("seeding an empty document", () => {
  it("asks exactly one tab, the first to open", async () => {
    const { tab } = setup();
    const anna = await tab(1, "anna-1");
    const ben = await tab(2, "ben-1");

    await anna.open();
    await ben.open();

    expect(anna.seeds()).toEqual([
      { clientId: "anna-1", doc, type: "doc:seed" },
    ]);
    expect(ben.seeds()).toEqual([]);
  });

  it("asks the next tab when the seeder leaves before seeding", async () => {
    const { tab } = setup();
    const anna = await tab(1, "anna-1");
    const ben = await tab(2, "ben-1");
    await anna.open();
    await ben.open();

    await anna.close();

    expect(ben.seeds()).toHaveLength(1);
  });

  it("asks nobody once the document has content", async () => {
    const { tab } = setup();
    const anna = await tab(1, "anna-1");
    const ben = await tab(2, "ben-1");
    const cleo = await tab(3, "cleo-1");
    await anna.open();
    await ben.open();
    await anna.edit(text => text.insert(0, "Seeded"));

    await anna.close();
    await cleo.open();

    expect(ben.seeds()).toEqual([]);
    expect(cleo.seeds()).toEqual([]);
  });

  it("asks nobody when the seed is claimed elsewhere", async () => {
    const { live, tab } = setup();
    await live.store.store.claimSeed(doc);
    const anna = await tab(1, "anna-1");

    await anna.open();

    expect(anna.seeds()).toEqual([]);

    // The other instance gave up its claim: the next sweep picks a tab here.
    await live.store.store.releaseSeed(doc);
    await live.server.sweep();

    expect(anna.seeds()).toHaveLength(1);
  });
});

describe("persistence", () => {
  it("writes once after a quiet period, not per keystroke", async () => {
    vi.useFakeTimers();
    const { live, tab } = setup();
    const anna = await tab(1, "anna-1");
    await anna.open();

    await anna.edit(text => text.insert(0, "H"));
    await anna.edit(text => text.insert(1, "i"));
    await vi.advanceTimersByTimeAsync(CONTENT_DOCUMENT_PERSIST_MS - 1);

    expect(live.store.saves).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);

    expect(live.store.saves).toEqual([{ doc, userId: 1 }]);
  });

  it("writes when the last tab closes, unloads, and reloads the same text", async () => {
    const { live, tab } = setup();
    const anna = await tab(1, "anna-1");
    await anna.open();
    await anna.edit(text => text.insert(0, "Kept"));

    await anna.close();

    expect(live.store.has(doc)).toBe(true);
    expect(live.server.documents.loaded(doc)).toBe(undefined);

    const ben = await tab(2, "ben-1");
    await ben.open();

    expect(ben.text()).toBe("Kept");
    expect(ben.seeds()).toEqual([]);
  });

  it("stores nothing for a document nobody seeded, and frees its claim", async () => {
    const { live, tab } = setup();
    const anna = await tab(1, "anna-1");
    await anna.open();

    await anna.close();

    expect(live.store.has(doc)).toBe(false);
    expect(live.store.claims.size).toBe(0);
  });

  it("closes a socket's documents when it disconnects", async () => {
    const { live, tab } = setup();
    const anna = await tab(1, "anna-1");
    await anna.open();
    await anna.edit(text => text.insert(0, "Saved on close"));

    live.disconnect(anna.socket);
    await vi.waitFor(() => {
      expect(live.server.documents.loaded(doc)).toBe(undefined);
    });

    expect(live.store.has(doc)).toBe(true);
  });
});

describe("resetting a record", () => {
  it("deletes and unloads its documents, so tabs must open them again", async () => {
    const { live, tab } = setup();
    const anna = await tab(1, "anna-1");
    await anna.open();
    await anna.edit(text => text.insert(0, "Old"));
    await anna.close();
    await anna.open();

    await live.server.onReset({ c: anna.socket.c, room });

    expect(live.store.has(doc)).toBe(false);
    expect(live.server.documents.loaded(doc)).toBe(undefined);

    await anna.edit(text => text.insert(0, "x"));

    expect(ofType(anna.socket.received(), "error").at(-1)?.code).toBe(
      "NOT_JOINED",
    );
  });

  it("unloads documents when another instance resets the record", async () => {
    const { live, tab } = setup();
    const anna = await tab(1, "anna-1");
    await anna.open();

    live.server.onRemoteRoomMessage(
      contentLiveRoom(room),
      contentLiveChannel.id,
      {
        reason: "restored",
        room,
        type: "reset",
      },
    );

    expect(live.server.documents.loaded(doc)).toBe(undefined);
  });
});
