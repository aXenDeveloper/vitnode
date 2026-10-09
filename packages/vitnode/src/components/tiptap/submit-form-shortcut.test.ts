// @vitest-environment jsdom
import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SubmitFormShortcut } from "./submit-form-shortcut";

let editor: Editor | undefined;

afterEach(() => {
  editor?.destroy();
  editor = undefined;
  document.body.innerHTML = "";
});

const mountEditor = (parent: HTMLElement) => {
  const element = document.createElement("div");
  parent.append(element);
  editor = new Editor({
    element,
    extensions: [StarterKit, SubmitFormShortcut],
    content: "<p>Ready to ship</p>",
  });

  return editor;
};

describe("SubmitFormShortcut", () => {
  it("submits the surrounding form on Mod+Enter", () => {
    const form = document.createElement("form");
    document.body.append(form);
    const requestSubmit = vi
      .spyOn(form, "requestSubmit")
      .mockImplementation(() => undefined);

    const current = mountEditor(form);

    expect(current.commands.keyboardShortcut("Mod-Enter")).toBe(true);
    expect(requestSubmit).toHaveBeenCalledOnce();
    expect(current.getHTML()).toBe("<p>Ready to ship</p>");
  });

  it("leaves Mod+Enter to the editor when there is no form", () => {
    const current = mountEditor(document.body);

    expect(() => current.commands.keyboardShortcut("Mod-Enter")).not.toThrow();
  });
});
