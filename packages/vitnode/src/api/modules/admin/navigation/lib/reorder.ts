export interface NavigationOrderInput {
  children: readonly number[];
  id: number;
}

export interface NavigationPlacement {
  id: number;
  parentId: null | number;
  position: number;
}

export type ReorderNavigationOutcome =
  | { ok: false; reason: "duplicate" | "incomplete" | "unknown" }
  | { ok: true; placements: NavigationPlacement[] };

export const reorderNavigationTree = (
  requested: readonly NavigationOrderInput[],
  existing: readonly number[],
): ReorderNavigationOutcome => {
  const known = new Set(existing);
  const seen = new Set<number>();
  const placements: NavigationPlacement[] = [];

  const place = (
    placement: NavigationPlacement,
  ): "duplicate" | "unknown" | null => {
    if (seen.has(placement.id)) return "duplicate";
    if (!known.has(placement.id)) return "unknown";
    seen.add(placement.id);
    placements.push(placement);

    return null;
  };

  for (const [position, root] of requested.entries()) {
    const rootProblem = place({ id: root.id, parentId: null, position });
    if (rootProblem) return { ok: false, reason: rootProblem };

    for (const [childPosition, childId] of root.children.entries()) {
      const childProblem = place({
        id: childId,
        parentId: root.id,
        position: childPosition,
      });
      if (childProblem) return { ok: false, reason: childProblem };
    }
  }

  if (seen.size !== known.size) return { ok: false, reason: "incomplete" };

  return { ok: true, placements };
};
