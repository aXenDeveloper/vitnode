import { describe, expect, it } from "vitest";

import type { ContentCommentNode } from "./thread";

import {
  buildContentCommentTree,
  contentCommentWriteOutcome,
  countContentCommentReplies,
  shareContentCommentTree,
} from "./thread";

const node = <TId extends number | string>(
  id: TId,
  parentId: null | TId,
  depth = 1,
): ContentCommentNode<{ text: string }, TId> => ({
  deleted: null,
  depth,
  hidden: false,
  hiddenReason: null,
  id,
  parentId,
  record: { text: String(id) },
  removed: false,
});

interface Shape {
  children: Shape[];
  id: number | string;
}

const shape = (nodes: Shape[]): unknown =>
  nodes.map(({ children, id }) => ({ children: shape(children), id }));

describe("buildContentCommentTree", () => {
  it.each<{
    ids: (number | string)[];
    name: string;
    parents: (null | number | string)[];
  }>([
    {
      ids: [1, 2, 3, 4, 5, 6],
      name: "number ids",
      parents: [null, 1, 2, 1, null, 5],
    },
    {
      ids: ["a", "b", "c", "d", "e", "f"],
      name: "string ids",
      parents: [null, "a", "b", "a", null, "e"],
    },
  ])("nests replies under their parents with $name", ({ ids, parents }) => {
    const items = ids.map((id, index) => node(id, parents[index]));

    expect(shape(buildContentCommentTree(items))).toStrictEqual([
      {
        children: [
          { children: [{ children: [], id: ids[2] }], id: ids[1] },
          { children: [], id: ids[3] },
        ],
        id: ids[0],
      },
      { children: [{ children: [], id: ids[5] }], id: ids[4] },
    ]);
  });

  it("keeps a reply whose parent is not loaded as a top-level entry, in order", () => {
    const tree = buildContentCommentTree([
      node(1, null),
      node(7, 99, 2),
      node(8, 7, 3),
      node(2, null),
    ]);

    expect(shape(tree)).toStrictEqual([
      { children: [], id: 1 },
      { children: [{ children: [], id: 8 }], id: 7 },
      { children: [], id: 2 },
    ]);
    expect(tree[1].record).toStrictEqual({ text: "7" });
  });
});

describe("shareContentCommentTree", () => {
  // Records keep their identity across reads, as the query cache's
  // structural sharing hands them back.
  const items = [node(1, null), node(2, 1, 2), node(3, null), node(4, 3, 2)];

  it("reuses every node of a branch that did not change", () => {
    const previous = buildContentCommentTree(items);
    const changed = [...items];
    changed[3] = { ...changed[3], record: { text: "edited" } };

    const shared = shareContentCommentTree(
      previous,
      buildContentCommentTree(changed),
    );

    expect(shared).not.toBe(previous);
    expect(shared[0]).toBe(previous[0]);
    expect(shared[0].children[0]).toBe(previous[0].children[0]);
    expect(shared[1]).not.toBe(previous[1]);
    expect(shared[1].children[0].record).toStrictEqual({ text: "edited" });
  });

  it("hands back the previous tree when nothing changed", () => {
    const previous = buildContentCommentTree(items);

    expect(
      shareContentCommentTree(previous, buildContentCommentTree([...items])),
    ).toBe(previous);
  });
});

describe("countContentCommentReplies", () => {
  it("counts every reply below a node, at any depth", () => {
    const [first, second] = buildContentCommentTree([
      node(1, null),
      node(2, 1, 2),
      node(3, 2, 3),
      node(4, 3, 4),
      node(5, 1, 2),
      node(6, null),
    ]);

    expect(countContentCommentReplies(first)).toBe(4);
    expect(countContentCommentReplies(second)).toBe(0);
  });
});

describe("contentCommentWriteOutcome", () => {
  it.each([
    { approval: { status: "pending" }, expected: "pending", status: "draft" },
    {
      approval: { status: "pending" },
      expected: "pending",
      status: "published",
    },
    { approval: null, expected: "published", status: "published" },
    {
      approval: { status: "approved" },
      expected: "published",
      status: "published",
    },
    { approval: null, expected: "draft", status: "draft" },
    { approval: { status: "rejected" }, expected: "draft", status: "archived" },
  ])(
    "reads status $status with approval $approval as $expected",
    ({ approval, expected, status }) => {
      expect(contentCommentWriteOutcome({ approval, status })).toBe(expected);
    },
  );
});
