import { describe, expect, it } from "vitest";

import type {
  ContentContainerPlacement,
  ContentContainerTreeRow,
  ContentContainerTreeRules,
} from "./tree";

import {
  contentContainerAncestors,
  contentContainerSubtreeIds,
  contentContainerTree,
  orderContentContainers,
  planContentContainerCreate,
  planContentContainerDelete,
  planContentContainerMove,
} from "./tree";

const row = (
  id: number,
  name: string,
  parentId: null | number,
  position: number,
): ContentContainerTreeRow => ({ id, name, parentId, position });

// News (1)               Archive (2)   Help (6)
// ├─ Rules (3)
// │  └─ Old rules (5)
// └─ announcements (4)
const rows: ContentContainerTreeRow[] = [
  row(6, "Help", null, 2),
  row(4, "announcements", 1, 1),
  row(2, "Archive", null, 1),
  row(5, "Old rules", 3, 0),
  row(1, "News", null, 0),
  row(3, "Rules", 1, 0),
];

const rules: ContentContainerTreeRules = {
  hierarchy: true,
  maxDepth: 3,
  mode: "manual",
};

const apply = (
  source: readonly ContentContainerTreeRow[],
  placements: readonly ContentContainerPlacement[],
): ContentContainerTreeRow[] =>
  source.map(current => {
    const placement = placements.find(({ id }) => id === current.id);

    return placement ? { ...current, ...placement } : current;
  });

const expectContiguousPositions = (
  result: readonly ContentContainerTreeRow[],
): void => {
  const byParent = new Map<null | number, number[]>();
  for (const { parentId, position } of result) {
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), position]);
  }

  for (const positions of byParent.values()) {
    expect(positions.toSorted((a, b) => a - b)).toEqual(
      positions.map((_, index) => index),
    );
  }
};

const ids = (list: readonly { id: number }[]) => list.map(({ id }) => id);

describe("orderContentContainers", () => {
  it("lists rows in pre-order with their depth, siblings by position", () => {
    expect(
      orderContentContainers(rows).map(({ depth, id }) => [id, depth]),
    ).toEqual([
      [1, 1],
      [3, 2],
      [5, 3],
      [4, 2],
      [2, 1],
      [6, 1],
    ]);
  });

  it("sorts siblings by name, ignoring case, in alphabetical mode", () => {
    expect(ids(orderContentContainers(rows, "alphabetical"))).toEqual([
      2, 6, 1, 4, 3, 5,
    ]);
  });

  it("breaks a position tie by id", () => {
    expect(
      ids(orderContentContainers([row(9, "B", null, 0), row(7, "A", null, 0)])),
    ).toEqual([7, 9]);
  });

  it("surfaces a row whose parent is missing at the root, with its subtree", () => {
    const ordered = orderContentContainers([
      row(1, "Root", null, 0),
      row(2, "Orphan", 99, 0),
      row(3, "Orphan child", 2, 0),
    ]);

    expect(ordered.map(({ depth, id }) => [id, depth])).toEqual([
      [1, 1],
      [2, 1],
      [3, 2],
    ]);
  });

  it("terminates on a cycle and still lists the reachable rows", () => {
    const ordered = orderContentContainers([
      row(1, "Root", null, 0),
      row(2, "A", 3, 0),
      row(3, "B", 2, 0),
      row(4, "Self", 4, 0),
    ]);

    expect(ids(ordered)).toContain(1);
    expect(new Set(ids(ordered)).size).toBe(ordered.length);
  });
});

describe("contentContainerTree", () => {
  it("nests rows under their parents", () => {
    const tree = contentContainerTree(orderContentContainers(rows));

    expect(ids(tree)).toEqual([1, 2, 6]);
    expect(ids(tree[0].children)).toEqual([3, 4]);
    expect(ids(tree[0].children[0].children)).toEqual([5]);
    expect(tree[1].children).toEqual([]);
  });

  it("keeps a row whose parent is not in the list at the root", () => {
    expect(
      ids(
        contentContainerTree([
          { id: 1, parentId: null },
          { id: 2, parentId: 99 },
        ]),
      ),
    ).toEqual([1, 2]);
  });
});

