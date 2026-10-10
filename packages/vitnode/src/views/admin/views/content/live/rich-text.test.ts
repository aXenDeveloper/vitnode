import { describe, expect, it, vi } from "vitest";

import type { RichTextDocument } from "@/content/rich-text/document";

import { createContentRichTextRegistry } from "./rich-text";

const translated: RichTextDocument = {
  content: [{ content: [{ text: "Cześć", type: "text" }], type: "paragraph" }],
  type: "doc",
};

describe("createContentRichTextRegistry", () => {
  it("writes through the open editor of that field and language", () => {
    const registry = createContentRichTextRegistry();
    const english = { replace: vi.fn() };
    const polish = { replace: vi.fn() };
    registry.register("content", "en", english);
    registry.register("content", "pl", polish);

    registry.replace("content", "pl", translated);

    expect(polish.replace).toHaveBeenCalledWith(translated);
    expect(english.replace).not.toHaveBeenCalled();
  });

  it("keeps a document for an editor that is not open yet", () => {
    const registry = createContentRichTextRegistry();
    registry.replace("content", "pl", translated);
    const polish = { replace: vi.fn() };

    registry.register("content", "pl", polish);
    registry.register("content", "pl", polish);

    expect(polish.replace).toHaveBeenCalledTimes(1);
    expect(polish.replace).toHaveBeenCalledWith(translated);
  });

  it("forgets an editor once it closes, and tells subscribers", () => {
    const registry = createContentRichTextRegistry();
    const listener = vi.fn();
    registry.subscribe(listener);
    const editor = { replace: vi.fn() };

    const close = registry.register("content", null, editor);
    expect(registry.get("content", null)).toBe(editor);

    close();
    expect(registry.get("content", null)).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
