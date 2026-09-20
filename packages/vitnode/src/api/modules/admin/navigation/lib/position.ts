import type { Context } from "hono";

import { desc, eq, isNull } from "drizzle-orm";

import { core_navigation } from "@/database/navigation";

export const nextNavigationPosition = async (
  c: Context,
  parentId: null | number,
): Promise<number> => {
  const [last] = await c
    .get("db")
    .select({ position: core_navigation.position })
    .from(core_navigation)
    .where(
      parentId === null
        ? isNull(core_navigation.parentId)
        : eq(core_navigation.parentId, parentId),
    )
    .orderBy(desc(core_navigation.position))
    .limit(1);

  return (last?.position ?? -1) + 1;
};

export type NavigationParentProblem = "depth" | "missing";

export const checkNavigationParent = async (
  c: Context,
  parentId: number,
): Promise<NavigationParentProblem | null> => {
  const [parent] = await c
    .get("db")
    .select({ id: core_navigation.id, parentId: core_navigation.parentId })
    .from(core_navigation)
    .where(eq(core_navigation.id, parentId))
    .limit(1);

  if (!parent) return "missing";
  if (parent.parentId !== null) return "depth";

  return null;
};
