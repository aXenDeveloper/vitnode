import { render, screen } from "@testing-library/react";
import { type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import type {
  AnyBlockInstance,
  BlockComponentProps,
  BlockData,
} from "../../blocks/types";
import type { VisualEditorContextValue } from "../context";

import { defineBlock } from "../../blocks/define";
import { createBlockRegistry } from "../../blocks/registry";
import { field } from "../../content/fields";
import { VisualEditorContext } from "../context";
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

const Shell = ({ data }: { data: Record<string, unknown> }): ReactElement => {
  const state = visualEditorReducer(initialVisualEditorState, {
    type: "mount",
    zone: {
      allowedBlocks: undefined,
      id: "main",
      invalid: [],
      max: undefined,
      min: undefined,
      nodes: [instance(data)],
      registry,
    },
  });

  const value = {
    dispatch: () => undefined,
    preview: false,
    state,
  } as unknown as VisualEditorContextValue;

  return (
    <VisualEditorContext value={value}>
      <EditableBlockShell
        areaId={null}
        index={0}
        instance={instance(data)}
        zoneId="main"
      >
        <p>drawn</p>
      </EditableBlockShell>
    </VisualEditorContext>
  );
};

const badge = (): HTMLElement | null =>
  screen.queryByText("block.issue.invalid_data");

const blocksSave = (data: Record<string, unknown>): boolean =>
  unsafeZoneIds(
    visualEditorReducer(initialVisualEditorState, {
      type: "mount",
      zone: {
        allowedBlocks: undefined,
        id: "main",
        invalid: [],
        max: undefined,
        min: undefined,
        nodes: [instance(data)],
        registry,
      },
    }),
  ).includes("main");

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
