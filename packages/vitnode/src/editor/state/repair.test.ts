import { describe, expect, it } from "vitest";

import type {
  AnyBlockInstance,
  BlockAllowedSpec,
  ContentNode,
} from "../../blocks/types";
import type { EditorZoneState } from "./types";

import { createAreaInstance } from "../../blocks/area";
import { createBlockInstance } from "../../blocks/instance";
import {
  createBlockRegistry,
  setDefaultBlockRegistry,
} from "../../blocks/registry";
import { field } from "../../content/fields";
import { isRepairRemoval } from "./repair";

const registry = createBlockRegistry([
  {
    pluginId: "@vitnode/core",
    blocks: [
      {
        component: () => null,
        fields: { body: field.text({ minLength: 3 }) },
        id: "text",
      },
      { component: () => null, fields: { label: field.text({}) }, id: "cta" },
    ],
    namespace: "core",
  },
]);

const block = (body: string): AnyBlockInstance =>
  createBlockInstance("core:text", { body });

const zoneOf = (
  nodes: readonly ContentNode[],
  options: {
    allowedBlocks?: BlockAllowedSpec;
    registry?: ReturnType<typeof createBlockRegistry>;
  } = {},
): EditorZoneState => ({
  allowedBlocks: options.allowedBlocks,
  id: "main",
  initial: nodes,
  initialInvalid: [],
  invalid: [],
  max: undefined,
  min: undefined,
  nodes,
  registry: options.registry,
  superseded: [],
});

describe("isRepairRemoval", () => {
  it("says nothing about a block the registry is happy with", () => {
    const sound = block("Hello");

    expect(isRepairRemoval(zoneOf([sound], { registry }), sound)).toBe(false);
  });

  it("calls a block of a type nothing registers a repair", () => {
    const gone = createBlockInstance("core:gone", {});

    expect(isRepairRemoval(zoneOf([gone], { registry }), gone)).toBe(true);
  });

  it("calls a block the zone allowlist refuses a repair", () => {
    const sound = block("Hello");
    const zone = zoneOf([sound], {
      allowedBlocks: ["core:cta"],
      registry,
    });

    expect(isRepairRemoval(zone, sound)).toBe(true);
  });

  it("calls data the block's own field constraints reject a repair", () => {
    const short = block("Hi");

    expect(isRepairRemoval(zoneOf([short], { registry }), short)).toBe(true);
  });

  it("calls data of the wrong shape entirely a repair", () => {
    const misshapen: AnyBlockInstance = {
      ...block("Hello"),
      data: { body: 12 },
    };

    expect(isRepairRemoval(zoneOf([misshapen], { registry }), misshapen)).toBe(
      true,
    );
  });

  it("never calls an area a repair, whatever it is holding", () => {
    const gone = createBlockInstance("core:gone", {});
    const holder = createAreaInstance({ children: [gone] });
    const zone = zoneOf([holder], { registry });

    expect(isRepairRemoval(zone, holder)).toBe(false);
    expect(isRepairRemoval(zone, gone)).toBe(true);
  });

  it("says nothing at all when no registry can be consulted", () => {
    const gone = createBlockInstance("core:gone", {});

    expect(isRepairRemoval(zoneOf([gone]), gone)).toBe(false);
  });

  it("consults the process registry when the zone carries none", () => {
    const gone = createBlockInstance("core:gone", {});
    const zone = zoneOf([gone]);
    const restore = setDefaultBlockRegistry(registry);

    expect(isRepairRemoval(zone, gone)).toBe(true);

    restore();

    expect(isRepairRemoval(zone, gone)).toBe(false);
  });
});
