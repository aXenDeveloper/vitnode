import { arrayMove } from "@dnd-kit/sortable";

import type {
  ContentContainerPlacement,
  ContentContainerTreeRules,
} from "@/content/containers/tree";
import type {
  AnyContentContainerDefinition,
  ContentContainerErrorCode,
} from "@/content/containers/types";

import {
  contentContainerAncestors,
  orderContentContainers,
  planContentContainerMove,
} from "@/content/containers/tree";

import type { AdminContentContainer } from "./container-request";

/** One indentation level, in pixels - `ms-3` plus `w-3` per guide. */
export const CONTAINER_INDENTATION_PX = 24;

export const containerTreeRules = (
  definition: Pick<AnyContentContainerDefinition, "hierarchy" | "ordering">,
): ContentContainerTreeRules => ({
  hierarchy: definition.hierarchy.enabled,
  maxDepth: definition.hierarchy.maxDepth,
  mode: definition.ordering.mode,
});

/** Whether anything can be dragged at all: a reorder, or a move to another parent. */
export const canRearrangeContainers = (rules: ContentContainerTreeRules) =>
  rules.mode === "manual" || rules.hierarchy;

export const containerChildCounts = (
  records: readonly AdminContentContainer[],
): Map<number, number> => {
  const counts = new Map<number, number>();
  for (const record of records) {
    if (record.parentId === null) continue;
    counts.set(record.parentId, (counts.get(record.parentId) ?? 0) + 1);
  }

  return counts;
};

/**
 * The records below `id`, in tree order. Records arrive in tree order - each
 * parent followed by its subtree - so a subtree is the run of deeper rows
 * straight after it.
 */
export const containerDescendants = (
  records: readonly AdminContentContainer[],
  id: number,
): AdminContentContainer[] => {
  const at = records.findIndex(record => record.id === id);
  if (at === -1) return [];

  const { depth } = records[at];
  const descendants: AdminContentContainer[] = [];
  for (const record of records.slice(at + 1)) {
    if (record.depth <= depth) break;
    descendants.push(record);
  }

  return descendants;
};

/** Records whose ancestor is collapsed, which the list does not render. */
export const visibleContainers = (
  records: readonly AdminContentContainer[],
  collapsed: ReadonlySet<number>,
): AdminContentContainer[] => {
  const visible: AdminContentContainer[] = [];
  let hiddenBelow: null | number = null;

  for (const record of records) {
    if (hiddenBelow !== null && record.depth > hiddenBelow) continue;
    hiddenBelow = collapsed.has(record.id) ? record.depth : null;
    visible.push(record);
  }

  return visible;
};

export type ContainerMoveCheck =
  | { code: ContentContainerErrorCode; kind: "invalid" }
  | { kind: "move"; placements: ContentContainerPlacement[] }
  | { kind: "unchanged" };

/**
 * `planContentContainerMove`, read as the three things the screen does with it:
 * refuse, persist, or ignore. In alphabetical mode the position is the server's
 * to choose, so staying under the same parent is never a move.
 */
export const checkContainerMove = (
  records: readonly AdminContentContainer[],
  move: { id: number; parentId: null | number; position: number },
  rules: ContentContainerTreeRules,
): ContainerMoveCheck => {
  const current = records.find(record => record.id === move.id);
  if (rules.mode === "alphabetical" && current?.parentId === move.parentId) {
    return { kind: "unchanged" };
  }

  const plan = planContentContainerMove(records, move, rules);
  if (!plan.ok) return { code: plan.code, kind: "invalid" };

  return plan.placements.length === 0
    ? { kind: "unchanged" }
    : { kind: "move", placements: plan.placements };
};

/** The optimistic tree: the planned placements applied, re-sorted, re-depthed. */
export const applyContainerPlacements = (
  records: readonly AdminContentContainer[],
  placements: readonly ContentContainerPlacement[],
  rules: ContentContainerTreeRules,
): AdminContentContainer[] => {
  const byId = new Map(placements.map(placement => [placement.id, placement]));

  return orderContentContainers(
    records.map(record => {
      const placement = byId.get(record.id);

      return placement
        ? {
            ...record,
            parentId: placement.parentId,
            position: placement.position,
          }
        : record;
    }),
    rules.mode,
  );
};

