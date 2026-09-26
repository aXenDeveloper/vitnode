// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { BlockCatalogEntry } from "./catalog";

import { defineBlock } from "../../blocks/define";
import { createBlockRegistry } from "../../blocks/registry";
import { field } from "../../content/fields";
import {
  blockCatalogFor,
  blockCatalogNotice,
  groupBlockCatalog,
  matchesBlockQuery,
  matchesLayoutQuery,
  mergeBlockCatalogs,
  toBlockCatalogEntry,
} from "./catalog";

const Noop = () => null;

const block = (id: string, name?: string, description?: string) =>
  defineBlock({
    component: Noop,
    description,
    fields: { title: field.text({ required: true }) },
    id,
    name,
  });

const registry = createBlockRegistry([
  {
    blocks: [
      block("hero", "Hero", "A full-width banner"),
      block("text", "Rich text", "A paragraph of prose"),
      block("cta"),
    ],
    pluginId: "@vitnode/core",
  },
  {
    blocks: [block("callout", "Callout", "A highlighted aside")],
    pluginId: "@vitnode/example",
  },
]);

const entry = (
  partial: Partial<BlockCatalogEntry> = {},
): BlockCatalogEntry => ({
  description: "A full-width banner",
  icon: undefined,
  name: "Hero",
  namespace: "core",
  type: "core:hero",
  ...partial,
});

const layout = {
  area: {
    description: "Lay blocks out side by side in up to four columns.",
    name: "Area",
  },
  label: "Layout",
};

describe("toBlockCatalogEntry", () => {
  it("falls back to the block id when it has no display name", () => {
    const registered = registry.get("core:cta");

    expect(registered && toBlockCatalogEntry(registered)).toEqual({
      description: undefined,
      name: "cta",
      namespace: "core",
      type: "core:cta",
    });
  });
});

describe("blockCatalogFor", () => {
  it("offers every registered block when the zone has no allowlist", () => {
    expect(blockCatalogFor(registry, undefined).map(item => item.type)).toEqual(
      ["core:cta", "core:hero", "core:text", "example:callout"],
    );
  });

  it("offers only what the zone's allowlist accepts", () => {
    expect(
      blockCatalogFor(registry, ["core:hero", "example:*"]).map(
        item => item.type,
      ),
    ).toEqual(["core:hero", "example:callout"]);
  });

  it("offers nothing when the allowlist matches no installed block", () => {
    expect(blockCatalogFor(registry, ["blog:post"])).toEqual([]);
  });
});

describe("matchesBlockQuery", () => {
  it("keeps everything for a blank query", () => {
    expect(matchesBlockQuery(entry(), "   ")).toBe(true);
  });

  it("matches the name, description, type and namespace case-insensitively", () => {
    expect(matchesBlockQuery(entry(), "HER")).toBe(true);
    expect(matchesBlockQuery(entry(), "banner")).toBe(true);
    expect(matchesBlockQuery(entry(), "core:")).toBe(true);
    expect(matchesBlockQuery(entry(), "CORE")).toBe(true);
  });

  it("drops a block nothing about it matches", () => {
    expect(matchesBlockQuery(entry(), "callout")).toBe(false);
  });

  it("does not trip over a block without a description", () => {
    expect(matchesBlockQuery(entry({ description: undefined }), "banner")).toBe(
      false,
    );
  });
});

