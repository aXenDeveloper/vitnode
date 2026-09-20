import { render, type RenderResult, screen } from "@testing-library/react";
import { act, type ReactNode, useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

import type { BlockComponentProps, BlockData, ContentNode } from "./types";

import { defineEditablePage } from "../content/editor/define";
import { field } from "../content/fields";
import { defineBlock } from "./define";
import { useEditWidgets } from "./edit-widgets-context";
import { EditWidgetsHost } from "./edit-widgets-host";
import { EDITOR_SHELL_TRANSITION_MS } from "./editor-shell";
import { EditablePage } from "./page";
import { createBlockRegistry } from "./registry";
import { ContentZone } from "./zone";

/**
 * Stands in for the real editor, which asks the site for its room itself rather
 * than leaving it to the seam that loads it - see `editor/root.tsx`, and the
 * contract test beside it that holds that where it belongs.
 */
vi.mock("../editor/root", () => {
  const EditorRootStub = ({ closing }: { closing: boolean }) => {
    const setShell = useEditWidgets()?.setShell;

    useEffect(() => {
      if (!setShell) return;

      setShell(closing ? null : "editing");

      return () => {
        setShell(null);
      };
    }, [closing, setShell]);

    return <span>editor open</span>;
  };

  return { default: EditorRootStub };
});

const textFields = { heading: field.text({ maxLength: 40, required: true }) };

const Text = ({ data }: BlockComponentProps<BlockData<typeof textFields>>) => (
  <p>{data.heading}</p>
);

const registry = createBlockRegistry([
  {
    blocks: [defineBlock({ component: Text, fields: textFields, id: "text" })],
    namespace: "core",
    pluginId: "@vitnode/core",
  },
]);

const page = defineEditablePage({
  id: "example:settings",
  permission: { module: "widgets", permission: "can_edit" },
  zones: { main: { allowed: ["core:text"], max: 4 } },
});

const other = defineEditablePage({
  id: "example:other",
  permission: { module: "widgets", permission: "can_edit" },
  zones: { main: { allowed: ["core:text"], max: 4 } },
});

const stored: ContentNode = {
  data: { heading: "Stored" },
  id: "s1",
  type: "core:text",
};

const layout = {
  pageId: page.id,
  updatedAt: null,
  zones: { main: [stored] },
};

/** Stands in for the Edit widgets entry in the user menu, up in the header. */
const UserMenu = () => {
  const control = useEditWidgets();

  if (control === null) return <span>no offer</span>;

  if (control.editing) {
    return (
      <button
        onClick={() => {
          control.stop();
        }}
        type="button"
      >
        Finish editing
      </button>
    );
  }

  if (control.offer?.canEdit !== true) return <span>no offer</span>;

  return (
    <button
      onClick={() => {
        control.start();
      }}
      type="button"
    >
      Edit widgets
    </button>
  );
};

const site = (children: ReactNode) => (
  <EditWidgetsHost>
    <UserMenu />
    {children}
  </EditWidgetsHost>
);

const editablePage = (canEdit: boolean, openEditing?: boolean) => (
  <EditablePage
    canEdit={canEdit}
    layout={layout}
    openEditing={openEditing}
    page={page}
  >
    <ContentZone id="main" registry={registry} />
  </EditablePage>
);

const settled = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
};

const editWidgets = () => screen.getByRole("button", { name: "Edit widgets" });

const open = async (): Promise<void> => {
  act(() => {
    editWidgets().click();
  });

  await settled();
};

const editorIsOpen = (): boolean => screen.queryByText("editor open") !== null;

/** Walks off the editable page, which takes the editor with it. */
const leave = async (view: RenderResult): Promise<void> => {
  view.rerender(site(<p>An ordinary page</p>));
  await settled();
};

/** Waits out the sidebar's slide back off screen, after which the editor unmounts. */
const slidOut = async (): Promise<void> => {
  await act(async () => {
    await new Promise(resolve => {
      setTimeout(resolve, EDITOR_SHELL_TRANSITION_MS + 50);
    });
  });
};

