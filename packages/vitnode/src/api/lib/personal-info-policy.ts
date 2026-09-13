import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { inArray } from "drizzle-orm";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type { PersonalInformationFields } from "@/lib/user-personal-information";

import { core_roles } from "@/database/roles";
import { PERSONAL_INFORMATION_FIELDS } from "@/lib/user-personal-information";

import { getUserRoleIds } from "./check-staff-permission";

export interface PersonalInfoPolicy {
  canEdit: boolean;
  fields: PersonalInformationFields;
}

export const zodPersonalInfoPolicy = z.object({
  canEdit: z.boolean(),
  fields: z.object({
    firstName: z.boolean(),
    lastName: z.boolean(),
    phone: z.boolean(),
    headline: z.boolean(),
    showRealName: z.boolean(),
  }),
});

export interface RolePersonalInfoLimits {
  allowEditPersonalInfo: boolean;
}

export const effectivePersonalInfoPolicy = (
  roles: RolePersonalInfoLimits[],
  fields: PersonalInformationFields,
): PersonalInfoPolicy => ({
  canEdit:
    roles.length > 0 &&
    roles.every(role => role.allowEditPersonalInfo) &&
    PERSONAL_INFORMATION_FIELDS.some(field => fields[field]),
  fields,
});

export const resolvePersonalInfoPolicy = async (
  c: Context<EnvVitNode>,
  user: { id: number; roleId: number },
): Promise<PersonalInfoPolicy> => {
  const roleIds = await getUserRoleIds(c, user);
  const roles = await c
    .get("db")
    .select({ allowEditPersonalInfo: core_roles.allowEditPersonalInfo })
    .from(core_roles)
    .where(inArray(core_roles.id, roleIds));

  return effectivePersonalInfoPolicy(
    roles,
    c.get("core").personalInformationFields,
  );
};
