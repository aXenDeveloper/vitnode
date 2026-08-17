"use server";

import {
  type RoleOption,
  searchRoles,
} from "@/components/form/fields/search-roles.action.server";

export type Role = RoleOption;

export const searchRolesForUser = async (search: string): Promise<Role[]> =>
  await searchRoles(search);
