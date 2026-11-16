import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import type { EnvVitNode } from "@/middlewares/global.middleware";

import { core_roles } from "@/database/roles";
import { core_users_secondary_roles } from "@/database/users";

import { resolveRoleNames } from "./resolve-role-names";

export const userRoleSchema = z.object({
  id: z.number(),
  color: z.string().nullable(),
  prefix: z.string().nullable(),
  name: z.array(
    z.object({
      name: z.string(),
      languageCode: z.string(),
    }),
  ),
});

export type UserRolePayload = z.infer<typeof userRoleSchema>;

interface RoleRow {
  color: null | string;
  id: number;
  prefix: null | string;
}

export interface ResolvedUserRoles {
  role: UserRolePayload;
  secondaryRoles: UserRolePayload[];
}

export const resolveUserRoles = async (
  c: Context<EnvVitNode>,
  { id, roleId }: { id: number; roleId: number },
): Promise<ResolvedUserRoles> => {
  const db = c.get("db");

  const [secondaryRoleRows, [primaryRole]] = await Promise.all([
    db
      .select({
        id: core_roles.id,
        color: core_roles.color,
        prefix: core_roles.prefix,
      })
      .from(core_users_secondary_roles)
      .innerJoin(
        core_roles,
        eq(core_roles.id, core_users_secondary_roles.roleId),
      )
      .where(eq(core_users_secondary_roles.userId, id)),
    db
      .select({
        id: core_roles.id,
        color: core_roles.color,
        prefix: core_roles.prefix,
      })
      .from(core_roles)
      .where(eq(core_roles.id, roleId))
      .limit(1),
  ]);

  const names = await resolveRoleNames(c, [
    roleId,
    ...secondaryRoleRows.map(role => role.id),
  ]);

  const withName = (role: RoleRow): UserRolePayload => ({
    id: role.id,
    color: role.color,
    prefix: role.prefix,
    name: names.get(role.id) ?? [],
  });

  return {
    role: withName({
      id: roleId,
      color: primaryRole?.color ?? null,
      prefix: primaryRole?.prefix ?? null,
    }),
    secondaryRoles: secondaryRoleRows.map(withName),
  };
};
