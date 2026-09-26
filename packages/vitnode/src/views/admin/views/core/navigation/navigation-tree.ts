import { arrayMove } from "@dnd-kit/sortable";

import { NAVIGATION_MAX_DEPTH } from "@/lib/navigation";

import type { AdminNavigationItem } from "./navigation-query";

export type NavigationDepth = 0 | 1;

export interface FlattenedNavigationItem {
  depth: NavigationDepth;
  item: AdminNavigationItem;
  parentId: null | number;
}

export interface NavigationOrderBody {
  items: { children: number[]; id: number }[];
}

export interface NavigationDropProjection {
  depth: NavigationDepth;
  parentId: null | number;
}

export const NAVIGATION_INDENTATION_PX = 40;

/**
 * The icon a row draws: the item's own, else the one its plugin ships with the
 * prebuilt page, else none.
 */
export const navigationItemIcon = (
  item: Pick<AdminNavigationItem, "icon" | "preset">,
): null | string => item.icon ?? item.preset?.icon ?? null;

const byPosition = (a: AdminNavigationItem, b: AdminNavigationItem): number =>
  a.position - b.position || a.id - b.id;

export const flattenNavigationItems = (
  items: readonly AdminNavigationItem[],
): FlattenedNavigationItem[] => {
  const sorted = [...items].sort(byPosition);
  const byId = new Map(sorted.map(item => [item.id, item]));
  const parentOf = (item: AdminNavigationItem): null | number => {
    if (item.parentId === null) return null;

    const parent = byId.get(item.parentId);

    return parent?.parentId === null ? parent.id : null;
  };

  const children = new Map<number, AdminNavigationItem[]>();
  for (const item of sorted) {
    const parentId = parentOf(item);
    if (parentId === null) continue;

    children.set(parentId, [...(children.get(parentId) ?? []), item]);
  }

  return sorted
    .filter(item => parentOf(item) === null)
    .flatMap(root => [
      { depth: 0 as const, item: root, parentId: null },
      ...(children.get(root.id) ?? []).map(child => ({
        depth: 1 as const,
        item: child,
        parentId: root.id,
      })),
    ]);
};

export const childrenOfNavigation = (
  flattened: readonly FlattenedNavigationItem[],
  id: number,
): FlattenedNavigationItem[] =>
  flattened.filter(entry => entry.parentId === id);

export const withoutNavigationChildrenOf = (
  flattened: readonly FlattenedNavigationItem[],
  id: number,
): FlattenedNavigationItem[] =>
  flattened.filter(entry => entry.parentId !== id);

const clampDepth = (
  depth: number,
  min: number,
  max: number,
): NavigationDepth => {
  const clamped = Math.min(Math.max(depth, min), max);

  return clamped >= 1 ? 1 : 0;
};

const parentBefore = (
  entries: readonly FlattenedNavigationItem[],
  index: number,
): null | number => {
  for (let at = index - 1; at >= 0; at -= 1) {
    if (entries[at].depth === 0) return entries[at].item.id;
  }

  return null;
};

export const projectNavigationDrop = ({
  activeHasChildren,
  activeId,
  flattened,
  indentationWidth,
  offsetLeft,
  overId,
}: {
  activeHasChildren: boolean;
  activeId: number;
  flattened: readonly FlattenedNavigationItem[];
  indentationWidth: number;
  offsetLeft: number;
  overId: number;
}): NavigationDropProjection | null => {
  const from = flattened.findIndex(entry => entry.item.id === activeId);
  const to = flattened.findIndex(entry => entry.item.id === overId);
  if (from === -1 || to === -1) return null;

  const moved = arrayMove([...flattened], from, to);
  const active = flattened[from];
  const previous = moved[to - 1];
  const next = moved[to + 1];

  const projected = active.depth + Math.round(offsetLeft / indentationWidth);
  const maxDepth = activeHasChildren
    ? 0
    : previous
      ? Math.min(previous.depth + 1, NAVIGATION_MAX_DEPTH)
      : 0;
  const minDepth = next ? next.depth : 0;
  const depth = clampDepth(projected, minDepth, maxDepth);

  return {
    depth,
    parentId: depth === 0 ? null : parentBefore(moved, to),
  };
};

export const applyNavigationDrop = ({
  activeId,
  children,
  flattened,
  overId,
  projection,
}: {
  activeId: number;
  children: readonly FlattenedNavigationItem[];
  flattened: readonly FlattenedNavigationItem[];
  overId: number;
  projection: NavigationDropProjection;
}): FlattenedNavigationItem[] => {
  const from = flattened.findIndex(entry => entry.item.id === activeId);
  const to = flattened.findIndex(entry => entry.item.id === overId);
  if (from === -1 || to === -1) return [...flattened];

  const moved = arrayMove([...flattened], from, to);
  moved[to] = {
    ...moved[to],
    depth: projection.depth,
    parentId: projection.parentId,
  };
  moved.splice(to + 1, 0, ...children);

  return moved.map((entry, index, all) =>
    entry.depth === 0
      ? { ...entry, parentId: null }
      : { ...entry, parentId: parentBefore(all, index) },
  );
};

