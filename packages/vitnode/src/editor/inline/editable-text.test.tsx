import { fireEvent, render, screen } from "@testing-library/react";
import { type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { AnyBlockInstance, BlockUnknownData } from "../../blocks/types";
import type { VisualEditorContextValue } from "../context";
import type { EditorNodeRef, VisualEditorAction } from "../state/types";
import type { EditorInlineBlockValue } from "./context";

import { defineBlock } from "../../blocks/define";
import { createBlockRegistry } from "../../blocks/registry";
import { field } from "../../content/fields";
import { VisualEditorContext } from "../context";
import { initialVisualEditorState } from "../state/reducer";
import { EditorInlineBlockContext } from "./context";
import { InlineEditableText } from "./editable-text";
import { inlineFieldText } from "./state";

vi.mock("use-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

const fields = {
  body: field.textarea(),
  count: field.number({ integer: true }),
  title: field.text({ required: true }),
};

const registry = createBlockRegistry([
  {
    pluginId: "@vitnode/core",
    namespace: "core",
    blocks: [defineBlock({ component: () => null, fields, id: "card" })],
  },
]);

const definition = registry.get("core:card")?.definition;

const NODE_ID = "01JSINLINETESTBLOCK000001";

const nodeRef: EditorNodeRef = {
  areaId: null,
  kind: "block",
  nodeId: NODE_ID,
  zoneId: "main",
};

const update = (data: BlockUnknownData): VisualEditorAction => ({
  data,
  ref: nodeRef,
  remove: [],
  type: "update",
});

interface ProvidersProps {
  children: ReactNode;
  data: BlockUnknownData;
  dispatch: (action: VisualEditorAction) => void;
}

const Providers = ({
  children,
  data,
  dispatch,
}: ProvidersProps): ReactElement => {
  const instance: AnyBlockInstance = { data, id: NODE_ID, type: "core:card" };

  const editor = {
    dispatch,
    preview: false,
    state: initialVisualEditorState,
  } as unknown as VisualEditorContextValue;

  const inline: EditorInlineBlockValue = {
    definition,
    hasInlineFields: true,
    instance,
    nodeRef,
    registerField: () => () => undefined,
  };

  return (
    <VisualEditorContext value={editor}>
      <EditorInlineBlockContext value={inline}>
        {children}
      </EditorInlineBlockContext>
    </VisualEditorContext>
  );
};

interface HarnessProps {
  child?: ReactElement;
  data: BlockUnknownData;
  dispatch?: (action: VisualEditorAction) => void;
  name?: string;
}

const Harness = ({
  child,
  data,
  dispatch = () => undefined,
  name = "title",
}: HarnessProps): ReactElement => (
  <Providers data={data} dispatch={dispatch}>
    <InlineEditableText name={name}>
      {child ?? <h1 className="text-3xl">{inlineFieldText(data, name)}</h1>}
    </InlineEditableText>
  </Providers>
);

describe("the element an inline field turns into", () => {
  it("is the block's own element, with its classes and no wrapper around it", () => {
    const { container } = render(<Harness data={{ title: "Hello" }} />);
    const element = screen.getByRole("textbox");

    expect(container.firstElementChild).toBe(element);
    expect(element.tagName).toBe("H1");
    expect(element.className).toContain("text-3xl");
    expect(element.textContent).toBe("Hello");
  });

  it("says it is an editable single-line textbox with a name", () => {
    render(<Harness data={{ title: "Hello" }} />);
    const element = screen.getByRole("textbox");

    expect(element.getAttribute("contenteditable")).toBe("plaintext-only");
    expect(element.getAttribute("aria-multiline")).toBe("false");
    expect(element.getAttribute("aria-label")).toBe("inline.label");
    expect(element.getAttribute("data-vitnode-inline-field")).toBe("title");
    expect(element.tabIndex).toBe(0);
  });

  it("says it is multiline for a textarea field", () => {
    render(<Harness data={{ body: "Line" }} name="body" />);

    expect(screen.getByRole("textbox").getAttribute("aria-multiline")).toBe(
      "true",
    );
  });

  it("leaves a field that cannot be typed into exactly as the block drew it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(<Harness child={<p>3</p>} data={{ count: 3 }} name="count" />);

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("3").hasAttribute("contenteditable")).toBe(false);

    warn.mockRestore();
  });
});

