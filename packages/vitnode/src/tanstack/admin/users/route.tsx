"use client";

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import React from "react";
import { createTranslator } from "use-intl";

import type { DataTableNavigation } from "@/components/table/navigation";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { AdminUsersParams } from "@/views/admin/views/core/users/list/users-query";
import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { AdminStaffPermissionGate } from "@/components/staff-permission/provider";
import { DataTableNavigationProvider } from "@/components/table/navigation";
import { HeaderContent } from "@/components/ui/header-content";
import { ADMIN_USER_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";
import { CreateUserAdminContent } from "@/views/admin/views/core/users/list/create-user-content";
import { UsersAdminTableContent } from "@/views/admin/views/core/users/list/users-table-content";
import { searchAdminRolesInBrowser } from "@/views/admin/views/core/users/roles/roles-query";
import { createAdminUser } from "@/views/admin/views/core/users/users-mutations";

import type { AdminScreenContext } from "../screen";
import type { AdminTableNavigate } from "../table-search";
import type { UncheckedUsersSearch, UsersRouteSearch } from "./route-search";

import { intlQueryOptions } from "../../i18n/query";
import { RouteMessages } from "../../i18n/route-messages";
import { adminIdentityOf, useAdminIdentity } from "../identity";
import { requireAdminPermission } from "../screen";
import {
  adminUsersQuery,
  invalidateAdminUsers,
  useAdminUserMutations,
} from "./query";
import { usersSearchFrom, usersSearchParams } from "./route-search";

/**
 * `/admin/core/users` - the AdminCP users list, as everything a TanStack Start
 * route needs and nothing a route owns.
 *
 * The topology stays in the host, because TanStack infers it from
 * `createFileRoute`: the path, the search contract and `navigate`. Everything
 * else is here - the namespaces, the permissions, the query, the title, the
 * table, the create dialog and the role filter's lookup.
 *
 * ## The permission model is the Next.js page's, unchanged
 *
 *     users.can_view    the list itself      - the route, and the API route
 *     users.can_create  the create button    - a gate, and the create route
 *     users.can_edit    the row actions      - a gate inside the table
 *
 * `can_view` is checked in the loader rather than around the table, so an
 * administrator without it never sends a request the API is going to refuse and
 * no admin markup is streamed for a screen about to be replaced by the AdminCP's
 * 404. The Next.js page could not do that - `AdminPermissionRequired` wraps the
 * table, so its heading renders first.
 */

/**
 * What this screen renders strings from.
 *
 * `admin.user` is the heading, the columns, the create dialog and the row
 * actions; `admin.global` carries `nav.users.list`, which is the `<h1>` and the
 * `<title>`; `core.global` is the rest of the table - the pager, the search box,
 * the filter dropdown and the error toasts - and it is listed even though the
 * root provides it, because `RouteMessages` mounts its own provider *over* the
 * root's rather than adding to it.
 *
 * The same set `<I18nProvider namespaces="admin.user">` provides in the Next.js
 * page, which always adds `core.global` itself and reads `admin.global` from the
 * AdminCP layout.
 */
export const ADMIN_USERS_NAMESPACES = [
  "admin.global",
  "admin.user",
  "core.global",
] as const;

/** What {@link loadAdminUsersRoute} returns, and therefore what `head` receives. */
export interface AdminUsersRouteData {
  adminUserId: AdminIdentity;
  description: string;
  params: AdminUsersParams;
  title: string;
}

/**
 * Both reads this screen needs, in parallel, before it renders.
 *
 * The permission is checked first, before either read is started. Neither call
 * is repeated by the component: the messages are read back by `RouteMessages`
 * through the identical `intlQueryOptions`, and the page by `useSuspenseQuery`
 * through the identical `adminUsersQuery`.
 *
 * A refusal from the users API is deliberately left to propagate: `403` and
 * `429` reject as `AdminRequestError` and fail this loader. Catching it and
 * rendering an empty table would be indistinguishable from a community with no
 * members, which is the one thing this must never look like.
 *
 * The cast on `messages` is what makes `createTranslator` usable: its key type
 * is derived from the *inferred* type of `messages`, and a bare index signature
 * collapses `MessageKeys` to `never`. Naming the two keys read here is both the
 * smallest fix and a true statement - rename either in `locales/en.json` and
 * this stops compiling rather than rendering a raw key into a `<title>`.
 */
export const loadAdminUsersRoute = async ({
  adminAccess,
  locale,
  params,
  queryClient,
}: AdminScreenContext & {
  params: AdminUsersParams;
}): Promise<AdminUsersRouteData> => {
  /**
   * `users.can_view` - the tuple `<AdminPermissionRequired module="users"
   * permission="can_view">` states in the Next.js page, and the one
   * `listUsersAdminRoute` declares as its `adminStaffPermission`. All three read
   * it from `ADMIN_USER_PERMISSIONS` rather than spelling it out.
   */
  requireAdminPermission(adminAccess, ADMIN_USER_PERMISSIONS.view);

  const adminUserId = adminIdentityOf(adminAccess);

  const [intl] = await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: ADMIN_USERS_NAMESPACES }),
    ),
    queryClient.ensureQueryData(adminUsersQuery({ adminUserId, params })),
  ]);

  const messages = intl.messages as {
    admin: {
      global: { nav: { users: { list: string } } };
      user: { list: { desc: string } };
    };
  };
  const t = createTranslator({
    locale,
    messages,
    namespace: "admin.user.list",
  });
  const tNav = createTranslator({
    locale,
    messages,
    namespace: "admin.global.nav.users",
  });

  return {
    adminUserId,
    description: t("desc"),
    params,
    title: tNav("list"),
  };
};

