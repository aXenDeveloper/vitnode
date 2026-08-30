import { createTranslator } from "use-intl";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { AdminUsersParams } from "@/views/admin/views/core/users/list/users-query";

import { ADMIN_USER_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";

import type { AdminScreenContext } from "../screen";

import { intlQueryOptions } from "../../i18n/query";
import { adminIdentityOf } from "../identity";
import { requireAdminPermission } from "../screen";
import { adminUsersQuery } from "./query";

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
