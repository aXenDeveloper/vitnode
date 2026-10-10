// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import type {
  ContentLiveClientMessage,
  ContentLiveDocRef,
  ContentLiveMember,
  ContentLiveServerMessage,
} from "@/content/live/protocol";
import type { RichTextDocument } from "@/content/rich-text/document";

import { contentLiveChannel } from "@/content/live/protocol";
import { VitNodeWebSocketProvider } from "@/ws/provider";

import type { ContentLiveContextValue } from "./context";

import { ContentLiveRichTextEditor } from "./collaborative-editor";
import { decodeContentDocBytes, encodeContentDocBytes } from "./doc-provider";
import { createContentRichTextRegistry } from "./rich-text";

const doc: ContentLiveDocRef = {
  contentTypeId: "test.note",
  field: "content",
  itemId: 7,
  locale: "en",
};

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

const ME: ContentLiveMember = {
  avatarColor: "2563eb",
  clientId: "my-tab",
  field: "content",
  locale: "en",
  name: "Me",
  nameCode: "Me",
  userId: 1,
};

const paragraphDoc = (text: string): RichTextDocument => ({
  content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
  type: "doc",
});

const liveValue = (): ContentLiveContextValue => ({
  autosave: { flush: vi.fn(), queue: vi.fn() },
  coEditing: true,
  itemId: doc.itemId,
  locale: "en",
  reloadDrafts: vi.fn(),
  richText: createContentRichTextRegistry(),
  session: {
    clientId: ME.clientId,
    focus: vi.fn(),
    live: true,
    locks: [],
    members: [ME],
    onCommitted: () => () => {},
    onDraft: () => () => {},
    onReset: () => () => {},
    readDrafts: async () => await Promise.resolve(null),
    readyState: 1,
    refreshLocks: vi.fn(),
    rememberSelf: vi.fn(),
    self: ME.userId,
  },
  spec: {
    contentTypeId: doc.contentTypeId,
    defaultLocale: "en",
    editorial: true,
    fields: [],
    permissionModule: "notes",
    pluginId: "@vitnode/example",
    sections: [],
    titleField: "title",
  },
  status: { dirty: false, failed: false, savedAt: null, saving: false },
});

const sentOf = <TType extends ContentLiveClientMessage["type"]>(
  type: TType,
): (ContentLiveClientMessage & { type: TType })[] =>
  (sockets[0]?.sent ?? []).filter(
    (message): message is ContentLiveClientMessage & { type: TType } =>
      message.type === type,
  );

/** What the server holds: everything the editor sent, applied in order. */
const serverCopy = () => {
  const copy = new Y.Doc();
  for (const message of sentOf("doc:update")) {
    Y.applyUpdate(copy, decodeContentDocBytes(message.update));
  }

  return copy;
};

const mount = (value: null | RichTextDocument) => {
  const live = liveValue();
  const onChange = vi.fn<(next: RichTextDocument) => void>();
  const view = render(
    <VitNodeWebSocketProvider>
      <ContentLiveRichTextEditor
        aria-label="Content"
        field="content"
        live={live}
        locale="en"
        onChange={onChange}
        value={value}
      />
    </VitNodeWebSocketProvider>,
  );
  act(() => sockets[0]?.open());

  /** The server's answer to the open: nothing stored yet. */
  const answerOpen = async () => {
    act(() => {
      sockets[0]?.push({
        clientId: ME.clientId,
        doc,
        stateVector: encodeContentDocBytes(Y.encodeStateVector(new Y.Doc())),
        type: "doc:state-vector",
      });
    });
    await screen.findByRole("textbox");
  };

  return { answerOpen, live, onChange, view };
};

describe("ContentLiveRichTextEditor", () => {
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

  it("opens the shared document and waits for it before showing the editor", async () => {
    const { answerOpen } = mount(paragraphDoc("From the record"));

    expect(sentOf("doc:open")).toEqual([
      expect.objectContaining({ clientId: ME.clientId, doc }),
    ]);
    expect(screen.queryByRole("textbox")).toBeNull();

    await answerOpen();

    // Yjs is the source: the record shows only once the server says so.
    expect(screen.getByRole("textbox").textContent).not.toContain(
      "From the record",
    );
  });

  it("fills an empty document from the record when the server asks it to", async () => {
    const { answerOpen, onChange } = mount(paragraphDoc("From the record"));
    await answerOpen();

    act(() => {
      sockets[0]?.push({ clientId: ME.clientId, doc, type: "doc:seed" });
    });

    await waitFor(() => {
      expect(screen.getByRole("textbox").textContent).toBe("From the record");
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        content: [
          expect.objectContaining({
            content: [{ text: "From the record", type: "text" }],
            type: "paragraph",
          }),
        ],
      }),
    );
    expect(serverCopy().getXmlFragment("default").toJSON()).toContain(
      "From the record",
    );

    // Asked again, it has already seeded.
    act(() => {
      sockets[0]?.push({ clientId: ME.clientId, doc, type: "doc:seed" });
    });
    expect(screen.getByRole("textbox").textContent).toBe("From the record");
  });

  it("shows what someone else types and keeps the form value with it", async () => {
    const { answerOpen, onChange } = mount(null);
    await answerOpen();

    const anna = new Y.Doc();
    const paragraph = new Y.XmlElement("paragraph");
    paragraph.insert(0, [new Y.XmlText("Hello from Anna")]);
    anna.getXmlFragment("default").insert(0, [paragraph]);
    act(() => {
      sockets[0]?.push({
        doc,
        from: "anna-tab",
        type: "doc:update",
        update: encodeContentDocBytes(Y.encodeStateAsUpdate(anna)),
      });
    });

    await waitFor(() => {
      expect(screen.getByRole("textbox").textContent).toBe("Hello from Anna");
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        content: [
          expect.objectContaining({
            content: [{ text: "Hello from Anna", type: "text" }],
          }),
        ],
      }),
    );
  });

  it("lets code outside replace the document through the shared editor", async () => {
    const { answerOpen, live } = mount(null);
    await answerOpen();
    await waitFor(() => {
      expect(live.richText.get("content", "en")).not.toBeNull();
    });

    act(() => {
      live.richText.replace("content", "en", paragraphDoc("Przetłumaczone"));
    });

    expect(screen.getByRole("textbox").textContent).toBe("Przetłumaczone");
    expect(serverCopy().getXmlFragment("default").toJSON()).toContain(
      "Przetłumaczone",
    );
  });

  it("closes the document when it goes away", async () => {
    const { answerOpen, live, view } = mount(null);
    await answerOpen();

    // The socket outlives the form: only the editor goes.
    view.rerender(<VitNodeWebSocketProvider>{null}</VitNodeWebSocketProvider>);

    expect(sentOf("doc:close")).toEqual([
      { clientId: ME.clientId, doc, type: "doc:close" },
    ]);
    expect(live.richText.get("content", "en")).toBeNull();
  });
});
