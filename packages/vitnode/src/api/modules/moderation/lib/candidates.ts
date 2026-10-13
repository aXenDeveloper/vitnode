import type { Context } from "hono";

import { eq, inArray, or } from "drizzle-orm";

import { core_moderators_permissions } from "@/database/moderators";
import { core_roles } from "@/database/roles";
import { core_users, core_users_secondary_roles } from "@/database/users";

const LIMIT = 100;

export const listModeratorCandidates = async (c: Context) => {
  const db = c.get("db");
  const [entries, rootRoles] = await Promise.all([
    db
      .select({
        roleId: core_moderators_permissions.roleId,
        userId: core_moderators_permissions.userId,
      })
      .from(core_moderators_permissions),
    db
      .select({ id: core_roles.id })
      .from(core_roles)
      .where(eq(core_roles.root, true)),
  ]);

  const roleIds = [
    ...new Set([
      ...entries.map(entry => entry.roleId),
      ...rootRoles.map(role => role.id),
    ]),
  ].filter((id): id is number => id !== null);
  const userIds = entries
    .map(entry => entry.userId)
    .filter((id): id is number => id !== null);

  const secondary = roleIds.length
    ? await db
        .select({ userId: core_users_secondary_roles.userId })
        .from(core_users_secondary_roles)
        .where(inArray(core_users_secondary_roles.roleId, roleIds))
    : [];
  const ids = [...new Set([...userIds, ...secondary.map(row => row.userId)])];

  const conditions = [
    ...(ids.length ? [inArray(core_users.id, ids)] : []),
    ...(roleIds.length ? [inArray(core_users.roleId, roleIds)] : []),
  ];
  if (conditions.length === 0) return [];

  return await db
    .select({
      id: core_users.id,
      name: core_users.name,
      nameCode: core_users.nameCode,
      roleId: core_users.roleId,
    })
    .from(core_users)
    .where(or(...conditions))
    .limit(LIMIT);
};
