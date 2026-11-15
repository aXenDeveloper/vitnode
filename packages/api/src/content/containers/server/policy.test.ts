import { describe, expect, it } from "vitest";

import { core_content_containers } from "@/database/content-containers";
import { createMemoryDb } from "@/tests/memory-db";

import type { ContentDatabase } from "../../server/service";

import {
  contentContainerScopeResources,
  expandContentContainerScope,
} from "./policy";

describe("contentContainerScopeResources", () => {
  it.each<[string, { id: number }[], string[]]>([
    ["no container", [], []],
    ["a top-level container", [{ id: 5 }], ["5", "5:tree"]],
    // Ancestors only as subtrees: a bare id never reaches a descendant.
    [
      "a nested container, with the subtree of every ancestor",
      [{ id: 5 }, { id: 3 }, { id: 1 }],
      ["5", "5:tree", "3:tree", "1:tree"],
    ],
  ])("covers %s", (_label, chain, expected) => {
    expect(contentContainerScopeResources(chain)).toEqual(expected);
  });
});

describe("expandContentContainerScope", () => {
  const CREATED = new Date("2026-09-01T10:00:00.000Z");
  const row = (
    id: number,
    definitionId: string,
    parentId: null | number = null,
  ) => ({
    createdAt: CREATED,
    definitionId,
    id,
    metadata: {},
    name: `Container ${id}`,
    parentId,
    pluginId: "@vitnode/forum",
    policies: {},
    position: 0,
    slug: `container-${id}`,
    updatedAt: CREATED,
  });

  // 1 ─┬─ 2 ── 3      5      (forum.forums)
  //    └─ 4
  // 10 ── 11                 (forum.sections)
  const db = createMemoryDb([
    [
      core_content_containers,
      [
        row(1, "forum.forums"),
        row(2, "forum.forums", 1),
        row(3, "forum.forums", 2),
        row(4, "forum.forums", 1),
        row(5, "forum.forums"),
        row(10, "forum.sections"),
        row(11, "forum.sections", 10),
      ],
    ],
  ]).db as unknown as ContentDatabase;

  it("passes `all` through", async () => {
    await expect(
      expandContentContainerScope(db, "forum.forums", "all"),
    ).resolves.toBe("all");
  });

  it.each<[string, string[], number[]]>([
    ["nothing", [], []],
    ["bare ids, without their descendants", ["2", "5"], [2, 5]],
    ["a subtree", ["2:tree"], [2, 3]],
    ["a subtree from the root", ["1:tree"], [1, 2, 3, 4]],
    ["ids and subtrees together, once each", ["3", "2:tree", "5"], [2, 3, 5]],
    ["a subtree that does not exist", ["99:tree"], []],
    ["a subtree in another collection", ["10:tree"], []],
    [
      "resource ids that are not container ids",
      ["", "abc", "0", "-1", "1.5", ":tree", "abc:tree"],
      [],
    ],
  ])("expands %s", async (_label, resources, expected) => {
    await expect(
      expandContentContainerScope(db, "forum.forums", resources),
    ).resolves.toEqual(expected);
  });
});