describe("contentContainerAncestors", () => {
  it.each([
    [5, [1, 3]],
    [3, [1]],
    [1, []],
    [99, []],
  ])("lists the ancestors of %i root first", (id, expected) => {
    expect(ids(contentContainerAncestors(rows, id))).toEqual(expected);
  });

  it("terminates on a cycle", () => {
    expect(
      ids(contentContainerAncestors([row(1, "A", 2, 0), row(2, "B", 1, 0)], 1)),
    ).toEqual([2]);
  });
});

describe("contentContainerSubtreeIds", () => {
  it.each([
    [1, [1, 3, 4, 5]],
    [3, [3, 5]],
    [6, [6]],
  ])("collects %i and everything below it", (id, expected) => {
    expect(
      [...contentContainerSubtreeIds(rows, id)].toSorted((a, b) => a - b),
    ).toEqual(expected);
  });
});

describe("planContentContainerCreate", () => {
  const create = (
    parentId: null | number,
    position?: number,
    overrides: Partial<ContentContainerTreeRules> = {},
    source: readonly ContentContainerTreeRow[] = rows,
  ) =>
    planContentContainerCreate(
      source,
      { parentId, position },
      { ...rules, ...overrides },
    );

  const expectValid = (
    plan: ReturnType<typeof create>,
    parentId: null | number,
    source: readonly ContentContainerTreeRow[] = rows,
  ) => {
    if (!plan.ok) throw new Error(`Expected a plan, got ${plan.code}`);
    expectContiguousPositions([
      ...apply(source, plan.shifted),
      row(100, "New", parentId, plan.position),
    ]);
  };

  it.each([
    ["the root", null, 3],
    ["a parent", 1, 2],
    ["a parent without children", 2, 0],
  ])("appends to %s when no position is given", (_label, parentId, at) => {
    const plan = create(parentId);

    expect(plan).toEqual({ ok: true, position: at, shifted: [] });
    expectValid(plan, parentId);
  });

  it("shifts the siblings at and after an explicit position", () => {
    const plan = create(1, 0);

    expect(plan).toEqual({
      ok: true,
      position: 0,
      shifted: [
        { id: 3, parentId: 1, position: 1 },
        { id: 4, parentId: 1, position: 2 },
      ],
    });
    expectValid(plan, 1);
  });

  it("closes gaps in the sibling positions", () => {
    const gappy = [row(1, "A", null, 0), row(2, "B", null, 7)];
    const plan = create(null, 1, {}, gappy);

    expect(plan).toEqual({
      ok: true,
      position: 1,
      shifted: [{ id: 2, parentId: null, position: 2 }],
    });
    expectValid(plan, null, gappy);
  });

  it("ignores the position in alphabetical mode", () => {
    const plan = create(1, 0, { mode: "alphabetical" });

    expect(plan).toEqual({ ok: true, position: 2, shifted: [] });
  });

  it.each([
    ["a position past the end", 1, 3, {}, "invalidPosition"],
    ["a negative position", 1, -1, {}, "invalidPosition"],
    ["a fractional position", 1, 0.5, {}, "invalidPosition"],
    ["a missing parent", 99, undefined, {}, "parentNotFound"],
    ["a parent at the deepest level", 5, undefined, {}, "maxDepth"],
    [
      "any parent when the hierarchy is disabled",
      1,
      undefined,
      { hierarchy: false, maxDepth: 1 },
      "maxDepth",
    ],
  ] as const)("refuses %s", (_label, parentId, position, overrides, code) => {
    expect(create(parentId, position, overrides)).toEqual({ code, ok: false });
  });

  it("still allows a root when the hierarchy is disabled", () => {
    expect(create(null, 0, { hierarchy: false, maxDepth: 1 }).ok).toBe(true);
  });
});

