// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { AnyBlockInstance, BlockAreaInstance } from "./types";

import { field } from "../content/fields";
import { isBlockAreaInstance } from "./area";
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
      defineBlock({
        component: Noop,
        defaultVariant: "grid",
        fields: { title: field.text({ required: true }) },
        id: "cards",
        variants: [{ id: "grid" }, { id: "featured" }],
      }),
    ],
  },
]);

const envelope = (id: string, type: string, data: Record<string, unknown>) => ({
  data,
  id,
  type,
});

const area = (
  id: string,
  children: unknown[],
  layout: Record<string, unknown> = { columns: 2 },
) => ({ children, id, kind: "area", layout });

const blocksOf = (node: unknown): AnyBlockInstance[] =>
  isBlockAreaInstance(node) ? [...node.children] : [];

const messages = (envelopes: unknown[], allowed = "*" as const) =>
  parseBlockInstances({ allowed, envelopes, registry }).issues.map(
    issue => issue.message,
  );

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

    expect(instances[0]).toStrictEqual({
      data: { title: "Only", variant: "default" },
      id: "01",
      type: "core:hero",
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
    expect(issues.map(issue => issue.path)).toStrictEqual([[1], [2]]);
    expect(issues[0].message).toMatch(/not allowed/);
    expect(issues[1].message).toMatch(/data is invalid/);
  });
});

describe("a stored variant", () => {
  it("leaves a record saved before variants existed exactly as it is", () => {
    const { instances, issues } = parseBlockInstances({
      allowed: "*",
      envelopes: [envelope("01", "core:cards", { title: "Legacy" })],
      registry,
    });

    expect(issues).toStrictEqual([]);
    expect(instances[0]).toStrictEqual({
      data: { title: "Legacy" },
      id: "01",
      type: "core:cards",
    });
  });

  it("survives the round trip when the block declares it", () => {
    const { instances, issues } = parseBlockInstances({
      allowed: "*",
      envelopes: [
        {
          ...envelope("01", "core:cards", { title: "Pick" }),
          variant: "featured",
        },
      ],
      registry,
    });

    expect(issues).toStrictEqual([]);
    expect(instances[0]).toStrictEqual({
      data: { title: "Pick" },
      id: "01",
      type: "core:cards",
      variant: "featured",
    });
  });

  it("is an error when the block does not declare it, never a silent swap", () => {
    const [message] = messages([
      {
        ...envelope("01", "core:cards", { title: "Pick" }),
        variant: "carousel",
      },
    ]);

    expect(message).toMatch(/has no variant "carousel"/);
    expect(message).toMatch(/"grid", "featured"/);
  });

  it("is an error on a block that declares no variants at all", () => {
    const [message] = messages([
      { ...envelope("01", "core:hero", { title: "Pick" }), variant: "grid" },
    ]);

    expect(message).toMatch(/declares no variants at all/);
  });

  it("is never invented out of the block's default", () => {
    const { instances } = parseBlockInstances({
      allowed: "*",
      envelopes: [envelope("01", "core:cards", { title: "Legacy" })],
      registry,
    });

    expect(instances[0]).not.toHaveProperty("variant");
  });

  it("is not a field, so it cannot be smuggled in through the data", () => {
    const [message] = messages([
      envelope("01", "core:cards", { title: "Pick", variant: "featured" }),
    ]);

    expect(message).toMatch(/data is invalid/);
  });
});

