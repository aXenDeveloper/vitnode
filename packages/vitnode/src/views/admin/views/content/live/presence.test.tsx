// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ContentFormSpec } from "@/content/admin/spec";
import type { ContentLiveMember } from "@/content/live/protocol";

import type { ContentLiveContextValue } from "./context";

import { ContentLiveContext } from "./context";
import {
  ContentLiveFieldPresence,
  ContentLiveLanguagePresence,
  ContentLivePresence,
} from "./presence";
import { createContentRichTextRegistry } from "./rich-text";

const spec: ContentFormSpec = {
  contentTypeId: "test.note",
  defaultLocale: "en",
  editorial: true,
  fields: [
    {
      kind: "text",
      label: "Title",
      localized: true,
      name: "title",
      nullable: false,
      required: true,
    },
    {
      kind: "relation",
      label: "Category",
      name: "categoryId",
      nullable: true,
      required: false,
    },
  ],
  permissionModule: "notes",
  pluginId: "@vitnode/example",
  sections: [],
  titleField: "title",
};

let nextUser = 10;
const member = (
  name: string,
  overrides: Partial<ContentLiveMember> = {},
): ContentLiveMember => {
  nextUser += 1;

  return {
    avatarColor: "2563eb",
    clientId: `${name}-tab`,
    field: null,
    locale: "en",
    name,
    nameCode: name,
    userId: nextUser,
    ...overrides,
  };
};

const ME: ContentLiveMember = {
  avatarColor: null,
  clientId: "my-tab",
  field: "title",
  locale: "en",
  name: "Me",
  nameCode: "Me",
  userId: 1,
};

const renderLive = (
  ui: React.ReactNode,
  { live = true, members }: { live?: boolean; members: ContentLiveMember[] },
) => {
  const value: ContentLiveContextValue = {
    autosave: { flush: vi.fn(), queue: vi.fn() },
    coEditing: live,
    discard: vi.fn(),
    itemId: 7,
    locale: "en",
    reloadDrafts: vi.fn(),
    richText: createContentRichTextRegistry(),
    session: {
      clientId: ME.clientId,
      focus: vi.fn(),
      live,
      locks: [],
      members: [ME, ...members],
      onCommitted: () => () => {},
      onDraft: () => () => {},
      onReset: () => () => {},
      readDrafts: async () => await Promise.resolve(null),
      readyState: live ? 1 : 3,
      refreshLocks: vi.fn(),
      rememberSelf: vi.fn(),
      resetLocally: vi.fn(),
      self: ME.userId,
    },
    spec,
    status: { dirty: false, failed: false, savedAt: null, saving: false },
  };

  return render(<ContentLiveContext value={value}>{ui}</ContentLiveContext>);
};

describe("ContentLivePresence", () => {
  it("shows everyone else in the record, with where they are", () => {
    renderLive(<ContentLivePresence />, {
      members: [
        member("Anna", { field: "title", locale: "pl" }),
        member("Ben", { field: "categoryId" }),
        member("Cleo"),
      ],
    });

    const group = screen.getByRole("group", {
      name: "core.content.live.presence.label",
    });
    expect(
      within(group)
        .getAllByRole("img")
        .map(image => image.getAttribute("alt")),
    ).toEqual(["Anna", "Ben", "Cleo"]);
    expect(
      within(group).getByText("core.content.live.presence.editing_field"),
    ).toBeTruthy();
    expect(
      within(group).getByText("core.content.live.presence.editing_shared"),
    ).toBeTruthy();
    expect(
      within(group).getByText("core.content.live.presence.in_language"),
    ).toBeTruthy();
    expect(screen.queryByRole("img", { name: "Me" })).toBeNull();
  });

  it("shows a person with two tabs once, where they are typing", () => {
    const anna = member("Anna");
    renderLive(<ContentLivePresence />, {
      members: [
        anna,
        { ...anna, clientId: "anna-second-tab", field: "title" },
        { ...ME, clientId: "my-other-tab" },
      ],
    });

    expect(
      screen.getAllByRole("img").map(image => image.getAttribute("alt")),
    ).toEqual(["Anna"]);
    expect(
      screen.getByText("core.content.live.presence.editing_field"),
    ).toBeTruthy();
  });

  it("folds everyone past the limit into +N", () => {
    renderLive(<ContentLivePresence max={2} />, {
      members: ["Anna", "Ben", "Cleo", "Dan"].map(name => member(name)),
    });

    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getByText("+2")).toBeTruthy();
    expect(screen.getByText("core.content.live.presence.more")).toBeTruthy();
  });

  it("renders nothing when the editor is alone or the form is not live", () => {
    const { container } = renderLive(<ContentLivePresence />, { members: [] });
    expect(container.childElementCount).toBe(0);

    const offline = renderLive(<ContentLivePresence />, {
      live: false,
      members: [member("Anna")],
    });
    expect(offline.container.childElementCount).toBe(0);
  });
});

describe("ContentLiveFieldPresence", () => {
  const members = [
    member("Anna", { field: "title", locale: "pl" }),
    member("Ben", { field: "title", locale: "en" }),
    member("Cleo", { field: "categoryId", locale: "pl" }),
    member("Dan", { field: null, locale: "pl" }),
  ];

  it("shows the people in the field, in the language shown", () => {
    renderLive(<ContentLiveFieldPresence field="title" locale="pl" />, {
      members,
    });

    expect(screen.getByTitle("Anna")).toBeTruthy();
    expect(screen.queryByTitle("Ben")).toBeNull();
    expect(screen.queryByTitle("Cleo")).toBeNull();
    expect(screen.getByText("core.content.live.presence.field")).toBeTruthy();
  });

  it("counts every language for a shared field", () => {
    renderLive(<ContentLiveFieldPresence field="categoryId" locale={null} />, {
      members,
    });

    expect(screen.getByTitle("Cleo")).toBeTruthy();
    expect(screen.queryByTitle("Anna")).toBeNull();
  });

  it("leaves the announcement to the field when decorative", () => {
    renderLive(
      <ContentLiveFieldPresence decorative field="title" locale="en" />,
      { members },
    );

    expect(screen.getByTitle("Ben")).toBeTruthy();
    expect(screen.queryByText("core.content.live.presence.field")).toBeNull();
  });
});

describe("ContentLiveLanguagePresence", () => {
  it("shows who works in a language, whichever field they are in", () => {
    renderLive(<ContentLiveLanguagePresence locale="pl" />, {
      members: [
        member("Anna", { field: "title", locale: "pl" }),
        member("Ben", { locale: "en" }),
        member("Dan", { field: null, locale: "pl" }),
      ],
    });

    expect(screen.getByTitle("Anna")).toBeTruthy();
    expect(screen.getByTitle("Dan")).toBeTruthy();
    expect(screen.queryByTitle("Ben")).toBeNull();
    expect(
      screen.getByText("core.content.live.presence.language"),
    ).toBeTruthy();
  });

  it("narrows to one field when asked", () => {
    renderLive(<ContentLiveLanguagePresence field="title" locale="pl" />, {
      members: [
        member("Anna", { field: "title", locale: "pl" }),
        member("Dan", { field: null, locale: "pl" }),
      ],
    });

    expect(screen.getByTitle("Anna")).toBeTruthy();
    expect(screen.queryByTitle("Dan")).toBeNull();
  });

  it("renders nothing for an empty language", () => {
    const { container } = renderLive(
      <ContentLiveLanguagePresence locale="de" />,
      { members: [member("Anna", { locale: "pl" })] },
    );

    expect(container.childElementCount).toBe(0);
  });
});
