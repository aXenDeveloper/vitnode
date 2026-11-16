import type { Context } from "hono";

import { inArray } from "drizzle-orm";

import type { OwnContentPolicy } from "@/lib/own-content";

import { core_roles } from "@/database/roles";
import { effectiveOwnContentPolicy } from "@/lib/own-content";

import { getUserRoleIds } from "./check-staff-permission";

const resolved = new WeakMap<Context, Promise<OwnContentPolicy>>();

const readPolicy = async (
  c: Context,
  user: { id: number; roleId: number },
): Promise<OwnContentPolicy> => {
  const roleIds = await getUserRoleIds(c, user);
  const roles = await c
    .get("db")
    .select({
      allowDeleteOwnContent: core_roles.allowDeleteOwnContent,
      allowEditOwnContent: core_roles.allowEditOwnContent,
      allowHideOwnContent: core_roles.allowHideOwnContent,
      editOwnContentMinutes: core_roles.editOwnContentMinutes,
    })
    .from(core_roles)
    .where(inArray(core_roles.id, roleIds));

  return effectiveOwnContentPolicy(roles);
};

/**
 * What the member may do with content they wrote - edit (and for how long),
 * delete, hide - from their primary and secondary roles' settings. Read once
 * per request. Server-only.
 */
export const resolveOwnContentPolicy = async (
  c: Context,
  user: { id: number; roleId: number },
): Promise<OwnContentPolicy> => {
  const cached = resolved.get(c);
  if (cached) return await cached;

  const policy = readPolicy(c, user);
  resolved.set(c, policy);

  return await policy;
};
