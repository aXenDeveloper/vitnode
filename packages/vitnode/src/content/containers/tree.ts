import type {
  ContentContainerErrorCode,
  ContentContainerOrderingMode,
} from "./types";

export interface ContentContainerTreeRow {
  id: number;
  name: string;
  parentId: null | number;
  position: number;
}

export type ContentContainerTreeNode<TRow> = TRow & {
  children: ContentContainerTreeNode<TRow>[];
};

export interface ContentContainerPlacement {
  id: number;
  parentId: null | number;
  position: number;
}

export type ContentContainerPlan<TValue> =
  | (TValue & { ok: true })
  | { code: ContentContainerErrorCode; ok: false };

const compareSiblings =
  (mode: ContentContainerOrderingMode) =>
  (a: ContentContainerTreeRow, b: ContentContainerTreeRow): number => {
    if (mode === "alphabetical") {
      const byName = a.name.localeCompare(b.name, undefined, {
        sensitivity: "base",
      });
      if (byName !== 0) return byName;
    } else if (a.position !== b.position) {
      return a.position - b.position;
    }

    return a.id - b.id;
  };

const childrenByParent = <TRow extends ContentContainerTreeRow>(
  rows: readonly TRow[],
  mode: ContentContainerOrderingMode,
): Map<null | number, TRow[]> => {
  const known = new Set(rows.map(row => row.id));
  const byParent = new Map<null | number, TRow[]>();

  for (const row of rows) {
    const parent =
      row.parentId !== null && known.has(row.parentId) ? row.parentId : null;
    const siblings = byParent.get(parent) ?? [];
    siblings.push(row);
    byParent.set(parent, siblings);
  }

  const compare = compareSiblings(mode);
  for (const siblings of byParent.values()) siblings.sort(compare);

  return byParent;
};

export const orderContentContainers = <TRow extends ContentContainerTreeRow>(
  rows: readonly TRow[],
  mode: ContentContainerOrderingMode = "manual",
): (TRow & { depth: number })[] => {
  const byParent = childrenByParent(rows, mode);
  const ordered: (TRow & { depth: number })[] = [];
  const visited = new Set<number>();

  const walk = (parent: null | number, depth: number): void => {
    for (const row of byParent.get(parent) ?? []) {
      if (visited.has(row.id)) continue;
      visited.add(row.id);
      ordered.push({ ...row, depth });
      walk(row.id, depth + 1);
    }
  };
  walk(null, 1);

  return ordered;
};

export const contentContainerTree = <
  TRow extends { id: number; parentId: null | number },
>(
  rows: readonly TRow[],
): ContentContainerTreeNode<TRow>[] => {
  const nodes = new Map<number, ContentContainerTreeNode<TRow>>();
  const roots: ContentContainerTreeNode<TRow>[] = [];

  for (const row of rows) nodes.set(row.id, { ...row, children: [] });

  for (const node of nodes.values()) {
    const parent =
      node.parentId === null ? undefined : nodes.get(node.parentId);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
};

export const contentContainerAncestors = <TRow extends ContentContainerTreeRow>(
  rows: readonly TRow[],
  id: number,
): TRow[] => {
  const byId = new Map(rows.map(row => [row.id, row]));
  const ancestors: TRow[] = [];
  const seen = new Set<number>([id]);
  let parentId = byId.get(id)?.parentId ?? null;

  while (parentId !== null && !seen.has(parentId)) {
    const parent = byId.get(parentId);
    if (!parent) break;
    seen.add(parentId);
    ancestors.unshift(parent);
    parentId = parent.parentId;
  }

  return ancestors;
};

/** All a parent/child walk reads off a row. */
type ContentContainerLinkRow = Pick<ContentContainerTreeRow, "id" | "parentId">;

const childIdsByParent = (
  rows: readonly ContentContainerLinkRow[],
): Map<number, number[]> => {
  const children = new Map<number, number[]>();
  for (const row of rows) {
    if (row.parentId === null) continue;
    children.set(row.parentId, [...(children.get(row.parentId) ?? []), row.id]);
  }

  return children;
};

export const contentContainerSubtreeIds = (
  rows: readonly ContentContainerLinkRow[],
  id: number,
): Set<number> => {
  const children = childIdsByParent(rows);
  const subtree = new Set<number>();
  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined || subtree.has(current)) continue;
    subtree.add(current);
    stack.push(...(children.get(current) ?? []));
  }

  return subtree;
};

export const contentContainerDepth = (
  rows: readonly ContentContainerTreeRow[],
  id: number,
): number => contentContainerAncestors(rows, id).length + 1;

