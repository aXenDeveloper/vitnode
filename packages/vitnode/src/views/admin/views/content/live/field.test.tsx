// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnyFormFieldApi } from "@/components/form/auto-form";
import type {
  ContentFormFieldSpec,
  ContentFormSpec,
} from "@/content/admin/spec";
import type {
  ContentFieldLock,
  ContentLiveMember,
} from "@/content/live/protocol";

import { useMultiLangField } from "@/components/form/fields/multi-lang";
import { MultiLangPresenceContext } from "@/components/form/fields/multi-lang-presence";
import { LanguagesProvider } from "@/components/languages-provider";
import { EditorCollaborationContext } from "@/components/tiptap/collaboration";

import type { ContentFormTransport } from "../form/transport";
import type { ContentLiveContextValue } from "./context";
import type { ContentLiveDraftEvent, ContentLiveSession } from "./use-session";

import { ContentFormTransportProvider } from "../form/transport";
import { ContentLiveContext } from "./context";
import { CONTENT_FIELD_LOCK_BLUR_GRACE_MS, ContentLiveField } from "./field";
import { createContentRichTextRegistry } from "./rich-text";

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

const languages = [
  { code: "en", name: "English" },
  { code: "pl", name: "Polski" },
];

const localizedTitle: ContentFormFieldSpec = { ...fieldSpec, localized: true };

const content: ContentFormFieldSpec = {
  kind: "richText",
  label: "Content",
  localized: true,
  name: "content",
  nullable: false,
  required: true,
};

const memberOf = (
  userId: number,
  name: string,
  where: Pick<ContentLiveMember, "field" | "locale">,
): ContentLiveMember => ({
  avatarColor: "2563eb",
  clientId: `${name}-tab`,
  name,
  nameCode: name,
  userId,
  ...where,
});

const EditorProbe = () =>
  React.use(EditorCollaborationContext) ? (
    <p>shared editor</p>
  ) : (
    <p>local editor</p>
  );

/** A localized text field with its own language switcher, as buttons. */
const SwitchableTitle = () => {
  const { currentValue, selected, setSelected } = useMultiLangField({
    name: "title",
    onBlur: () => undefined,
    onChange: () => undefined,
    value: [
      { languageCode: "en", value: "Hello" },
      { languageCode: "pl", value: "Cześć" },
    ],
  });
  const presence = React.use(MultiLangPresenceContext);

  return (
    <>
      {languages.map(language => (
        <button
          aria-pressed={selected === language.code}
          key={language.code}
          onClick={() => {
            setSelected(language.code);
          }}
          type="button"
        >
          {language.name}
          {presence?.busy(language.code) ? " (busy)" : null}
          {presence?.marker(language.code)}
        </button>
      ))}
      <input aria-label="Title" readOnly value={currentValue} />
    </>
  );
};

const lockOf = (userId: number, name: string): ContentFieldLock => ({
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  field: "title",
  locale: null,
  user: { id: userId, name },
});

const setup = ({
  children = <input aria-label="Title" defaultValue="Hello" />,
  coEditing = false,
  locks = [],
  members = [],
  target = fieldSpec,
  value = "Hello",
}: {
  children?: React.ReactNode;
  coEditing?: boolean;
  locks?: ContentFieldLock[];
  members?: ContentLiveMember[];
  target?: ContentFormFieldSpec;
  value?: unknown;
} = {}) => {
  const draftListeners = new Set<(event: ContentLiveDraftEvent) => void>();
  const session: ContentLiveSession = {
    clientId: "tab-1",
    focus: vi.fn(),
    live: coEditing,
    locks,
    members,
    onCommitted: () => () => {},
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
    coEditing,
    itemId: 7,
    locale: target.localized === true ? "en" : null,
    reloadDrafts: vi.fn(async () => {
      await Promise.resolve();
    }),
    richText: createContentRichTextRegistry(),
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
    name: target.name,
    onBlur: vi.fn(),
    onChange: vi.fn(),
    value,
  };

  const view = render(
    <ContentFormTransportProvider value={transport}>
      <LanguagesProvider languages={languages}>
        <ContentLiveContext value={live}>
          <ContentLiveField field={field} fieldSpec={target}>
            {children}
          </ContentLiveField>
          <button type="button">Elsewhere</button>
        </ContentLiveContext>
      </LanguagesProvider>
    </ContentFormTransportProvider>,
  );

  return { draftListeners, field, live, lock, view };
};

