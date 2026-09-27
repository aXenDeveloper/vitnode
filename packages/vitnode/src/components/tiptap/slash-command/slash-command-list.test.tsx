import type { SuggestionKeyDownProps } from "@tiptap/suggestion";

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { BLOCK_COMMANDS } from "../block-commands";
import {
  SlashCommandList,
  type SlashCommandListRef,
} from "./slash-command-list";

const keyDown = (key: string) =>
  ({ event: new KeyboardEvent("keydown", { key }) }) as SuggestionKeyDownProps;

const renderList = (query: string) => {
  const command = vi.fn();
  const ref = React.createRef<SlashCommandListRef>();
  const view = render(
    <SlashCommandList
      command={command}
      commands={BLOCK_COMMANDS}
      query={query}
      ref={ref}
    />,
  );

  return { command, ref, view };
};

describe("SlashCommandList", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("lists every block grouped under text, lists and insert", () => {
    renderList("");

    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getAllByRole("option")).toHaveLength(
      BLOCK_COMMANDS.length,
    );
    expect(
      within(listbox)
        .getAllByRole("group")
        .map(group => group.firstElementChild?.textContent),
    ).toEqual([
      "core.global.editor.blocks.groups.text",
      "core.global.editor.blocks.groups.lists",
      "core.global.editor.blocks.groups.insert",
    ]);
  });

  it("narrows the list to blocks whose keywords match the query", () => {
    renderList("pan");

    expect(
      screen.getAllByRole("option").map(option => option.textContent),
    ).toEqual([
      "core.global.editor.blocks.panel_info.titlecore.global.editor.blocks.panel_info.hint",
      "core.global.editor.blocks.panel_warning.titlecore.global.editor.blocks.panel_warning.hint",
      "core.global.editor.blocks.panel_success.titlecore.global.editor.blocks.panel_success.hint",
      "core.global.editor.blocks.panel_error.titlecore.global.editor.blocks.panel_error.hint",
    ]);
  });

  it("explains an empty result and lets Enter fall through", () => {
    const { ref } = renderList("zzz");

    expect(screen.getByText("core.global.editor.blocks.empty")).toBeTruthy();
    expect(ref.current?.onKeyDown(keyDown("Enter"))).toBe(false);
  });

  it("runs the highlighted block after arrowing down", () => {
    const { command, ref } = renderList("list");

    act(() => {
      ref.current?.onKeyDown(keyDown("ArrowDown"));
    });
    expect(screen.getAllByRole("option")[1].getAttribute("aria-selected")).toBe(
      "true",
    );

    act(() => {
      ref.current?.onKeyDown(keyDown("Enter"));
    });
    expect(command).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ordered_list" }),
    );
  });

  it("runs a block on click", () => {
    const { command } = renderList("table");

    fireEvent.click(screen.getByRole("option"));

    expect(command).toHaveBeenCalledWith(
      expect.objectContaining({ id: "table" }),
    );
  });
});
