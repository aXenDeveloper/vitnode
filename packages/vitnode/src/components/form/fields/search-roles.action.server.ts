"use server";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

/**
 * One role, as a picker needs it.
 *
 * `name` is the raw per-language list rather than a resolved string: the server
 * has no business deciding which language the person clicking reads in, so the
 * component resolves it against the active locale.
 */
export interface RoleOption {
  color: null | string;
  id: number;
  name: { languageCode: string; name: string }[];
}

/**
 * The default search behind {@link AutoFormRoles}.
 *
 * The guest role is filtered out, and that is not cosmetic: it is the role a
 * request has when it has no account, so it is never something to *assign* to
 * anybody. Every consumer of this list wanted it gone, so it is gone here rather
 * than in each of them.
 */
export const searchRoles = async (search: string): Promise<RoleOption[]> => {
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