export const navigationOrderBody = (
  flattened: readonly FlattenedNavigationItem[],
): NavigationOrderBody => {
  const items: NavigationOrderBody["items"] = [];

  for (const entry of flattened) {
    if (entry.depth === 0 || items.length === 0) {
      items.push({ children: [], id: entry.item.id });
      continue;
    }

    items[items.length - 1].children.push(entry.item.id);
  }

  return { items };
};

export const sameNavigationOrder = (
  a: NavigationOrderBody,
  b: NavigationOrderBody,
): boolean =>
  a.items.length === b.items.length &&
  a.items.every(
    (entry, index) =>
      entry.id === b.items[index].id &&
      entry.children.length === b.items[index].children.length &&
      entry.children.every((id, at) => id === b.items[index].children[at]),
  );

export const navigationItemsFrom = (
  flattened: readonly FlattenedNavigationItem[],
): AdminNavigationItem[] => {
  const positions = new Map<null | number, number>();

  return flattened.map(entry => {
    const position = positions.get(entry.parentId) ?? 0;
    positions.set(entry.parentId, position + 1);

    return { ...entry.item, parentId: entry.parentId, position };
  });
};

const regroupNavigation = (
  order: NavigationOrderBody,
  flattened: readonly FlattenedNavigationItem[],
): FlattenedNavigationItem[] => {
  const byId = new Map(flattened.map(entry => [entry.item.id, entry.item]));

  return order.items.flatMap(group => {
    const root = byId.get(group.id);
    if (!root) return [];

    return [
      { depth: 0 as const, item: root, parentId: null },
      ...group.children.flatMap(childId => {
        const child = byId.get(childId);

        return child
          ? [{ depth: 1 as const, item: child, parentId: group.id }]
          : [];
      }),
    ];
  });
};

export const shiftNavigationItem = ({
  flattened,
  id,
  step,
}: {
  flattened: readonly FlattenedNavigationItem[];
  id: number;
  step: -1 | 1;
}): FlattenedNavigationItem[] => {
  const { items } = navigationOrderBody(flattened);
  const rootAt = items.findIndex(group => group.id === id);

  if (rootAt !== -1) {
    const target = rootAt + step;
    if (target < 0 || target >= items.length) return [...flattened];

    return regroupNavigation(
      { items: arrayMove(items, rootAt, target) },
      flattened,
    );
  }

  return regroupNavigation(
    {
      items: items.map(group => {
        const at = group.children.indexOf(id);
        const target = at + step;
        if (at === -1 || target < 0 || target >= group.children.length) {
          return group;
        }

        return { ...group, children: arrayMove(group.children, at, target) };
      }),
    },
    flattened,
  );
};

export const moveNavigationItem = ({
  flattened,
  id,
  parentId,
}: {
  flattened: readonly FlattenedNavigationItem[];
  id: number;
  parentId: null | number;
}): FlattenedNavigationItem[] => {
  const { items } = navigationOrderBody(flattened);
  const ownGroup = items.find(group => group.id === id);
  const oldParent = items.find(group => group.children.includes(id));
  const isRoot = ownGroup !== undefined;

  if (parentId === null ? isRoot : parentId === id) return [...flattened];
  if (parentId !== null) {
    const canNest =
      (ownGroup?.children.length ?? 0) === 0 &&
      items.some(group => group.id === parentId);
    if (!canNest || oldParent?.id === parentId) return [...flattened];
  }

  const rest = items
    .filter(group => group.id !== id)
    .map(group => ({
      ...group,
      children: group.children.filter(childId => childId !== id),
    }));

  if (parentId === null) {
    const insertAt = oldParent
      ? rest.findIndex(group => group.id === oldParent.id) + 1
      : rest.length;

    return regroupNavigation(
      {
        items: [
          ...rest.slice(0, insertAt),
          { children: [], id },
          ...rest.slice(insertAt),
        ],
      },
      flattened,
    );
  }

  return regroupNavigation(
    {
      items: rest.map(group =>
        group.id === parentId
          ? { ...group, children: [...group.children, id] }
          : group,
      ),
    },
    flattened,
  );
};

export const restoreCollapsedChildren = (
  flattened: readonly FlattenedNavigationItem[],
  hidden: ReadonlyMap<number, readonly FlattenedNavigationItem[]>,
): FlattenedNavigationItem[] =>
  flattened.flatMap(entry => {
    const children = entry.depth === 0 ? hidden.get(entry.item.id) : undefined;

    return children ? [entry, ...children] : [entry];
  });
