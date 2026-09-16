// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { BlockCatalogEntry } from "./catalog";

import { defineBlock } from "../../blocks/define";
import { createBlockRegistry } from "../../blocks/registry";
import { field } from "../../content/fields";
import {
  blockCatalogFor,
  groupBlockCatalog,
  matchesBlockQuery,
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
  name: "Hero",
  namespace: "core",
  type: "core:hero",
  ...partial,
});

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
        namespace: "core",
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
        namespace: "example",
      },
    ]);
  });

  it("drops a group the query empties", () => {
    expect(
      groupBlockCatalog({
        entries: blockCatalogFor(registry, undefined),
        query: "callout",
      }).map(group => group.namespace),
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
});
