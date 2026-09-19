import { fireEvent, render, screen } from "@testing-library/react";
import { type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type {
  AnyBlockInstance,
  BlockComponentProps,
  BlockData,
} from "../../blocks/types";
import type { VisualEditorContextValue } from "../context";
import type { EditorInlineBlockValue } from "../inline/context";
import type { VisualEditorState } from "../state/types";

import { defineBlock } from "../../blocks/define";
import { createBlockRegistry } from "../../blocks/registry";
import { field } from "../../content/fields";
import { VisualEditorContext } from "../context";
import { EditorInlineBlockContext } from "../inline/context";
import {
  initialVisualEditorState,
  unsafeZoneIds,
  visualEditorReducer,
} from "../state/reducer";
import { EditableBlockShell } from "./block-shell";

vi.mock("use-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

const fields = {
  heading: field.text({ minLength: 3, required: true }),
  width: field.enum({ defaultValue: "prose", values: ["full", "prose"] }),
};

const Card = ({ data }: BlockComponentProps<BlockData<typeof fields>>) => (
  <p>{data.heading}</p>
);

const registry = createBlockRegistry([
  {
    pluginId: "@vitnode/core",
    namespace: "core",
    blocks: [defineBlock({ component: Card, fields, id: "card" })],
  },
]);

const NODE_ID = "01JSHELLTESTBLOCK00000001";

const instance = (data: Record<string, unknown>): AnyBlockInstance => ({
  data,
  id: NODE_ID,
  type: "core:card",
});

const inlineValue = (node: AnyBlockInstance): EditorInlineBlockValue => ({
  definition: undefined,
  hasInlineFields: true,
  instance: node,
  nodeRef: { areaId: null, kind: "block", nodeId: NODE_ID, zoneId: "main" },
  registerField: () => () => undefined,
});

interface ZoneBounds {
  max?: number;
  min?: number;
}

const zoneState = (
  data: Record<string, unknown>,
  bounds: ZoneBounds = {},
): VisualEditorState =>
  visualEditorReducer(initialVisualEditorState, {
    type: "mount",
    zone: {
      allowedBlocks: undefined,
      id: "main",
      invalid: [],
      max: bounds.max,
      min: bounds.min,
      nodes: [instance(data)],
      registry,
    },
  });

const Shell = ({
  bounds,
  children = <p>drawn</p>,
  data,
  inline = false,
}: {
  bounds?: ZoneBounds;
  children?: ReactNode;
  data: Record<string, unknown>;
  inline?: boolean;
}): ReactElement => {
  const state = zoneState(data, bounds);

  const value = {
    dispatch: () => undefined,
    preview: false,
    state,
  } as unknown as VisualEditorContextValue;

  const shell = (
    <EditableBlockShell
      areaId={null}
      index={0}
      instance={instance(data)}
      zoneId="main"
    >
      {children}
    </EditableBlockShell>
  );

  return (
    <VisualEditorContext value={value}>
      {inline ? (
        <EditorInlineBlockContext value={inlineValue(instance(data))}>
          {shell}
        </EditorInlineBlockContext>
      ) : (
        shell
      )}
    </VisualEditorContext>
  );
};

const badge = (): HTMLElement | null =>
  screen.queryByText("block.issue.invalid_data");

const blocksSave = (data: Record<string, unknown>): boolean =>
  unsafeZoneIds(zoneState(data)).includes("main");

describe("the badge the block shell draws", () => {
  it("flags a value the block's own field constraints reject", () => {
    const data = { heading: "Hi", width: "prose" };

    render(<Shell data={data} />);

    expect(badge()).not.toBeNull();
    expect(blocksSave(data)).toBe(true);
  });

  it("flags an enum value the block no longer declares", () => {
    const data = { heading: "Hello", width: "narrow" };

    render(<Shell data={data} />);

    expect(badge()).not.toBeNull();
    expect(blocksSave(data)).toBe(true);
  });

  it("still draws the block it flags", () => {
    render(<Shell data={{ heading: "Hi", width: "prose" }} />);

    expect(screen.getByText("drawn")).not.toBeNull();
  });

  it("leaves a sound block unmarked", () => {
    const data = { heading: "Hello", width: "full" };

    render(<Shell data={data} />);

    expect(badge()).toBeNull();
    expect(blocksSave(data)).toBe(false);
  });
});

describe("how inert the body a block shell draws really is", () => {
  const data = { heading: "Hello", width: "full" };

  it("stays inert while the block marks no inline field", () => {
    render(<Shell data={data} />);

    expect(screen.getByText("drawn").parentElement?.hasAttribute("inert")).toBe(
      true,
    );
  });

  it("softens to pointer events once an inline field is registered", () => {
    render(<Shell data={data} inline />);

    const body = screen.getByText("drawn").parentElement;

    expect(body?.hasAttribute("inert")).toBe(false);
    expect(body?.className).toContain("pointer-events-none");
  });

  it("keeps focus out of everything a softened body still renders", () => {
    render(
      <Shell data={data} inline>
        <p>
          <a href="https://vitnode.com">link</a>
        </p>
      </Shell>,
    );

    fireEvent.focus(screen.getByRole("link"));

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "block.select" }),
    );
  });

  it("takes what it softened out of the tab order instead of bouncing it", () => {
    render(
      <Shell data={data} inline>
        <p>
          <a href="https://vitnode.com">link</a>
          <span data-vitnode-inline-field="heading" tabIndex={0}>
            Hello
          </span>
        </p>
      </Shell>,
    );

    expect(screen.getByRole("link").getAttribute("tabindex")).toBe("-1");
    expect(screen.getByText("Hello").getAttribute("tabindex")).toBe("0");
  });

  it("gives the tab order back to a block that stops marking inline fields", () => {
    const { rerender } = render(
      <Shell data={data} inline>
        <p>
          <a href="https://vitnode.com">link</a>
        </p>
      </Shell>,
    );

    expect(screen.getByRole("link").getAttribute("tabindex")).toBe("-1");

    rerender(
      <Shell data={data}>
        <p>
          <a href="https://vitnode.com">link</a>
        </p>
      </Shell>,
    );

    expect(screen.getByRole("link").hasAttribute("tabindex")).toBe(false);
  });
});

