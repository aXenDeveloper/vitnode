import "@tanstack/react-start/server-only";

import type { AdminSearchUser } from "@/views/admin/layouts/search/search-users";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/tanstack/fetcher/server";
import { MAX_SEARCH_RESULTS } from "@/views/admin/layouts/search/constants";

export const readAdminUserSearchOnApi = async (
  search: string,
): Promise<AdminSearchUser[]> => {
  try {
    const response = await fetcher(adminModule, {
      args: { query: { first: String(MAX_SEARCH_RESULTS), search } },
      method: "get",
      module: "admin/users",
      path: "/list",
      withPagination: true,
    });

    if (response.status !== 200) return [];

    const data = await response.json();

    return data.edges.map(user => ({
      avatarColor: user.avatarColor,
      email: user.email,
      id: user.id,
      name: user.name,
      nameCode: user.nameCode,
    }));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[admin] the user search could not be read", error);

    return [];
  }
};