const subtreeHeight = (
  rows: readonly ContentContainerTreeRow[],
  id: number,
): number => {
  const children = childIdsByParent(rows);
  const height = (current: number, seen: Set<number>): number => {
    if (seen.has(current)) return 0;
    const next = new Set(seen).add(current);

    return (
      1 +
      Math.max(
        0,
        ...(children.get(current) ?? []).map(child => height(child, next)),
      )
    );
  };

  return height(id, new Set());
};

const renumber = (
  siblings: readonly ContentContainerTreeRow[],
  parentId: null | number,
): ContentContainerPlacement[] =>
  siblings.flatMap((row, position) =>
    row.position === position && row.parentId === parentId
      ? []
      : [{ id: row.id, parentId, position }],
  );

const siblingsByPosition = (
  rows: readonly ContentContainerTreeRow[],
  parentId: null | number,
): ContentContainerTreeRow[] =>
  rows.filter(row => row.parentId === parentId).sort(compareSiblings("manual"));

const checkParent = (
  rows: readonly ContentContainerTreeRow[],
  parentId: null | number,
  { hierarchy, maxDepth }: { hierarchy: boolean; maxDepth: number },
  subtree = 1,
): ContentContainerErrorCode | null => {
  if (parentId === null) return subtree > maxDepth ? "maxDepth" : null;
  if (!hierarchy) return "maxDepth";
  if (!rows.some(row => row.id === parentId)) return "parentNotFound";

  return contentContainerDepth(rows, parentId) + subtree > maxDepth
    ? "maxDepth"
    : null;
};

export interface ContentContainerTreeRules {
  hierarchy: boolean;
  maxDepth: number;
  mode: ContentContainerOrderingMode;
}

export const planContentContainerCreate = (
  rows: readonly ContentContainerTreeRow[],
  {
    parentId,
    position,
  }: { parentId: null | number; position: number | undefined },
  rules: ContentContainerTreeRules,
): ContentContainerPlan<{
  position: number;
  shifted: ContentContainerPlacement[];
}> => {
  const problem = checkParent(rows, parentId, rules);
  if (problem) return { code: problem, ok: false };

  const siblings = siblingsByPosition(rows, parentId);
  const at =
    rules.mode === "alphabetical" || position === undefined
      ? siblings.length
      : position;
  if (!Number.isInteger(at) || at < 0 || at > siblings.length) {
    return { code: "invalidPosition", ok: false };
  }

  const shifted = siblings.flatMap((row, index) => {
    const next = index < at ? index : index + 1;

    return row.position === next
      ? []
      : [{ id: row.id, parentId, position: next }];
  });

  return { ok: true, position: at, shifted };
};

export const planContentContainerMove = (
  rows: readonly ContentContainerTreeRow[],
  {
    id,
    parentId,
    position,
  }: { id: number; parentId: null | number; position: number },
  rules: ContentContainerTreeRules,
): ContentContainerPlan<{ placements: ContentContainerPlacement[] }> => {
  const node = rows.find(row => row.id === id);
  if (!node) return { code: "notFound", ok: false };

  if (parentId !== null) {
    if (parentId === id) return { code: "cycle", ok: false };
    if (!rows.some(row => row.id === parentId)) {
      return { code: "parentNotFound", ok: false };
    }
    if (contentContainerSubtreeIds(rows, id).has(parentId)) {
      return { code: "cycle", ok: false };
    }
  }

  const problem = checkParent(rows, parentId, rules, subtreeHeight(rows, id));
  if (problem) return { code: problem, ok: false };

  const remaining = rows.filter(row => row.id !== id);
  const target = siblingsByPosition(remaining, parentId);
  const at = rules.mode === "alphabetical" ? target.length : position;
  if (!Number.isInteger(at) || at < 0 || at > target.length) {
    return { code: "invalidPosition", ok: false };
  }

  const placed = [...target];
  placed.splice(at, 0, node);

  const placements = renumber(placed, parentId);
  if (node.parentId !== parentId) {
    placements.push(
      ...renumber(siblingsByPosition(remaining, node.parentId), node.parentId),
    );
  }

  return { ok: true, placements };
};

export const planContentContainerDelete = (
  rows: readonly ContentContainerTreeRow[],
  id: number,
): ContentContainerPlan<{ shifted: ContentContainerPlacement[] }> => {
  const node = rows.find(row => row.id === id);
  if (!node) return { code: "notFound", ok: false };
  if (rows.some(row => row.parentId === id)) {
    return { code: "hasChildren", ok: false };
  }

  return {
    ok: true,
    shifted: renumber(
      siblingsByPosition(
        rows.filter(row => row.id !== id),
        node.parentId,
      ),
      node.parentId,
    ),
  };
};
