// @vitest-environment jsdom
import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";

import { Panel, togglePanel } from "./panel";

let editor: Editor | undefined;

const createEditor = (content: string) => {
  editor = new Editor({
    element: document.createElement("div"),
    extensions: [StarterKit.configure({ trailingNode: false }), Panel],
    content,
  });

  return editor;
};

afterEach(() => {
  editor?.destroy();
  editor = undefined;
});

describe("Panel", () => {
  it("keeps the kind of a stored panel", () => {
    const current = createEditor(
      '<div data-panel="success"><p>Deployed</p></div>',
    );

    expect(current.getHTML()).toBe(
      '<div data-panel="success" class="tiptap-panel"><p>Deployed</p></div>',
    );
  });

  it("falls back to an info panel for an unknown kind", () => {
    const current = createEditor('<div data-panel="purple"><p>Note</p></div>');

    expect(current.getHTML()).toContain('data-panel="info"');
  });

  it("wraps the paragraph, switches the kind, then unwraps on the same kind", () => {
    const current = createEditor("<p>Rollback is ready</p>");
    current.commands.setTextSelection(3);

    togglePanel(current, "info");
    expect(current.getHTML()).toBe(
      '<div data-panel="info" class="tiptap-panel"><p>Rollback is ready</p></div>',
    );

    togglePanel(current, "warning");
    expect(current.getHTML()).toBe(
      '<div data-panel="warning" class="tiptap-panel"><p>Rollback is ready</p></div>',
    );

    togglePanel(current, "warning");
    expect(current.getHTML()).toBe("<p>Rollback is ready</p>");
  });
});
