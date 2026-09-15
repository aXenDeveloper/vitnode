import { z } from "zod";

import type { AdminSearchUser } from "@/views/admin/layouts/search/search-users";

import { CONFIG_PLUGIN } from "@/config";
import { fetcher } from "@/tanstack/fetcher";
import { MAX_SEARCH_RESULTS } from "@/views/admin/layouts/search/constants";

export const adminUserSearchInputSchema = z.string().trim().min(1).max(128);

export const readAdminUserSearch = async (
  search: string,
): Promise<AdminSearchUser[]> => {
  const parsed = adminUserSearchInputSchema.safeParse(search);

  if (!parsed.success) return [];

  try {
    const response = await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      args: {
        query: { first: String(MAX_SEARCH_RESULTS), search: parsed.data },
      },
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
