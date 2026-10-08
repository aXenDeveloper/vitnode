import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnyFormFieldApi } from "@/components/form/auto-form";
import type {
  ContentFormFieldSpec,
  ContentFormSpec,
} from "@/content/admin/spec";
import type { ContentFieldLock } from "@/content/live/protocol";

import type { ContentFormTransport } from "../form/transport";
import type { ContentLiveContextValue } from "./context";
import type { ContentLiveDraftEvent, ContentLiveSession } from "./use-session";

import { ContentFormTransportProvider } from "../form/transport";
import { ContentLiveContext } from "./context";
import { CONTENT_FIELD_LOCK_BLUR_GRACE_MS, ContentLiveField } from "./field";

const ME = 1;
const ANNA = 2;

const fieldSpec: ContentFormFieldSpec = {
  kind: "text",
  label: "Title",
  name: "title",
  nullable: false,
  required: true,
};

const spec: ContentFormSpec = {
  contentTypeId: "test.note",
  defaultLocale: null,
  editorial: true,
  fields: [fieldSpec],
  permissionModule: "notes",
  pluginId: "@vitnode/example",
  sections: [],
  titleField: "title",
};

const lockOf = (userId: number, name: string): ContentFieldLock => ({
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  field: "title",
  locale: null,
  user: { id: userId, name },
});

const setup = ({ locks = [] }: { locks?: ContentFieldLock[] } = {}) => {
  const draftListeners = new Set<(event: ContentLiveDraftEvent) => void>();
  const session: ContentLiveSession = {
    clientId: "tab-1",
    focus: vi.fn(),
    live: false,
    locks,
    members: [],
    onDraft: listener => {
      draftListeners.add(listener);

      return () => {
        draftListeners.delete(listener);
      };
    },
    onReset: () => () => {},
    readDrafts: async () => await Promise.resolve(null),
    readyState: 3,
    refreshLocks: vi.fn(async () => {
      await Promise.resolve();
    }),
    rememberSelf: vi.fn(),
    self: ME,
  };
  const live: ContentLiveContextValue = {
    autosave: {
      flush: vi.fn(async () => {
        await Promise.resolve();
      }),
      queue: vi.fn(),
    },
    itemId: 7,
    locale: null,
    session,
    spec,
    status: { dirty: false, failed: false, savedAt: null, saving: false },
  };
  const lock = vi.fn<ContentFormTransport["lock"]>(
    async (_type, _id, { action }) =>
      await Promise.resolve({
        lock: action === "release" ? null : lockOf(ME, "Me"),
        status: 200,
      }),
  );
  const transport = { lock } as unknown as ContentFormTransport;
  const field: AnyFormFieldApi = {
    name: "title",
    onBlur: vi.fn(),
    onChange: vi.fn(),
    value: "Hello",
  };

  render(
    <ContentFormTransportProvider value={transport}>
      <ContentLiveContext value={live}>
        <ContentLiveField field={field} fieldSpec={fieldSpec}>
          <input aria-label="Title" defaultValue="Hello" />
        </ContentLiveField>
        <button type="button">Elsewhere</button>
      </ContentLiveContext>
    </ContentFormTransportProvider>,
  );

  return { draftListeners, field, live, lock };
};

afterEach(() => {
  vi.useRealTimers();
});

describe("ContentLiveField", () => {
  it("is read-only and names the holder while someone else edits it", () => {
    setup({ locks: [lockOf(ANNA, "Anna")] });

    // A disabled fieldset disables every control inside it, and says why.
    expect(screen.getByRole("group", { description: /Anna/ })).toHaveProperty(
      "disabled",
      true,
    );
    expect(
      screen.getByRole("textbox", { name: "Title" }).matches(":disabled"),
    ).toBe(true);
    expect(screen.getByText("Anna")).toBeTruthy();
    expect(screen.getByText("core.content.live.is_editing")).toBeTruthy();
  });

  it("stays editable when nobody holds it", () => {
    setup();

    expect(
      screen.getByRole("textbox", { name: "Title" }).matches(":disabled"),
    ).toBe(false);
    expect(screen.queryByText("core.content.live.is_editing")).toBeNull();
  });

  it("stays editable when the lock is the editor's own", () => {
    setup({ locks: [lockOf(ME, "Me")] });

    expect(
      screen.getByRole("textbox", { name: "Title" }).matches(":disabled"),
    ).toBe(false);
  });

  it("takes the lock on focus and gives it back once focus has left", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { live, lock } = setup();

    await act(async () => {
      fireEvent.focus(screen.getByRole("textbox", { name: "Title" }));
      await Promise.resolve();
    });
    expect(lock).toHaveBeenCalledWith("test.note", 7, {
      action: "acquire",
      field: "title",
      locale: null,
    });
    expect(live.session.focus).toHaveBeenCalledWith("title", null);

    await act(async () => {
      fireEvent.blur(screen.getByRole("textbox", { name: "Title" }), {
        relatedTarget: screen.getByRole("button", { name: "Elsewhere" }),
      });
      vi.advanceTimersByTime(CONTENT_FIELD_LOCK_BLUR_GRACE_MS);
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(lock).toHaveBeenLastCalledWith("test.note", 7, {
        action: "release",
        field: "title",
        locale: null,
      });
    });
    expect(live.autosave.flush).toHaveBeenCalled();
  });

  it("asks for no lock on a field someone else holds", () => {
    const { lock } = setup({ locks: [lockOf(ANNA, "Anna")] });

    fireEvent.focus(screen.getByRole("textbox", { name: "Title" }));

    expect(lock).not.toHaveBeenCalled();
  });

  it("shows another editor's autosaved value", () => {
    const { draftListeners, field } = setup({ locks: [lockOf(ANNA, "Anna")] });

    act(() => {
      for (const listener of draftListeners) {
        listener({
          by: { id: ANNA, name: "Anna" },
          locale: null,
          updatedAt: new Date().toISOString(),
          values: { title: "Hello from Anna" },
        });
      }
    });

    expect(field.onChange).toHaveBeenCalledWith("Hello from Anna");
  });

  it("ignores drafts for other fields and other languages", () => {
    const { draftListeners, field } = setup();

    act(() => {
      for (const listener of draftListeners) {
        listener({
          by: null,
          locale: null,
          updatedAt: new Date().toISOString(),
          values: { body: "Elsewhere" },
        });
        listener({
          by: null,
          locale: "pl",
          updatedAt: new Date().toISOString(),
          values: { title: "Cześć" },
        });
      }
    });

    expect(field.onChange).not.toHaveBeenCalled();
  });
});
