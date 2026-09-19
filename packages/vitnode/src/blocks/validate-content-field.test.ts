// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";

import { defineContentType } from "../content/define";
import { field } from "../content/fields";
import { isBlockAreaInstance } from "./area";
import { defineBlock } from "./define";
import { createBlockRegistry, setDefaultBlockRegistry } from "./registry";

const Noop = () => null;

const heroBlock = defineBlock({
  component: Noop,
  fields: { title: field.text({ maxLength: 20, required: true }) },
  id: "hero",
});

const cardsBlock = defineBlock({
  component: Noop,
  defaultVariant: "grid",
  fields: { title: field.text({ required: true }) },
  id: "cards",
  variants: [{ id: "grid" }, { id: "featured" }],
});

beforeAll(() => {
  setDefaultBlockRegistry(
    createBlockRegistry([
      {
        pluginId: "@vitnode/core",
        namespace: "core",
        blocks: [cardsBlock, heroBlock],
      },
    ]),
  );
});

const pageContentType = defineContentType({
  id: "test.node-page",
  tableName: "test_node_pages",
  fields: {
    content: field.blocks(),
    title: field.text({ required: true }),
  },
});

const block = (id: string, type: string, data: Record<string, unknown>) => ({
  data,
  id,
  type,
});

const area = (id: string, children: unknown[]) => ({
  children,
  id,
  kind: "area",
  layout: { columns: 2, gap: "lg" },
});

const parseContent = (content: unknown[]) =>
  pageContentType.schemas.create.safeParse({ content, title: "Home" });

const nodesOf = (content: unknown[]): unknown[] => {
  const parsed = parseContent(content);

  return parsed.success ? (parsed.data.content ?? []) : [];
};

const childIds = (node: unknown): string[] =>
  isBlockAreaInstance(node) ? node.children.map(child => child.id) : [];

describe("field.blocks", () => {
  it("takes a tree of areas and blocks, not only a flat list", () => {
    const nodes = nodesOf([
      area("a1", [
        block("01", "core:hero", { title: "Left" }),
        { ...block("02", "core:cards", { title: "Right" }), variant: "grid" },
      ]),
      block("03", "core:hero", { title: "Below" }),
    ]);

    expect(nodes).toHaveLength(2);
    expect(childIds(nodes[0])).toStrictEqual(["01", "02"]);
  });

  it("still takes the flat list every record written so far holds", () => {
    expect(
      nodesOf([block("01", "core:hero", { title: "Only" })]),
    ).toStrictEqual([{ data: { title: "Only" }, id: "01", type: "core:hero" }]);
  });

  it("refuses an area inside an area", () => {
    const parsed = parseContent([area("a1", [area("a2", [])])]);

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].path).toStrictEqual([
      "content",
      0,
      "children",
      0,
    ]);
  });

  it("refuses a variant the block inside an area does not declare", () => {
    const parsed = parseContent([
      area("a1", [
        {
          ...block("01", "core:cards", { title: "Right" }),
          variant: "carousel",
        },
      ]),
    ]);

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toMatch(/has no variant/);
  });
});