describe("what an inline field commits while it is edited", () => {
  it("dispatches the text the element now holds", () => {
    const dispatch = vi.fn();

    render(<Harness data={{ title: "Hello" }} dispatch={dispatch} />);

    const element = screen.getByRole("textbox");

    element.textContent = "Hello there";
    fireEvent.input(element);

    expect(dispatch).toHaveBeenCalledWith(update({ title: "Hello there" }));
  });

  it("ends a text field on Enter instead of breaking the line", () => {
    const dispatch = vi.fn();

    render(<Harness data={{ title: "Hello" }} dispatch={dispatch} />);

    const element = screen.getByRole("textbox");
    const notPrevented = fireEvent.keyDown(element, { key: "Enter" });

    expect(notPrevented).toBe(false);
    expect(element.textContent).toBe("Hello");
    expect(dispatch).toHaveBeenCalledWith(update({ title: "Hello" }));
  });

  it("lets a textarea field keep Enter for itself", () => {
    render(<Harness data={{ body: "Line" }} name="body" />);

    expect(
      fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" }),
    ).toBe(true);
  });

  it("pastes plain text and never the clipboard's HTML", () => {
    const dispatch = vi.fn();

    render(<Harness data={{ title: "" }} dispatch={dispatch} />);

    const element = screen.getByRole("textbox");

    fireEvent.paste(element, {
      clipboardData: {
        getData: (format: string) =>
          format === "text/plain" ? "Hello\nthere" : "<strong>Hello</strong>",
      },
    });

    expect(dispatch).toHaveBeenCalledWith(update({ title: "Hello there" }));
    expect(element.innerHTML).toBe("Hello there");
  });

  it("puts this field back where the interaction found it on Escape", () => {
    const dispatch = vi.fn();

    render(<Harness data={{ title: "Original" }} dispatch={dispatch} />);

    const element = screen.getByRole("textbox");

    fireEvent.focus(element);
    element.textContent = "Typed";
    fireEvent.input(element);
    dispatch.mockClear();

    fireEvent.keyDown(element, { key: "Escape" });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(update({ title: "Original" }));
  });

  it("asks for nothing more when the field loses focus", () => {
    const dispatch = vi.fn();

    render(<Harness data={{ title: "Hello" }} dispatch={dispatch} />);

    const element = screen.getByRole("textbox");

    fireEvent.focus(element);
    dispatch.mockClear();
    fireEvent.blur(element);

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("selects the block the moment the field takes focus", () => {
    const dispatch = vi.fn();

    render(<Harness data={{ title: "Hello" }} dispatch={dispatch} />);

    fireEvent.focus(screen.getByRole("textbox"));

    expect(dispatch).toHaveBeenCalledWith({ ref: nodeRef, type: "select" });
  });
});

describe("an inline field while an IME is composing", () => {
  it("commits once, at the end, and never mid-composition", () => {
    const dispatch = vi.fn();

    render(<Harness data={{ title: "" }} dispatch={dispatch} />);

    const element = screen.getByRole("textbox");

    fireEvent.compositionStart(element);
    element.textContent = "に";
    fireEvent.input(element);
    element.textContent = "にほん";
    fireEvent.input(element);

    expect(dispatch).not.toHaveBeenCalled();

    element.textContent = "日本";
    fireEvent.compositionEnd(element);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(update({ title: "日本" }));
  });
});

describe("the one value an inline field is allowed to show", () => {
  it("writes a value that changed elsewhere into the element", () => {
    const { rerender } = render(
      <Harness child={<h1 className="text-3xl" />} data={{ title: "Alpha" }} />,
    );

    const element = screen.getByRole("textbox");

    expect(element.textContent).toBe("Alpha");

    rerender(
      <Harness child={<h1 className="text-3xl" />} data={{ title: "Beta" }} />,
    );

    expect(element.textContent).toBe("Beta");
  });

  it("does not touch the element when the value has not moved", () => {
    const { rerender } = render(<Harness data={{ title: "Alpha" }} />);

    const element = screen.getByRole("textbox");
    const caret = document.createComment("caret");

    element.append(caret);
    rerender(<Harness data={{ title: "Alpha" }} />);

    expect(element.lastChild).toBe(caret);
  });

  it("shows the same value in every place the block marks that field", () => {
    render(
      <Providers data={{ title: "Alpha" }} dispatch={() => undefined}>
        <InlineEditableText name="title">
          <h1 className="text-3xl" />
        </InlineEditableText>
        <InlineEditableText name="title">
          <h2 className="text-xl" />
        </InlineEditableText>
      </Providers>,
    );

    const found = screen.getAllByRole("textbox");

    expect(found).toHaveLength(2);
    expect(found.map(element => element.textContent)).toStrictEqual([
      "Alpha",
      "Alpha",
    ]);
  });
});
