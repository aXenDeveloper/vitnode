"use server";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

import { MAX_SEARCH_RESULTS } from "./constants";

export interface AdminSearchUser {
  avatarColor: string;
  email: string;
  id: number;
  name: string;
  nameCode: string;
}

export const searchUsersForAdminPalette = async (
  search: string,
): Promise<AdminSearchUser[]> => {
  const res = await fetcher(adminModule, {
    path: "/list",
    method: "get",
    module: "admin/users",
    args: {
      query: { search, first: String(MAX_SEARCH_RESULTS) },
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
    email: user.email,
    avatarColor: user.avatarColor,
  }));
};
