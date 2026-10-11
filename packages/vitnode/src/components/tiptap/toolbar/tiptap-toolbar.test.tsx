import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Editor } from "@tiptap/react";
import { afterEach, describe, expect, it } from "vitest";

import { createTipTapExtensions } from "../extension";
import { TipTapToolbar } from "./tiptap-toolbar";

let editor: Editor | undefined;

const renderToolbar = (content: string) => {
  editor = new Editor({
    element: document.createElement("div"),
    extensions: createTipTapExtensions(),
    content,
  });
  editor.commands.setTextSelection(3);
  render(<TipTapToolbar editor={editor} />);

  return editor;
};

const openMenu = async (label: string) => {
  fireEvent.click(screen.getByRole("button", { name: label }));

  return await screen.findByRole("menu");
};

afterEach(() => {
  cleanup();
  editor?.destroy();
  editor = undefined;
});

describe("TipTapToolbar", () => {
  it("wraps the current block in an info panel from the insert menu", async () => {
    const current = renderToolbar("<p>Rollback is ready</p>");

    const menu = await openMenu("core.global.editor.insert.label");
    fireEvent.click(
      within(menu).getByRole("menuitem", {
        name: /core\.global\.editor\.blocks\.panel_info\.title/,
      }),
    );

    await waitFor(() => {
      expect(current.getHTML()).toContain(
        '<div data-panel="info" class="tiptap-panel"><p>Rollback is ready</p></div>',
      );
    });
  });

  it("turns the paragraph into a task list", () => {
    const current = renderToolbar("<p>Add alerting</p>");

    fireEvent.click(
      screen.getByRole("button", { name: "core.global.editor.task_list" }),
    );

    expect(current.getHTML()).toContain('data-type="taskList"');
    expect(
      screen
        .getByRole("button", { name: "core.global.editor.task_list" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("clears marks from the more formatting menu", async () => {
    const current = renderToolbar("<p><strong><u>Loud</u></strong></p>");
    current.commands.selectAll();

    const menu = await openMenu("core.global.editor.text_format_more.label");
    fireEvent.click(
      within(menu).getByRole("menuitem", {
        name: "core.global.editor.text_format_more.clear",
      }),
    );

    await waitFor(() => {
      expect(current.getHTML()).toBe("<p>Loud</p>");
    });
  });

  it("is one tab stop, walked with the arrow keys, Home and End", () => {
    renderToolbar("<p>Ship it</p>");
    const toolbar = screen.getByRole("toolbar");
    const items = within(toolbar).getAllByRole("button");
    const tabbable = () => items.filter(item => item.tabIndex === 0);
    const last = items[items.length - 1];

    expect(tabbable()).toEqual([items[0]]);

    items[0].focus();
    fireEvent.keyDown(items[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(items[1]);
    expect(tabbable()).toEqual([items[1]]);

    fireEvent.keyDown(items[1], { key: "End" });
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(last, { key: "ArrowRight" });
    expect(document.activeElement).toBe(items[0]);

    fireEvent.keyDown(items[0], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(last, { key: "Home" });
    expect(document.activeElement).toBe(items[0]);
  });
});