describe("the remove button a block shell offers", () => {
  const SOLE_BLOCK: ZoneBounds = { max: 1, min: 1 };

  const removeDisabled = (): boolean =>
    screen
      .getByRole("button", { name: "block.remove" })
      .hasAttribute("disabled");

  const reducerRemoves = (
    data: Record<string, unknown>,
    bounds: ZoneBounds,
  ): boolean => {
    const state = zoneState(data, bounds);

    return (
      visualEditorReducer(state, {
        ref: { areaId: null, kind: "block", nodeId: NODE_ID, zoneId: "main" },
        type: "remove",
      }) !== state
    );
  };

  it("refuses the sound block a zone of exactly one has to keep", () => {
    const data = { heading: "Hello", width: "full" };

    render(<Shell bounds={SOLE_BLOCK} data={data} />);

    expect(removeDisabled()).toBe(true);
    expect(reducerRemoves(data, SOLE_BLOCK)).toBe(false);
  });

  it("offers the rejected block that has the zone stuck", () => {
    const data = { heading: "Hi", width: "full" };

    render(<Shell bounds={SOLE_BLOCK} data={data} />);

    expect(badge()).not.toBeNull();
    expect(removeDisabled()).toBe(false);
    expect(reducerRemoves(data, SOLE_BLOCK)).toBe(true);
  });

  it("offers a sound block the zone has no minimum for", () => {
    const data = { heading: "Hello", width: "full" };

    render(<Shell data={data} />);

    expect(removeDisabled()).toBe(false);
    expect(reducerRemoves(data, {})).toBe(true);
  });
});