describe("planContentContainerMove", () => {
  const move = (
    id: number,
    parentId: null | number,
    position: number,
    overrides: Partial<ContentContainerTreeRules> = {},
  ) =>
    planContentContainerMove(
      rows,
      { id, parentId, position },
      { ...rules, ...overrides },
    );

  const expectMoved = (
    plan: ReturnType<typeof move>,
    id: number,
    parentId: null | number,
  ) => {
    if (!plan.ok) throw new Error(`Expected a plan, got ${plan.code}`);
    const result = apply(rows, plan.placements);

    expect(result.find(current => current.id === id)?.parentId).toBe(parentId);
    expectContiguousPositions(result);
  };

  it("reorders siblings", () => {
    const plan = move(4, 1, 0);

    expect(plan).toEqual({
      ok: true,
      placements: [
        { id: 4, parentId: 1, position: 0 },
        { id: 3, parentId: 1, position: 1 },
      ],
    });
    expectMoved(plan, 4, 1);
  });

  it("renumbers both sibling lists when moving to another parent", () => {
    const plan = move(3, null, 0);

    expect(plan).toEqual({
      ok: true,
      placements: [
        { id: 3, parentId: null, position: 0 },
        { id: 1, parentId: null, position: 1 },
        { id: 2, parentId: null, position: 2 },
        { id: 6, parentId: null, position: 3 },
        { id: 4, parentId: 1, position: 0 },
      ],
    });
    expectMoved(plan, 3, null);
  });

  it.each([
    ["a leaf under a sibling", 4, 3, 1],
    ["a subtree that just fits", 3, 2, 0],
    ["a node to the end of the root", 5, null, 3],
  ])("allows %s", (_label, id, parentId, position) => {
    expectMoved(move(id, parentId, position), id, parentId);
  });

  it("returns no placements for a move to where it already is", () => {
    expect(move(3, 1, 0)).toEqual({ ok: true, placements: [] });
  });

  it("appends regardless of position in alphabetical mode", () => {
    const plan = move(3, null, 0, { mode: "alphabetical" });

    expect(plan).toEqual({
      ok: true,
      placements: [
        { id: 3, parentId: null, position: 3 },
        { id: 4, parentId: 1, position: 0 },
      ],
    });
    expectMoved(plan, 3, null);
  });

  it.each([
    ["a missing container", 99, null, 0, {}, "notFound"],
    ["a container under itself", 1, 1, 0, {}, "cycle"],
    ["a container under its child", 1, 3, 0, {}, "cycle"],
    ["a container under its grandchild", 1, 5, 0, {}, "cycle"],
    ["a missing parent", 4, 99, 0, {}, "parentNotFound"],
    ["a subtree that would end too deep", 3, 4, 0, {}, "maxDepth"],
    ["a leaf under the deepest level", 4, 5, 0, {}, "maxDepth"],
    [
      "any parent when the hierarchy is disabled",
      6,
      2,
      0,
      { hierarchy: false, maxDepth: 1 },
      "maxDepth",
    ],
    ["a position past the end", 4, 2, 1, {}, "invalidPosition"],
    ["a negative position", 4, 1, -1, {}, "invalidPosition"],
    ["a position past the end among siblings", 4, 1, 2, {}, "invalidPosition"],
  ] as const)(
    "refuses %s",
    (_label, id, parentId, position, overrides, code) => {
      expect(move(id, parentId, position, overrides)).toEqual({
        code,
        ok: false,
      });
    },
  );
});

describe("planContentContainerDelete", () => {
  it("closes the gap among the siblings", () => {
    const plan = planContentContainerDelete(rows, 2);

    expect(plan).toEqual({
      ok: true,
      shifted: [{ id: 6, parentId: null, position: 1 }],
    });
    if (plan.ok) {
      expectContiguousPositions(
        apply(
          rows.filter(current => current.id !== 2),
          plan.shifted,
        ),
      );
    }
  });

  it("shifts nothing for the last sibling", () => {
    expect(planContentContainerDelete(rows, 4)).toEqual({
      ok: true,
      shifted: [],
    });
  });

  it.each([
    ["a container with children", 3, "hasChildren"],
    ["a missing container", 99, "notFound"],
  ] as const)("refuses %s", (_label, id, code) => {
    expect(planContentContainerDelete(rows, id)).toEqual({ code, ok: false });
  });
});
