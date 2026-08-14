"use server";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

/** The columns a user picker needs: enough to identify a person on sight. */
export interface UserOption {
  avatarColor: string;
  id: number;
  name: string;
  nameCode: string;
}

/**
 * The default search behind {@link AutoFormUser}.
 *
 * Reads the AdminCP users list, so it answers with whatever that route lets the
 * calling admin see - the permission check lives there and is not repeated here.
 * A non-200 is an empty list rather than a throw: a picker that cannot reach the
 * server should offer nothing, not take the form down with it.
 */
export const searchUsers = async (search: string): Promise<UserOption[]> => {
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
