import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AnyBlockInstance, BlockAreaInstance } from "../../blocks/types";
import type { VisualEditorContextValue } from "../context";
import type { EditorNodeRef } from "../state/types";

import { createAreaInstance } from "../../blocks/area";
import { CONTENT_BLOCKS_ABSOLUTE_MAX } from "../../blocks/const";
import { createBlockInstance } from "../../blocks/instance";
import { VisualEditorContext } from "../context";
import {
  initialVisualEditorState,
  visualEditorReducer,
} from "../state/reducer";
import { AreaPropertiesPanelContent } from "./area-panel";

vi.mock("use-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

const block = (body: string): AnyBlockInstance =>
  createBlockInstance("core:text", { body });

const blocks = (count: number): AnyBlockInstance[] =>
  Array.from({ length: count }, (_, at) => block(`filler-${at}`));

const opened = ({
  area,
  max,
  siblings = [],
}: {
  area: BlockAreaInstance;
  max?: number;
  siblings?: readonly AnyBlockInstance[];
}) => {
  const state = visualEditorReducer(initialVisualEditorState, {
    type: "mount",
    zone: {
      allowedBlocks: undefined,
      id: "main",
      invalid: [],
      max,
      min: undefined,
      nodes: [...siblings, area],
      registry: undefined,
    },
  });
  const target: EditorNodeRef = {
    areaId: null,
    kind: "area",
    nodeId: area.id,
    zoneId: "main",
  };
  const value = {
    dispatch: () => undefined,
    setPanel: () => undefined,
    state,
  } as unknown as VisualEditorContextValue;

  render(
    <VisualEditorContext value={value}>
      <AreaPropertiesPanelContent area={area} target={target} />
    </VisualEditorContext>,
  );

  return screen.getByRole("button", { name: "area.duplicate" });
};

describe("duplicating an area from its properties panel", () => {
  it("offers a copy of an empty area in a zone already at its block max", () => {
    const duplicate = opened({
      area: createAreaInstance(),
      max: 2,
      siblings: blocks(2),
    });

    expect(duplicate.hasAttribute("disabled")).toBe(false);
  });

  it("refuses a copy that would take the zone one block past its max", () => {
    const duplicate = opened({
      area: createAreaInstance({ children: [block("inside")] }),
      max: 2,
      siblings: [block("loose")],
    });

    expect(duplicate.hasAttribute("disabled")).toBe(true);
  });

  it("counts every child of the area against the max, not just one", () => {
    const duplicate = opened({
      area: createAreaInstance({ children: blocks(3) }),
      max: 5,
      siblings: [],
    });

    expect(duplicate.hasAttribute("disabled")).toBe(true);
  });

  it("still takes a copy the zone has exactly enough room for", () => {
    const duplicate = opened({
      area: createAreaInstance({ children: blocks(3) }),
      max: 6,
      siblings: [],
    });

    expect(duplicate.hasAttribute("disabled")).toBe(false);
  });

  it("refuses an empty area once the zone's root list is at its cap", () => {
    const area = createAreaInstance();
    const duplicate = opened({
      area,
      siblings: blocks(CONTENT_BLOCKS_ABSOLUTE_MAX - 1),
    });

    expect(duplicate.hasAttribute("disabled")).toBe(true);
  });
});
