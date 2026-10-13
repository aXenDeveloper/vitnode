import type {
  ContentContainerErrorCode,
  ContentContainerOrderingMode,
} from "./types";

/** The four columns every tree operation reads. */
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
    // A parent outside the set - another definition's row, or one this read
    // could not see - would orphan the subtree. It is shown at the root rather
    // than silently dropped.
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

/**
 * Every row in tree order - each parent followed by its subtree, siblings in
 * their sibling order - with its depth. One pass over rows a single query read,
 * which is what keeps a tree read free of N+1.
 */
export const orderContentContainers = <TRow extends ContentContainerTreeRow>(
  rows: readonly TRow[],
  mode: ContentContainerOrderingMode = "manual",
): (TRow & { depth: number })[] => {
  const byParent = childrenByParent(rows, mode);
  const ordered: (TRow & { depth: number })[] = [];
  const visited = new Set<number>();

  const walk = (parent: null | number, depth: number): void => {
    for (const row of byParent.get(parent) ?? []) {
      // A cycle cannot be written through the service, but a hand-edited row
      // must not hang a read.
      if (visited.has(row.id)) continue;
      visited.add(row.id);
      ordered.push({ ...row, depth });
      walk(row.id, depth + 1);
    }
  };
  walk(null, 1);

  return ordered;
};

/**
 * Nests a list in tree order - what the list routes return - into a tree.
 * Works on any rows with `id` and `parentId`, so it nests public and admin
 * records alike.
 */
export const contentContainerTree = <
  TRow extends { id: number; parentId: null | number },
>(
  rows: readonly TRow[],
): ContentContainerTreeNode<TRow>[] => {
  const nodes = new Map<number, ContentContainerTreeNode<TRow>>();
  const roots: ContentContainerTreeNode<TRow>[] = [];

  for (const row of rows) nodes.set(row.id, { ...row, children: [] });

  for (const row of rows) {
    const node = nodes.get(row.id);
    if (!node) continue;
    const parent = row.parentId === null ? undefined : nodes.get(row.parentId);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
};

/** Root first, the container's parent last. Empty for a root. */
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

/** The container itself and everything below it. */
export const contentContainerSubtreeIds = (
  rows: readonly ContentContainerTreeRow[],
  id: number,
): Set<number> => {
  const children = new Map<number, number[]>();
  for (const row of rows) {
    if (row.parentId === null) continue;
    children.set(row.parentId, [...(children.get(row.parentId) ?? []), row.id]);
  }

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

/** 1 for a root. */
export const contentContainerDepth = (
  rows: readonly ContentContainerTreeRow[],
  id: number,
): number => contentContainerAncestors(rows, id).length + 1;

/** How many levels the subtree spans, the container included. 1 for a leaf. */
const subtreeHeight = (
  rows: readonly ContentContainerTreeRow[],
  id: number,
): number => {
  const children = new Map<number, number[]>();
  for (const row of rows) {
    if (row.parentId === null) continue;
    children.set(row.parentId, [...(children.get(row.parentId) ?? []), row.id]);
  }

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

/** Renumbers a sibling list 0..n-1 and reports only the rows that moved. */
const renumber = (
  siblings: readonly ContentContainerTreeRow[],
  parentId: null | number,
): ContentContainerPlacement[] =>
  siblings.flatMap((row, position) =>
    row.position === position && row.parentId === parentId
      ? []
      : [{ id: row.id, parentId, position }],
  );

const siblingsOf = (
  rows: readonly ContentContainerTreeRow[],
  parentId: null | number,
  mode: ContentContainerOrderingMode,
): ContentContainerTreeRow[] =>
  rows
    .filter(row => row.parentId === parentId)
    .sort(compareSiblings(mode === "alphabetical" ? "manual" : mode));

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

/**
 * Where a new container goes. `rows` is every container of the definition, as
 * read inside the transaction that will insert it.
 */
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

  const siblings = siblingsOf(rows, parentId, rules.mode);
  const at =
    rules.mode === "alphabetical" || position === undefined
      ? siblings.length
      : position;
  if (!Number.isInteger(at) || at < 0 || at > siblings.length) {
    return { code: "invalidPosition", ok: false };
  }

  // Everything at or after the slot moves down one, so the new row lands
  // exactly where it was asked for and the sibling positions stay 0..n.
  const shifted = siblings.flatMap((row, index) => {
    const next = index < at ? index : index + 1;

    return row.position === next
      ? []
      : [{ id: row.id, parentId, position: next }];
  });

  return { ok: true, position: at, shifted };
};

/**
 * A move to another parent, a reorder among siblings, or both. Every rule is
 * checked before anything is planned, so a refused move changes nothing.
 */
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
  const target = siblingsOf(remaining, parentId, rules.mode);
  const at = rules.mode === "alphabetical" ? target.length : position;
  if (!Number.isInteger(at) || at < 0 || at > target.length) {
    return { code: "invalidPosition", ok: false };
  }

  const placed = [...target];
  placed.splice(at, 0, node);

  const placements = renumber(placed, parentId);
  if (node.parentId !== parentId) {
    placements.push(
      ...renumber(
        siblingsOf(remaining, node.parentId, rules.mode),
        node.parentId,
      ),
    );
  }

  return { ok: true, placements };
};

/** Closes the gap a deleted container leaves among its siblings. */
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
      siblingsOf(
        rows.filter(row => row.id !== id),
        node.parentId,
        "manual",
      ),
      node.parentId,
    ),
  };
};
