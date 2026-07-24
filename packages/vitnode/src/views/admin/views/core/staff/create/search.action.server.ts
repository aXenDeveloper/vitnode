"use server";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

export interface StaffUserOption {
  avatarColor: string;
  id: number;
  name: string;
  nameCode: string;
}

export const searchUsersForStaff = async (
  search: string,
): Promise<StaffUserOption[]> => {
  const res = await fetcher(adminModule, {
    path: "/list",
    method: "get",
    module: "admin/users",
    args: {
      query: { search, first: "20" },
    },
    withPagination: true,
  });

  if (res.status !== 200) {
    return [];
  }

  const data = await res.json();

  return data.edges.map(user => ({
    id: user.id,
    name: user.name,
    nameCode: user.nameCode,
    avatarColor: user.avatarColor,
  }));
};
