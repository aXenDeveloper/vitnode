import type { Context } from "hono";

import { eq, inArray } from "drizzle-orm";

import { resolveRoleNames } from "@/api/lib/resolve-role-names";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";

interface RawStaffEdge {
  createdAt: Date;
  id: number;
  roleId: null | number;
  updatedAt: Date;
  userId: null | number;
}

export const resolveStaffEdges = async (c: Context, edges: RawStaffEdge[]) => {
  const entryRoleIds = edges
    .map(edge => edge.roleId)
    .filter((id): id is number => id != null);
  const userIds = edges
    .map(edge => edge.userId)
    .filter((id): id is number => id != null);

  const entryRoles = entryRoleIds.length
    ? await c
        .get("db")
        .select({ id: core_roles.id, color: core_roles.color })
        .from(core_roles)
        .where(inArray(core_roles.id, entryRoleIds))
    : [];

  const users = userIds.length
    ? await c
        .get("db")
        .select({
          id: core_users.id,
          name: core_users.name,
          nameCode: core_users.nameCode,
          avatarColor: core_users.avatarColor,
          roleId: core_users.roleId,
          roleColor: core_roles.color,
        })
        .from(core_users)
        .leftJoin(core_roles, eq(core_roles.id, core_users.roleId))
        .where(inArray(core_users.id, userIds))
    : [];

  const roleNames = await resolveRoleNames(c, [
    ...entryRoleIds,
    ...users.map(user => user.roleId),
  ]);

  return edges.map(edge => {
    const entryRole = entryRoles.find(role => role.id === edge.roleId);
    const user = users.find(item => item.id === edge.userId);

    return {
      id: edge.id,
      createdAt: edge.createdAt,
      updatedAt: edge.updatedAt,
      role: entryRole
        ? {
            id: entryRole.id,
            color: entryRole.color,
            name: roleNames.get(entryRole.id) ?? [],
          }
        : null,
      user: user
        ? {
            id: user.id,
            name: user.name,
            nameCode: user.nameCode,
            avatarColor: user.avatarColor,
            role: {
              id: user.roleId,
              color: user.roleColor,
              name: roleNames.get(user.roleId) ?? [],
            },
          }
        : null,
    };
  });
};