const shell = (container: HTMLElement): HTMLElement => {
  const host = container.firstElementChild;

  if (!(host instanceof HTMLElement)) {
    throw new Error("the site shell never rendered");
  }

  return host;
};

describe("the Edit widgets action the header offers", () => {
  it("is offered by an editable page the visitor may edit", async () => {
    render(site(editablePage(true)));
    await settled();

    expect(editWidgets()).toBeTruthy();
  });

  it("is not offered when the page says the visitor may not edit it", async () => {
    render(site(editablePage(false)));
    await settled();

    expect(screen.getByText("no offer")).toBeTruthy();
  });

  it("is not offered on a page that declares no zones at all", async () => {
    render(site(<p>An ordinary page</p>));
    await settled();

    expect(screen.getByText("no offer")).toBeTruthy();
  });

  it("opens the editor on the page that offered it", async () => {
    render(site(editablePage(true)));
    await settled();
    await open();

    expect(editorIsOpen()).toBe(true);
    expect(screen.getByRole("button", { name: "Finish editing" })).toBeTruthy();
  });

  it("opens the editor on arrival when the page was asked to and may", async () => {
    render(site(editablePage(true, true)));
    await settled();

    expect(editorIsOpen()).toBe(true);
  });

  it("stays shut on arrival when the page may not be edited", async () => {
    render(site(editablePage(false, true)));
    await settled();

    expect(editorIsOpen()).toBe(false);
  });
});

describe("walking away from the page being edited", () => {
  it("takes the offer with it, so the header stops offering one", async () => {
    const view = render(site(editablePage(true)));
    await settled();
    await open();
    await leave(view);

    expect(editorIsOpen()).toBe(false);
    expect(screen.getByText("no offer")).toBeTruthy();
  });

  it("does not reopen the editor when the same page is visited again", async () => {
    const view = render(site(editablePage(true)));
    await settled();
    await open();
    await leave(view);

    view.rerender(site(editablePage(true)));
    await settled();

    expect(editorIsOpen()).toBe(false);
    expect(editWidgets()).toBeTruthy();
  });

  it("never opens the editor on a page other than the one that started it", async () => {
    const view = render(site(editablePage(true)));
    await settled();
    await open();
    await leave(view);

    view.rerender(
      site(
        <EditablePage canEdit page={other}>
          <ContentZone id="main" registry={registry} />
        </EditablePage>,
      ),
    );
    await settled();

    expect(editorIsOpen()).toBe(false);
  });
});

describe("the room the site leaves the editing sidebar", () => {
  const reserved = (container: HTMLElement): boolean =>
    shell(container).className.includes("md:pe-(--editor-sidebar-width)");

  it("takes none of it while nobody is editing", async () => {
    const { container } = render(site(editablePage(true)));
    await settled();

    expect(reserved(container)).toBe(false);
    expect(shell(container).className).toContain("transition-[padding]");
  });

  it("reserves the sidebar's width from the whole site once editing opens", async () => {
    const { container } = render(site(editablePage(true)));
    await settled();
    await open();

    expect(reserved(container)).toBe(true);
    expect(shell(container).className).toContain("pb-(--editor-sheet-height)");
  });

  it("keeps the box it pads, so both directions are a transition and not a jump", async () => {
    const { container } = render(site(editablePage(true)));
    await settled();

    const before = shell(container);

    await open();

    expect(shell(container)).toBe(before);
    expect(before.style.display).toBe("");
    expect(before.className).toContain("transition-[padding]");
  });

  it("gives it back the moment editing ends, and keeps the sidebar until it has slid out", async () => {
    const { container } = render(site(editablePage(true)));
    await settled();
    await open();

    act(() => {
      screen.getByRole("button", { name: "Finish editing" }).click();
    });
    await settled();

    expect(reserved(container)).toBe(false);
    expect(shell(container).className).toContain("transition-[padding]");
    expect(editorIsOpen()).toBe(true);

    await slidOut();

    expect(editorIsOpen()).toBe(false);
    expect(editWidgets()).toBeTruthy();
  });
});