describe("groupBlockCatalog", () => {
  it("groups by namespace and sorts groups and names", () => {
    expect(
      groupBlockCatalog({ entries: blockCatalogFor(registry, undefined) }),
    ).toEqual([
      {
        entries: [
          entry({ description: undefined, name: "cta", type: "core:cta" }),
          entry({ name: "Hero" }),
          entry({
            description: "A paragraph of prose",
            name: "Rich text",
            type: "core:text",
          }),
        ],
        id: "core",
        kind: "namespace",
        label: "core",
      },
      {
        entries: [
          entry({
            description: "A highlighted aside",
            name: "Callout",
            namespace: "example",
            type: "example:callout",
          }),
        ],
        id: "example",
        kind: "namespace",
        label: "example",
      },
    ]);
  });

  it("drops a group the query empties", () => {
    expect(
      groupBlockCatalog({
        entries: blockCatalogFor(registry, undefined),
        query: "callout",
      }).map(group => group.id),
    ).toEqual(["example"]);
  });

  it("returns no group at all when nothing matches", () => {
    expect(
      groupBlockCatalog({
        entries: blockCatalogFor(registry, undefined),
        query: "carousel",
      }),
    ).toEqual([]);
  });

  it("offers Layout above the plugins, because an area belongs to no plugin", () => {
    const groups = groupBlockCatalog({
      entries: blockCatalogFor(registry, undefined),
      layout,
    });

    expect(groups.map(group => group.id)).toEqual([
      "layout",
      "core",
      "example",
    ]);
    expect(groups[0]).toEqual({
      area: layout.area,
      id: "layout",
      kind: "layout",
      label: "Layout",
    });
  });

  it("offers Layout even where no block is allowed, because an area needs no registry entry", () => {
    expect(
      groupBlockCatalog({ entries: [], layout }).map(group => group.id),
    ).toEqual(["layout"]);
  });

  it("keeps Layout for a query that names it and drops it for one that does not", () => {
    expect(
      groupBlockCatalog({
        entries: blockCatalogFor(registry, undefined),
        layout,
        query: "column",
      }).map(group => group.id),
    ).toEqual(["layout"]);

    expect(
      groupBlockCatalog({
        entries: blockCatalogFor(registry, undefined),
        layout,
        query: "callout",
      }).map(group => group.id),
    ).toEqual(["example"]);
  });
});

describe("matchesLayoutQuery", () => {
  it("keeps the section for a blank query", () => {
    expect(matchesLayoutQuery(layout, "  ")).toBe(true);
  });

  it("matches the heading, the name and the description, case-insensitively", () => {
    expect(matchesLayoutQuery(layout, "LAY")).toBe(true);
    expect(matchesLayoutQuery(layout, "area")).toBe(true);
    expect(matchesLayoutQuery(layout, "four columns")).toBe(true);
  });

  it("drops it when nothing about it matches", () => {
    expect(matchesLayoutQuery(layout, "hero")).toBe(false);
  });
});

describe("blockCatalogNotice", () => {
  it("says nothing is installed before it blames the allowlist", () => {
    expect(blockCatalogNotice({ installed: 0, matched: 0, offered: 0 })).toBe(
      "none_installed",
    );
  });

  it("blames the zone when blocks are installed but none is offered here", () => {
    expect(blockCatalogNotice({ installed: 4, matched: 0, offered: 0 })).toBe(
      "empty",
    );
  });

  it("blames the search when the zone offers blocks the query hides", () => {
    expect(blockCatalogNotice({ installed: 4, matched: 0, offered: 4 })).toBe(
      "no_results",
    );
  });

  it("says nothing when there is something to show", () => {
    expect(blockCatalogNotice({ installed: 4, matched: 2, offered: 4 })).toBe(
      null,
    );
  });
});

describe("mergeBlockCatalogs", () => {
  const coreOnly = createBlockRegistry([
    {
      blocks: [block("hero", "Hero"), block("text", "Rich text")],
      pluginId: "@vitnode/core",
    },
  ]);

  it("offers the union of every zone, de-duplicated by type", () => {
    expect(
      mergeBlockCatalogs({
        sources: [
          { allowedBlocks: ["core:hero"], registry },
          { allowedBlocks: ["example:*"], registry },
          { allowedBlocks: ["core:hero"], registry: coreOnly },
        ],
      }).entries.map(item => item.type),
    ).toEqual(["core:hero", "example:callout"]);
  });

  it("counts what is installed apart from what an allowlist offers", () => {
    const merged = mergeBlockCatalogs({
      sources: [{ allowedBlocks: ["blog:post"], registry }],
    });

    expect(merged.entries).toEqual([]);
    expect(merged.installed).toBe(4);
  });

  it("falls back to the registry a zone did not bring", () => {
    expect(
      mergeBlockCatalogs({
        fallback: registry,
        sources: [{ allowedBlocks: undefined, registry: undefined }],
      }).entries.map(item => item.type),
    ).toEqual(["core:cta", "core:hero", "core:text", "example:callout"]);
  });

  it("offers nothing when there is no registry to read", () => {
    expect(
      mergeBlockCatalogs({
        sources: [{ allowedBlocks: undefined, registry: undefined }],
      }),
    ).toEqual({ entries: [], installed: 0 });
  });
});