export interface ContainerDropProjection {
  check: ContainerMoveCheck;
  depth: number;
  parentId: null | number;
  /** Zero-based, among the new siblings once the container has left its place. */
  position: number;
}

const parentAt = (
  entries: readonly AdminContentContainer[],
  index: number,
  depth: number,
): null | number => {
  if (depth <= 1) return null;

  for (let at = index - 1; at >= 0; at -= 1) {
    if (entries[at].depth === depth - 1) return entries[at].id;
    if (entries[at].depth < depth - 1) break;
  }

  return null;
};

/**
 * Where a drop lands: the row it is over picks the slot, the horizontal offset
 * picks the depth - one level per {@link CONTAINER_INDENTATION_PX} - clamped to
 * what the neighbours allow. `visible` is the rendered list without the dragged
 * container's own subtree, which travels with it.
 */
export const projectContainerDrop = ({
  activeId,
  offsetLeft,
  overId,
  records,
  rules,
  visible,
}: {
  activeId: number;
  offsetLeft: number;
  overId: number;
  records: readonly AdminContentContainer[];
  rules: ContentContainerTreeRules;
  visible: readonly AdminContentContainer[];
}): ContainerDropProjection | null => {
  const from = visible.findIndex(record => record.id === activeId);
  const to = visible.findIndex(record => record.id === overId);
  if (from === -1 || to === -1) return null;

  const moved = arrayMove([...visible], from, to);
  const active = visible[from];
  const previous = moved[to - 1] as AdminContentContainer | undefined;
  const next = moved[to + 1] as AdminContentContainer | undefined;

  const projected =
    active.depth + Math.round(offsetLeft / CONTAINER_INDENTATION_PX);
  const maxDepth = rules.hierarchy ? (previous ? previous.depth + 1 : 1) : 1;
  const minDepth = rules.hierarchy && next ? next.depth : 1;
  const depth = Math.max(1, Math.min(Math.max(projected, minDepth), maxDepth));
  const parentId = parentAt(moved, to, depth);
  const position = moved
    .slice(0, to)
    .filter(
      record => record.id !== activeId && record.parentId === parentId,
    ).length;

  return {
    check: checkContainerMove(
      records,
      { id: activeId, parentId, position },
      rules,
    ),
    depth,
    parentId,
    position,
  };
};

export const containerSiblings = (
  records: readonly AdminContentContainer[],
  parentId: null | number,
): AdminContentContainer[] =>
  records.filter(record => record.parentId === parentId);

/** One step up or down among its siblings - the keyboard alternative to a drag. */
export const shiftContainerMove = (
  records: readonly AdminContentContainer[],
  id: number,
  step: -1 | 1,
): null | { id: number; parentId: null | number; position: number } => {
  const record = records.find(entry => entry.id === id);
  if (!record) return null;

  const siblings = containerSiblings(records, record.parentId);
  const at = siblings.findIndex(entry => entry.id === id);
  const position = at + step;
  if (at === -1 || position < 0 || position >= siblings.length) return null;

  return { id, parentId: record.parentId, position };
};

/** Out to the top level, right after the root it used to live under. */
export const rootContainerMove = (
  records: readonly AdminContentContainer[],
  id: number,
): null | { id: number; parentId: null; position: number } => {
  const record = records.find(entry => entry.id === id);
  if (record?.parentId === null || record === undefined) return null;

  const root = contentContainerAncestors(records, id)[0];
  const roots = containerSiblings(records, null);

  return {
    id,
    parentId: null,
    position: root ? roots.findIndex(entry => entry.id === root.id) + 1 : 0,
  };
};

/** Every container `id` may move inside of - last among its children - with the plan's blessing. */
export const containerParentTargets = (
  records: readonly AdminContentContainer[],
  id: number,
  rules: ContentContainerTreeRules,
): AdminContentContainer[] => {
  if (!rules.hierarchy) return [];

  const record = records.find(entry => entry.id === id);
  const counts = containerChildCounts(records);

  return records.filter(
    target =>
      target.id !== record?.parentId &&
      checkContainerMove(
        records,
        { id, parentId: target.id, position: counts.get(target.id) ?? 0 },
        rules,
      ).kind === "move",
  );
};
