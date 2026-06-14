"use server";

import type { FilterOption } from "@/components/table/filters";

import { adminModule } from "@/api/modules/admin/admin.module";
import { RoleFormat } from "@/components/role-format";
import { fetcher } from "@/lib/fetcher";

export const searchRolesAdmin = async (
  search: string,
): Promise<FilterOption[]> => {
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

  return data.edges.map(role => ({
    value: String(role.id),
    label: <RoleFormat role={role} />,
    keywords: role.name.map(item => item.name),
  }));
};
