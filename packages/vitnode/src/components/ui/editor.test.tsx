import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  onUpdate: undefined as
    ((props: { editor: { getHTML: () => string } }) => void) | undefined,
}));

vi.mock("@tiptap/react", () => ({
  EditorContent: () => null,
  useEditor: (config: {
    onUpdate?: (props: { editor: { getHTML: () => string } }) => void;
  }) => {
    hoisted.onUpdate = config.onUpdate;

    return { getHTML: () => "<p>from-editor</p>" };
  },
}));

vi.mock("@/components/tiptap/toolbar/tiptap-toolbar", () => ({
  TipTapToolbar: () => null,
}));

import { Editor } from "./editor";

describe("Editor", () => {
  it("merges a custom className onto the wrapper", () => {
    const { container } = render(
      <Editor className="my-editor" value="<p>x</p>" />,
    );
    const wrapper = container.firstChild as HTMLElement;

    expect(wrapper.classList.contains("my-editor")).toBe(true);
    // Regression: the class list must not contain the literal "className" key.
    expect(wrapper.classList.contains("className")).toBe(false);
  });

  it("emits the current html through onChange on update", () => {
    const onChange = vi.fn();
    render(<Editor onChange={onChange} value="<p>x</p>" />);

    hoisted.onUpdate?.({ editor: { getHTML: () => "<p>changed</p>" } });

    expect(onChange).toHaveBeenCalledWith("<p>changed</p>");
  });
});
