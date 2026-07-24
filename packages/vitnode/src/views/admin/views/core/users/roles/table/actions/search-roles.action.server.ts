"use server";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

export interface RoleOption {
  color: null | string;
  id: number;
  name: { languageCode: string; name: string }[];
}

// Roles a member can be moved into when their current role is deleted. The
// guest role is never a valid primary role, so it is filtered out here.
export const searchRolesForMove = async (
  search: string,
): Promise<RoleOption[]> => {
  const res = await fetcher(adminModule, {
    path: "/list",
    method: "get",
    module: "admin/roles",
    args: {
      query: { search, first: "20" },
    },
    withPagination: true,
  });

  if (res.status !== 200) {
    return [];
  }

  const data = await res.json();

  return data.edges
    .filter(role => !role.guest)
    .map(role => ({
      id: role.id,
      color: role.color,
      name: role.name,
    }));
};
