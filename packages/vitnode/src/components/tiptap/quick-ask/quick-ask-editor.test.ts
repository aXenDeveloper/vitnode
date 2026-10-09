// @vitest-environment jsdom
import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";

import {
  applyQuickAskResult,
  isQuickAskStale,
  quickAskTextToNodes,
  takeQuickAskSnapshot,
} from "./quick-ask-editor";

let editor: Editor | undefined;

const createEditor = (content: string) => {
  editor = new Editor({ content, extensions: [StarterKit] });

  return editor;
};

afterEach(() => {
  editor?.destroy();
  editor = undefined;
});

const selectText = (target: Editor, text: string) => {
  let found = { from: 0, to: 0 };
  target.state.doc.descendants((node, position) => {
    if (node.isText && node.text?.includes(text)) {
      const offset = node.text.indexOf(text);
      found = { from: position + offset, to: position + offset + text.length };
    }
  });
  target.commands.setTextSelection(found);
};

describe("Quick Ask in the editor", () => {
  it("sends the selection with bounded context, never the whole document", () => {
    const target = createEditor(
      `<p>${"a".repeat(5_000)} middle ${"b".repeat(5_000)}</p>`,
    );
    selectText(target, "middle");

    const snapshot = takeQuickAskSnapshot(target);

    expect(snapshot.selection).toBe("middle");
    expect(snapshot.before).toHaveLength(1_500);
    expect(snapshot.after).toHaveLength(1_500);
  });

  it("replaces the selection in one step that a single undo reverts", () => {
    const target = createEditor("<p>Hello brave new world</p>");
    selectText(target, "brave new");
    const { from, to } = takeQuickAskSnapshot(target);

    applyQuickAskResult(target, { from, mode: "replace", text: "small", to });
    expect(target.getHTML()).toBe("<p>Hello small world</p>");

    target.commands.undo();
    expect(target.getHTML()).toBe("<p>Hello brave new world</p>");
  });

  it("inserts below the selection's block, leaving it untouched", () => {
    const target = createEditor("<p>First.</p><p>Second.</p>");
    selectText(target, "First");
    const { from, to } = takeQuickAskSnapshot(target);

    applyQuickAskResult(target, {
      from,
      mode: "below",
      text: "Added one.\n\nAdded two.",
      to,
    });

    expect(target.getHTML()).toBe(
      "<p>First.</p><p>Added one.</p><p>Added two.</p><p>Second.</p>",
    );
  });

  it("never interprets model output as HTML", () => {
    expect(quickAskTextToNodes('<a href="x">hi</a><script>1</script>')).toEqual(
      [
        {
          content: [
            { text: '<a href="x">hi</a><script>1</script>', type: "text" },
          ],
          type: "paragraph",
        },
      ],
    );
  });

  it("notices when the selected text changed during generation", () => {
    const target = createEditor("<p>Hello brave new world</p>");
    selectText(target, "brave");
    const snapshot = takeQuickAskSnapshot(target);

    expect(isQuickAskStale(target, snapshot)).toBe(false);
    target.commands.insertContentAt(snapshot.from, "very ");
    expect(isQuickAskStale(target, snapshot)).toBe(true);
  });
});
