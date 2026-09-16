// @vitest-environment node
import { describe, expect, it } from "vitest";

import { field } from "../content/fields";
import { defineBlock } from "./define";
import { BlockRegistryMissingError } from "./errors";
import { createBlockRegistry } from "./registry";
import { parseBlockInstances, zodBlockInstances } from "./validate";

const Noop = () => null;

const registry = createBlockRegistry([
  {
    pluginId: "@vitnode/core",
    namespace: "core",
    blocks: [
      defineBlock({
        component: Noop,
        fields: {
          title: field.text({ maxLength: 20, required: true }),
          variant: field.enum({
            defaultValue: "default",
            values: ["default", "centered"],
          }),
        },
        id: "hero",
      }),
    ],
  },
]);

const envelope = (id: string, type: string, data: Record<string, unknown>) => ({
  data,
  id,
  type,
});

describe("parseBlockInstances", () => {
  it("returns the instances in the order it was given", () => {
    const { instances, issues } = parseBlockInstances({
      allowed: "*",
      envelopes: [
        envelope("02", "core:hero", { title: "Second" }),
        envelope("01", "core:hero", { title: "First" }),
      ],
      registry,
    });

    expect(issues).toStrictEqual([]);
    expect(instances.map(block => block.id)).toStrictEqual(["02", "01"]);
  });

  it("applies each block's own defaults", () => {
    const { instances } = parseBlockInstances({
      allowed: "*",
      envelopes: [envelope("01", "core:hero", { title: "Only" })],
      registry,
    });

    expect(instances[0].data).toStrictEqual({
      title: "Only",
      variant: "default",
    });
  });

  it("reports the index of every instance it refused", () => {
    const { instances, issues } = parseBlockInstances({
      allowed: ["core:hero"],
      envelopes: [
        envelope("01", "core:hero", { title: "Fine" }),
        envelope("02", "shop:cart", {}),
        envelope("03", "core:hero", { title: "a title that is far too long" }),
      ],
      registry,
    });

    expect(instances).toHaveLength(1);
    expect(issues.map(issue => issue.index)).toStrictEqual([1, 2]);
    expect(issues[0].message).toMatch(/not allowed/);
    expect(issues[1].message).toMatch(/data is invalid/);
  });
});

describe("zodBlockInstances", () => {
  it("bounds how many instances one zone may hold", () => {
    const schema = zodBlockInstances({
      allowed: "*",
      max: 1,
      registry: () => registry,
    });

    expect(
      schema.safeParse([
        envelope("01", "core:hero", { title: "One" }),
        envelope("02", "core:hero", { title: "Two" }),
      ]).success,
    ).toBe(false);
  });

  it("says which module registers a registry when none is", () => {
    expect(() =>
      zodBlockInstances({ allowed: "*" }).parse([
        envelope("01", "core:hero", { title: "One" }),
      ]),
    ).toThrow(BlockRegistryMissingError);
  });
});