const outlineTags = () =>
  [...document.querySelectorAll('[data-slot="content-live-tag"]')].map(
    tag => tag.textContent,
  );

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
    expect(outlineTags()).toEqual(["Anna"]);
  });

  it("stays editable when nobody holds it", () => {
    setup();

    expect(
      screen.getByRole("textbox", { name: "Title" }).matches(":disabled"),
    ).toBe(false);
    expect(outlineTags()).toEqual([]);
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

  it("locks the language its switcher shows, and moves the lock with it", async () => {
    const { live, lock } = setup({
      children: <SwitchableTitle />,
      target: localizedTitle,
    });

    fireEvent.click(screen.getByRole("button", { name: "Polski" }));
    await act(async () => {
      fireEvent.focus(screen.getByRole("textbox", { name: "Title" }));
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(lock).toHaveBeenCalledWith("test.note", 7, {
        action: "acquire",
        field: "title",
        locale: "pl",
      });
    });
    expect(live.session.focus).toHaveBeenLastCalledWith("title", "pl");

    // Still in the field, the editor switches back to English.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "English" }));
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(lock).toHaveBeenCalledWith("test.note", 7, {
        action: "release",
        field: "title",
        locale: "pl",
      });
    });
    await vi.waitFor(() => {
      expect(lock).toHaveBeenLastCalledWith("test.note", 7, {
        action: "acquire",
        field: "title",
        locale: "en",
      });
    });
  });

  it("outlines the field with who else is in it, in the language shown", async () => {
    setup({
      children: <SwitchableTitle />,
      coEditing: true,
      members: [
        memberOf(ANNA, "Anna", { field: "title", locale: "pl" }),
        memberOf(3, "Ben", { field: "title", locale: "en" }),
      ],
      target: localizedTitle,
    });

    expect(outlineTags()).toEqual(["Ben"]);
    expect(
      screen.getByRole("group", {
        description: "core.content.live.presence.field",
      }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Polski/ }));

    await waitFor(() => {
      expect(outlineTags()).toEqual(["Anna"]);
    });
  });

  it("draws no outline around co-edited rich text", () => {
    setup({
      children: <EditorProbe />,
      coEditing: true,
      members: [memberOf(ANNA, "Anna", { field: "content", locale: "en" })],
      target: content,
      value: [{ languageCode: "en", value: { type: "doc" } }],
    });

    expect(screen.getByText("shared editor")).toBeTruthy();
    expect(outlineTags()).toEqual([]);
  });

  it("marks the languages someone else is editing on the switcher", () => {
    setup({
      children: <SwitchableTitle />,
      coEditing: true,
      members: [memberOf(ANNA, "Anna", { field: "title", locale: "pl" })],
      target: localizedTitle,
    });

    const polish = screen.getByRole("button", { name: /Polski/ });
    expect(polish.textContent).toContain("(busy)");
    expect(within(polish).getByTitle("Anna")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /English/ }).textContent,
    ).not.toContain("(busy)");
  });

  it("co-edits rich text: no lock, no draft autosave, the shared editor", async () => {
    const { draftListeners, field, live, lock, view } = setup({
      children: (
        <>
          <EditorProbe />
          <input aria-label="Content" />
        </>
      ),
      coEditing: true,
      target: content,
      value: [{ languageCode: "en", value: { type: "doc" } }],
    });

    expect(screen.getByText("shared editor")).toBeTruthy();

    await act(async () => {
      fireEvent.focus(screen.getByRole("textbox", { name: "Content" }));
      await Promise.resolve();
    });
    expect(lock).not.toHaveBeenCalled();
    expect(live.session.focus).toHaveBeenCalledWith("content", "en");

    // Someone's autosaved draft never lands in a co-edited document.
    act(() => {
      for (const listener of draftListeners) {
        listener({
          by: { id: ANNA, name: "Anna" },
          locale: "en",
          updatedAt: new Date().toISOString(),
          values: { content: { content: [], type: "doc" } },
        });
      }
    });
    expect(field.onChange).not.toHaveBeenCalled();
    view.unmount();
    expect(live.autosave.queue).not.toHaveBeenCalled();
  });

  it("keeps the local editor for rich text without a socket", () => {
    setup({ children: <EditorProbe />, target: content, value: [] });

    expect(screen.getByText("local editor")).toBeTruthy();
  });
});