describe("an area", () => {
  it("validates its children the way root blocks are validated", () => {
    const { instances, issues } = parseBlockInstances({
      allowed: "*",
      envelopes: [
        area(
          "a1",
          [
            envelope("01", "core:hero", { title: "Left" }),
            {
              ...envelope("02", "core:cards", { title: "Right" }),
              variant: "featured",
            },
          ],
          { align: "center", columns: 2, gap: "lg", justify: "between" },
        ),
      ],
      registry,
    });

    expect(issues).toStrictEqual([]);
    expect(instances[0]).toStrictEqual({
      children: [
        {
          data: { title: "Left", variant: "default" },
          id: "01",
          type: "core:hero",
        },
        {
          data: { title: "Right" },
          id: "02",
          type: "core:cards",
          variant: "featured",
        },
      ],
      id: "a1",
      kind: "area",
      layout: { align: "center", columns: 2, gap: "lg", justify: "between" },
    });
  });

  it("keeps a layout down to the tokens the renderer knows", () => {
    expect(messages([area("a1", [], { columns: 7 })])[0]).toMatch(
      /area is malformed/,
    );
    expect(messages([area("a1", [], { columns: 2, gap: "huge" })])[0]).toMatch(
      /area is malformed/,
    );
    expect(messages([area("a1", [], { columns: 2, align: "end" })])[0]).toMatch(
      /area is malformed/,
    );
    expect(
      messages([area("a1", [], { columns: 2, justify: "around" })])[0],
    ).toMatch(/area is malformed/);
  });

  it("refuses an area nested in an area rather than dropping it", () => {
    const issues = parseBlockInstances({
      allowed: "*",
      envelopes: [area("a1", [area("a2", [])])],
      registry,
    }).issues;

    expect(issues[0].message).toMatch(/cannot hold another area/);
    expect(issues[0].path).toStrictEqual([0, "children", 0]);
  });

  it("points at the child it could not read", () => {
    const issues = parseBlockInstances({
      allowed: "*",
      envelopes: [
        area("a1", [
          envelope("01", "core:hero", { title: "Fine" }),
          { data: { title: "No id" }, type: "core:hero" },
        ]),
      ],
      registry,
    }).issues;

    expect(issues[0].path).toStrictEqual([0, "children", 1]);
    expect(issues[0].message).toMatch(/not a stored block/);
  });

  it("is not itself subject to the field's allowlist, though its children are", () => {
    const { instances, issues } = parseBlockInstances({
      allowed: ["core:hero"],
      envelopes: [
        area("a1", [
          envelope("01", "core:hero", { title: "Allowed" }),
          envelope("02", "core:cards", { title: "Not allowed" }),
        ]),
      ],
      registry,
    });

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/"core:cards" is not allowed/);
    expect(blocksOf(instances[0]).map(block => block.id)).toStrictEqual(["01"]);
  });

  it("shares one id space with every block in the tree", () => {
    const issues = parseBlockInstances({
      allowed: "*",
      envelopes: [
        envelope("01", "core:hero", { title: "Root" }),
        area("a1", [envelope("01", "core:hero", { title: "Child" })]),
        area("a1", []),
      ],
      registry,
    }).issues;

    expect(issues.map(issue => issue.path)).toStrictEqual([
      [1, "children", 0],
      [2],
    ]);
    expect(issues[0].message).toMatch(/more than once/);
    expect(issues[1].message).toMatch(/more than once/);
  });

  it("caps how many blocks one area may hold", () => {
    const children = Array.from({ length: 51 }, (_, at) =>
      envelope(`c${at}`, "core:hero", { title: "One" }),
    );

    expect(messages([area("a1", children)])[0]).toMatch(/area is malformed/);
  });
});

describe("zodBlockInstances", () => {
  it("bounds how many nodes one zone may hold", () => {
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

  it("parses a legacy list of blocks unchanged", () => {
    const parsed = zodBlockInstances({
      allowed: "*",
      registry: () => registry,
    }).parse([envelope("01", "core:hero", { title: "One" })]);

    expect(parsed).toStrictEqual([
      {
        data: { title: "One", variant: "default" },
        id: "01",
        type: "core:hero",
      },
    ]);
  });

  it("parses a tree of areas and blocks", () => {
    const parsed = zodBlockInstances({
      allowed: "*",
      registry: () => registry,
    }).parse([
      area("a1", [envelope("01", "core:hero", { title: "In a column" })]),
      { ...envelope("02", "core:cards", { title: "Below" }), variant: "grid" },
    ]);

    expect(parsed).toHaveLength(2);
    expect((parsed[0] as BlockAreaInstance).children).toHaveLength(1);
    expect(parsed[1]).toHaveProperty("variant", "grid");
  });

  it("carries the path of a refused child back to the caller", () => {
    const parsed = zodBlockInstances({
      allowed: "*",
      registry: () => registry,
    }).safeParse([area("a1", [envelope("01", "shop:cart", {})])]);

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].path).toStrictEqual([0, "children", 0]);
  });

  it("says which module registers a registry when none is", () => {
    expect(() =>
      zodBlockInstances({ allowed: "*" }).parse([
        envelope("01", "core:hero", { title: "One" }),
      ]),
    ).toThrow(BlockRegistryMissingError);
  });
});