export interface AdminUsersRouteProps extends AdminUsersRouteData {
  LinkComponent: AuthLinkComponent;
  navigate: AdminTableNavigate<UsersRouteSearch>;
  search: UncheckedUsersSearch;
}

/**
 * `/admin/core/users`, as everything below a route file's `component`.
 *
 * `navigate`, `search` and `LinkComponent` come from the host: TanStack infers
 * the first two from the `createFileRoute` path, and the third is how *this*
 * application renders an internal link while half of `/admin/*` is still served
 * by Next.js.
 *
 * The heading is outside the table, exactly as in the Next.js page, and rendered
 * from the loader's own strings - so the `<h1>` and the `<title>` are the same
 * string by construction.
 */
export const AdminUsersRouteContent = ({
  adminUserId,
  description,
  LinkComponent,
  navigate,
  params,
  search,
  title,
}: AdminUsersRouteProps) => {
  const { data } = useSuspenseQuery(adminUsersQuery({ adminUserId, params }));
  const { onVerifyEmail } = useAdminUserMutations();
  const queryClient = useQueryClient();
  const identity = useAdminIdentity();

  const navigation = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: async nextSearch => {
        await navigate({
          resetScroll: false,
          search: usersSearchFrom(nextSearch),
        });
      },
      searchParams: usersSearchParams(search),
    }),
    [navigate, search],
  );

  const onCreate = React.useCallback<
    React.ComponentProps<typeof CreateUserAdminContent>["onCreate"]
  >(
    async input => {
      const result = await createAdminUser(input);
      if ("data" in result) await invalidateAdminUsers(queryClient, identity);

      return result;
    },
    [identity, queryClient],
  );

  return (
    <RouteMessages namespaces={ADMIN_USERS_NAMESPACES}>
      <div className="p-4">
        <HeaderContent desc={description} h1={title}>
          <AdminStaffPermissionGate {...ADMIN_USER_PERMISSIONS.create}>
            <CreateUserAdminContent onCreate={onCreate} />
          </AdminStaffPermissionGate>
        </HeaderContent>

        <DataTableNavigationProvider value={navigation}>
          <UsersAdminTableContent
            data={data}
            LinkComponent={LinkComponent}
            onVerifyEmail={onVerifyEmail}
            searchRoles={searchAdminRolesInBrowser}
          />
        </DataTableNavigationProvider>
      </div>
    </RouteMessages>
  );
};
