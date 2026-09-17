// @vitest-environment node
import { describe, expect, it } from "vitest";

import type {
  AnyBlockInstance,
  BlockAreaInstance,
  ContentNode,
} from "../../blocks/types";
import type { EditorNodeRef, VisualEditorState } from "../state/types";

import { defineBlock } from "../../blocks/define";
import { field } from "../../content/fields";
import { selectedNode, variantControlSpec } from "./selection";

const block = (id: string): AnyBlockInstance => ({
  data: { title: id },
  id,
  type: "core:text",
});

const area = (
  id: string,
  children: readonly AnyBlockInstance[],
): BlockAreaInstance => ({
  children,
  id,
  kind: "area",
  layout: { columns: 2 },
});

const stateWith = (nodes: readonly ContentNode[]): VisualEditorState => ({
  droppedZoneIds: [],
  order: ["main"],
  selected: null,
  zones: {
    main: {
      allowedBlocks: undefined,
      id: "main",
      initial: nodes,
      initialInvalid: [],
      invalid: [],
      nodes,
      registry: undefined,
    },
  },
});

const ref = (partial: Partial<EditorNodeRef>): EditorNodeRef => ({
  areaId: null,
  kind: "block",
  nodeId: "B1",
  zoneId: "main",
  ...partial,
});

const rootBlock = block("B1");
const child = block("B2");
const twoColumns = area("A1", [child]);
const state = stateWith([rootBlock, twoColumns]);

describe("selectedNode", () => {
  it("has nothing to show while nothing is selected", () => {
    expect(selectedNode(state, null)).toBeNull();
  });

  it("finds a block sitting at the zone's own root", () => {
    expect(selectedNode(state, ref({}))).toStrictEqual({
      index: 0,
      instance: rootBlock,
      kind: "block",
    });
  });

  it("finds an area by the same reference shape a block uses", () => {
    expect(
      selectedNode(state, ref({ kind: "area", nodeId: "A1" })),
    ).toStrictEqual({ area: twoColumns, index: 1, kind: "area" });
  });

  it("descends into the area a child names, and indexes it inside that area", () => {
    expect(
      selectedNode(state, ref({ areaId: "A1", nodeId: "B2" })),
    ).toStrictEqual({ index: 0, instance: child, kind: "block" });
  });

  it("refuses to look for a child in the zone root, so it cannot select a namesake", () => {
    expect(
      selectedNode(
        stateWith([child, twoColumns]),
        ref({ areaId: "A1", nodeId: "B2" }),
      ),
    ).toStrictEqual({ index: 0, instance: child, kind: "block" });
    expect(selectedNode(state, ref({ nodeId: "B2" }))).toBeNull();
  });

  it("gives up on a zone, an area or a node that is no longer there", () => {
    expect(selectedNode(state, ref({ zoneId: "gone" }))).toBeNull();
    expect(
      selectedNode(state, ref({ areaId: "gone", nodeId: "B2" })),
    ).toBeNull();
    expect(selectedNode(state, ref({ nodeId: "gone" }))).toBeNull();
  });

  it("refuses to treat a block as the area a reference claims it is", () => {
    expect(selectedNode(state, ref({ areaId: "B1", nodeId: "B2" }))).toBeNull();
  });
});

const withVariants = defineBlock({
  component: () => null,
  defaultVariant: "grid",
  fields: { title: field.text({ required: true }) },
  id: "features",
  variants: [{ id: "grid" }, { id: "list" }, { id: "compact" }],
});

const oneVariant = defineBlock({
  component: () => null,
  defaultVariant: "grid",
  fields: { title: field.text({ required: true }) },
  id: "single",
  variants: [{ id: "grid" }],
});

const plain = defineBlock({
  component: () => null,
  fields: { title: field.text({ required: true }) },
  id: "plain",
});

describe("variantControlSpec", () => {
  it("offers the declared variants and falls back to the default one", () => {
    expect(variantControlSpec(withVariants, undefined)).toStrictEqual({
      options: withVariants.variants,
      unknown: null,
      value: "grid",
      visible: true,
    });
  });

  it("shows the stored variant as the chosen one", () => {
    expect(variantControlSpec(withVariants, "list")).toMatchObject({
      unknown: null,
      value: "list",
      visible: true,
    });
  });

  it("names a stored variant the block no longer offers, and still offers the rest", () => {
    expect(variantControlSpec(withVariants, "carousel")).toMatchObject({
      unknown: "carousel",
      value: undefined,
      visible: true,
    });
  });

  it("hides the control for a block with one variant, because there is nothing to choose", () => {
    expect(variantControlSpec(oneVariant, "grid").visible).toBe(false);
  });

  it("shows that one variant anyway once the stored one is unknown", () => {
    expect(variantControlSpec(oneVariant, "carousel")).toMatchObject({
      unknown: "carousel",
      visible: true,
    });
  });

  it("shows nothing at all for a block that declares no variants", () => {
    expect(variantControlSpec(plain, undefined)).toStrictEqual({
      options: [],
      unknown: null,
      value: undefined,
      visible: false,
    });
    expect(variantControlSpec(plain, "grid").visible).toBe(false);
  });
});
