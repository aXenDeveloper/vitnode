import { render, screen } from "@testing-library/react";
import { type ReactNode, use, useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BlockInlineRuntime } from "../../blocks/inline-context";
import type { AnyBlockInstance } from "../../blocks/types";
import type { EditorNodeRef } from "../state/types";
import type { EditorInlineBlockValue } from "./context";

import { defineBlock } from "../../blocks/define";
import { BlockInlineContext } from "../../blocks/inline-context";
import { field } from "../../content/fields";
import { EditorInlineBlock } from "./block";
import { useEditorInlineBlock } from "./context";

vi.mock("./editable-text", () => ({
  InlineEditableText: ({
    children,
    name,
    placeholder,
  }: {
    children: ReactNode;
    name: string;
    placeholder?: string;
  }) => (
    <span data-name={name} data-placeholder={placeholder} data-testid="field">
      {children}
    </span>
  ),
}));

const card = defineBlock({
  component: () => null,
  fields: { headline: field.text({ required: true }) },
  id: "card",
});

const NODE_ID = "01JINLINETESTBLOCK0000001";

const nodeRef: EditorNodeRef = {
  areaId: null,
  kind: "block",
  nodeId: NODE_ID,
  zoneId: "main",
};

const instance: AnyBlockInstance = {
  data: { headline: "Hello" },
  id: NODE_ID,
  type: "core:card",
};

const edited: AnyBlockInstance = {
  ...instance,
  data: { headline: "Hello you" },
};

const seen: EditorInlineBlockValue[] = [];
const runtimes: BlockInlineRuntime[] = [];

const Probe = (): ReactNode => {
  const inline = useEditorInlineBlock();
  if (inline) seen.push(inline);

  return <p>{inline?.hasInlineFields ? "inline" : "static"}</p>;
};

const Field = (): null => {
  const inline = useEditorInlineBlock();
  const registerField = inline?.registerField;

  useEffect(() => registerField?.(), [registerField]);

  return null;
};

const Consumer = ({ name }: { name: string }): ReactNode => {
  const runtime = use(BlockInlineContext);
  if (!runtime) return null;

  runtimes.push(runtime);

  return runtime.render({
    children: <b>drawn</b>,
    name,
    placeholder: "Write a headline",
  });
};

const Harness = ({
  blockInstance = instance,
  mountedFields = 0,
}: {
  blockInstance?: AnyBlockInstance;
  mountedFields?: number;
}): ReactNode => (
  <EditorInlineBlock
    definition={card}
    instance={blockInstance}
    nodeRef={{ ...nodeRef }}
  >
    <Probe />
    {Array.from({ length: mountedFields }, (_, at) => (
      <Field key={at} />
    ))}
  </EditorInlineBlock>
);

const Seam = ({
  blockInstance = instance,
}: {
  blockInstance?: AnyBlockInstance;
}): ReactNode => (
  <EditorInlineBlock
    definition={card}
    instance={blockInstance}
    nodeRef={nodeRef}
  >
    <Consumer name="headline" />
  </EditorInlineBlock>
);

beforeEach(() => {
  seen.length = 0;
  runtimes.length = 0;
});

describe("what the block tells its shell about inline fields", () => {
  it("knows about no fields until one mounts", () => {
    render(<Harness />);

    expect(screen.getByText("static")).toBeDefined();
  });

  it("flips while a field is registered and back when the last goes", () => {
    const view = render(<Harness />);

    view.rerender(<Harness mountedFields={2} />);
    expect(screen.getByText("inline")).toBeDefined();

    view.rerender(<Harness mountedFields={1} />);
    expect(screen.getByText("inline")).toBeDefined();

    view.rerender(<Harness mountedFields={0} />);
    expect(screen.getByText("static")).toBeDefined();
  });

  it("counts a field that a variant change dropped and brought back", () => {
    const view = render(<Harness mountedFields={1} />);
    expect(screen.getByText("inline")).toBeDefined();

    view.rerender(<Harness mountedFields={0} />);
    expect(screen.getByText("static")).toBeDefined();

    view.rerender(<Harness mountedFields={1} />);
    expect(screen.getByText("inline")).toBeDefined();
  });
});

describe("what typing costs the block subtree", () => {
  it("hands out the same value when nothing about the block changed", () => {
    const view = render(<Harness />);

    view.rerender(<Harness />);

    expect(seen.length).toBeGreaterThan(1);
    expect(seen.at(-1)).toBe(seen[0]);
  });

  it("carries the current instance, so a keystroke is visible", () => {
    const view = render(<Harness />);

    view.rerender(<Harness blockInstance={edited} />);

    expect(seen.at(-1)?.instance).toBe(edited);
    expect(seen.at(-1)).not.toBe(seen[0]);
  });

  it("never rebuilds the runtime a block field renders through", () => {
    const view = render(<Seam />);

    view.rerender(<Seam blockInstance={edited} />);

    expect(runtimes.length).toBeGreaterThan(1);
    expect(runtimes.at(-1)).toBe(runtimes[0]);
  });
});

describe("the seam a block field renders through", () => {
  it("renders the editable text for the field it was asked about", () => {
    render(<Seam />);

    const rendered = screen.getByTestId("field");

    expect(rendered.dataset.name).toBe("headline");
    expect(rendered.dataset.placeholder).toBe("Write a headline");
    expect(rendered.textContent).toBe("drawn");
  });

  it("gives the field the ref the select action accepts", () => {
    render(<Harness />);

    expect(seen.at(-1)?.nodeRef).toStrictEqual(nodeRef);
    expect(seen.at(-1)?.definition).toBe(card);
  });
});
