"use server";

import type { RoleOption } from "@/components/form/fields/roles";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

/**
 * Re-exported so an existing importer keeps working. The type itself lives in
 * `./roles`, which imports nothing - a shared component must not have to reach
 * into a `"use server"` module to describe its own props. See that file.
 */
export type { RoleOption };

/**
 * The role search a **Next.js** application uses, injected by
 * `AutoFormRolesNext`.
 *
 * It is not a default any more, and nothing imports it implicitly: it reads
 * Next's request scope through `fetcher`, so it resolves only inside a Next.js
 * app. A TanStack host reads the same Hono endpoint from the browser instead -
 * `searchAdminRolesInBrowser`.
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
