import type { Context } from "hono";

import { and, count, desc, eq, isNull } from "drizzle-orm";

import type { NavigationLocation } from "@/lib/navigation";

import { core_navigation } from "@/database/navigation";

import { navigationLocationOf } from "./location";

export type NavigationDatabase = Omit<Context["var"]["db"], "$client">;

export const nextNavigationPosition = async (
  db: NavigationDatabase,
  parentId: null | number,
  location: NavigationLocation,
): Promise<number> => {
  const [last] = await db
    .select({ position: core_navigation.position })
    .from(core_navigation)
    .where(
      parentId === null
        ? and(
            isNull(core_navigation.parentId),
            eq(core_navigation.location, location),
          )
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
): Promise<
  | { location: NavigationLocation; problem: null }
  | { location?: never; problem: NavigationParentProblem }
> => {
  const [parent] = await c
    .get("db")
    .select({
      id: core_navigation.id,
      location: core_navigation.location,
      parentId: core_navigation.parentId,
    })
    .from(core_navigation)
    .where(eq(core_navigation.id, parentId))
    .limit(1);

  if (!parent) return { problem: "missing" };
  if (parent.parentId !== null) return { problem: "depth" };

  return { location: navigationLocationOf(parent.location), problem: null };
};

export const countNavigationRoots = async (
  db: NavigationDatabase,
  location: NavigationLocation,
): Promise<number> => {
  const [row] = await db
    .select({ total: count() })
    .from(core_navigation)
    .where(
      and(
        isNull(core_navigation.parentId),
        eq(core_navigation.location, location),
      ),
    );

  return row?.total ?? 0;
};
