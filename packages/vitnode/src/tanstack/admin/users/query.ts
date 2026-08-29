import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import React from "react";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { UpdateAdminUser } from "@/views/admin/views/core/users/detail/user-fields-content";
import type {
  AdminUserDetail,
  AdminUserFetcher,
} from "@/views/admin/views/core/users/detail/user-query";
import type { UpdateAdminUserRoles } from "@/views/admin/views/core/users/detail/user-roles-content";
import type {
  AdminUsersPageFetcher,
  AdminUsersParams,
} from "@/views/admin/views/core/users/list/users-query";
import type { VerifyAdminUserEmail } from "@/views/admin/views/core/users/list/users-table-content";

import {
  adminUserQueryOptions,
  fetchAdminUserInBrowser,
} from "@/views/admin/views/core/users/detail/user-query";
import {
  adminUsersQueryOptions,
  adminUsersQueryRoot,
  fetchAdminUsersPageInBrowser,
} from "@/views/admin/views/core/users/list/users-query";
import {
  updateAdminUser,
  updateAdminUserRoles,
  verifyAdminUserEmail,
} from "@/views/admin/views/core/users/users-mutations";

import { useAdminIdentity } from "../identity";
import { fetchAdminUserOnServer, fetchAdminUsersPageOnServer } from "./server";

/**
 * The AdminCP users screens for a TanStack Start host: two query definitions and
 * three mutations.
 *
 * Everything about *what* the reads are lives in
 * `@/views/admin/views/core/users`, which is also what the mounted components
 * render from. This module supplies the two things those modules cannot know:
 * how to reach the API from a server that is rendering a request, and what
 * "refresh the screen" means in a router with a query cache instead of
 * `revalidatePath`.
 */

/**
 * The transport boundary.
 *
 * Both branches call Hono directly - the server one from inside the request
 * being rendered, the browser one over the network to the same origin. There is
 * deliberately no `createServerFn` in between: a server function is a `POST`
 * back to the app that then calls Hono, so every sort and page of the table
 * would cost two round trips for a read the API is already the boundary for, and
 * nothing here needs a `Set-Cookie` copied onto the app's own response.
 *
 * Written out at module scope rather than behind a helper, because the Start
 * compiler matches the *chained call*: a `.server(fn)` passed as an ordinary
 * argument elsewhere would leave `./server` in the client graph.
 */
const fetchUsersPage: AdminUsersPageFetcher = createIsomorphicFn()
  .server(fetchAdminUsersPageOnServer)
  .client(fetchAdminUsersPageInBrowser);

const fetchUser: AdminUserFetcher = createIsomorphicFn()
  .server(fetchAdminUserOnServer)
  .client(fetchAdminUserInBrowser);

/**
 * The users list, as the one query definition every caller shares.
 *
 * `params` must be the *normalised* ones - `usersRouteParams` over the route's
 * validated search - because the cache key is built from them.
 *
 * `adminUserId` is the reading administrator's, and it is in the key rather than
 * in the request: see `tanstack/admin/identity.ts`.
 */
export const adminUsersQuery = ({
  adminUserId,
  params,
}: {
  adminUserId: AdminIdentity;
  params: AdminUsersParams;
}) =>
  adminUsersQueryOptions({
    adminUserId,
    fetchPage: fetchUsersPage,
    params,
  });

/** One user, for the detail screen and for its breadcrumb. */
export const adminUserQuery = ({
  adminUserId,
  id,
}: {
  adminUserId: AdminIdentity;
  id: string;
}) => adminUserQueryOptions({ adminUserId, fetchUser, id });

/**
 * Marks everything the AdminCP has cached about users stale, for one
 * administrator.
 *
 * The whole family by prefix - every page, sort and filter of the list, and
 * every single-user entry - because a rename shows up in a row on any page and
 * on the detail screen at once. It is emphatically not
 * `queryClient.invalidateQueries()` with no key: the session, the messages and
 * every other list the panel holds have not changed.
 *
 * Invalidating rather than removing keeps the current rows on screen while the
 * fresh ones arrive, instead of blanking the table under the button that was
 * just pressed.
 */
export const invalidateAdminUsers = async (
  queryClient: QueryClient,
  adminUserId: AdminIdentity,
): Promise<void> => {
  await queryClient.invalidateQueries({
    queryKey: adminUsersQueryRoot(adminUserId),
  });
};

/**
 * The three user writes, bound to the mounted router's cache.
 *
 * Each refreshes only on success, for the same reason the Next.js actions only
 * call `revalidatePath` on success: a refused write changed nothing, and
 * refetching would replace the rows underneath the error toast for no change at
 * all.
 *
 * Memoised, which is the only reason these are hooks rather than calls at the
 * point of use: they are props on components that re-render on every navigation,
 * and a new function identity would reset the pending state inside a row's
 * button mid-request.
 */
export const useAdminUserMutations = (): {
  onUpdate: UpdateAdminUser;
  onUpdateRoles: UpdateAdminUserRoles;
  onVerifyEmail: VerifyAdminUserEmail;
} => {
  const queryClient = useQueryClient();
  const adminUserId = useAdminIdentity();

  return React.useMemo(
    () => ({
      onUpdate: async (id, input) => {
        const result = await updateAdminUser(id, input);
        if ("data" in result) {
          await invalidateAdminUsers(queryClient, adminUserId);
        }

        return result;
      },
      onUpdateRoles: async (id, input) => {
        const result = await updateAdminUserRoles(id, input);
        if ("data" in result) {
          await invalidateAdminUsers(queryClient, adminUserId);
        }

        return result;
      },
      onVerifyEmail: async (id: number) => {
        const result = await verifyAdminUserEmail(id);
        if ("error" in result) return { error: result.error };
        await invalidateAdminUsers(queryClient, adminUserId);

        return { name: result.data.name };
      },
    }),
    [adminUserId, queryClient],
  );
};

export type { AdminUserDetail };
