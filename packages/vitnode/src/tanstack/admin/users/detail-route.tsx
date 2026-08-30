import { notFound } from "@tanstack/react-router";
import { createTranslator } from "use-intl";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { ADMIN_USER_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";
import { normalizeAdminUserId } from "@/views/admin/views/core/users/detail/user-query";

import type { AdminScreenContext } from "../screen";

import { intlQueryOptions } from "../../i18n/query";
import { adminIdentityOf } from "../identity";
import { requireAdminPermission } from "../screen";
import { adminUserQuery } from "./query";

/**
 * `/admin/core/users/$id` - one user, as everything a TanStack Start route needs
 * and nothing a route owns.
 *
 * ## The dynamic segment, and what the route must do with it before this runs
 *
 * `$id` matches *any* segment. `normalizeAdminUserId` is what turns it into
 * either a decimal id or `null`, and a route calls it in `params.parse` so the
 * decision is made once, before the loader, the query key or the request exist.
 * The public URL is unchanged - `/admin/core/users/123` - and nothing here ever
 * sees `Number("abc")`.
 *
 * ## The permission model is the Next.js page's, unchanged
 *
 *     users.can_view        the page itself
 *     users.can_edit        the in-place editors and the roles dialog
 *     users.can_edit_admin  additionally, when the target is an administrator
 *
 * The last two are `canEditAdminUser`, which is the same predicate the Next.js
 * page builds from `getSessionAdminApi()`, and the same rule
 * `assertCanEditAdminTarget` enforces on every write.
 */

/**
 * What this screen renders strings from.
 *
 * `admin.user` is the page; `core.search` is the timeline tab and the feed
 * inside it; `core.global` is the dialogs, the forms and the error toasts. The
 * same set `<I18nProvider namespaces={["admin.user", "core.search"]}>` provides
 * in the Next.js page, which adds `core.global` itself.
 */
export const ADMIN_USER_NAMESPACES = [
  "admin.user",
  "core.global",
  "core.search",
] as const;

/** What {@link loadAdminUserRoute} returns, and therefore what `head` receives. */
export interface AdminUserRouteData {
  adminUserId: AdminIdentity;
  id: string;
  locale: string;
  title: string;
}

/**
 * Both reads this screen needs, before it renders.
 *
 * The user is fetched rather than prefetched because the `<title>` is built from
 * their name - the Next.js `generateMetadata` makes the same request for the
 * same reason, and both fall back to the bare heading when the read fails.
 *
 * A refusal propagates: `404` is a link to somebody who has been deleted and
 * `403` is an administrator who may no longer look, and both are the router's
 * error path rather than a page rendered around missing data.
 */
export const loadAdminUserRoute = async ({
  adminAccess,
  id: raw,
  locale,
  queryClient,
}: AdminScreenContext & {
  /** The `$id` segment, exactly as it was typed. Nothing has checked it yet. */
  id: string;
}): Promise<AdminUserRouteData> => {
  requireAdminPermission(adminAccess, ADMIN_USER_PERMISSIONS.view);

  /**
   * The one place `$id` becomes an id.
   *
   * Here rather than in the route's `params.parse`, and that is deliberate:
   * `parse` runs inside `matchRoutes`, which `isTanStackOwnedPath` calls to
   * decide whether *this* application serves a path at all - so a `parse` that
   * threw would take down the link component for every href it was asked about.
   *
   * `notFound()` rather than a `400`: `/admin/core/users/abc` is a URL that
   * names no user, which is what a not-found screen is for, and it is the same
   * answer the API gives (`show.route.ts` refuses a non-integer id with a
   * `404`). Nothing below this line has ever seen `Number("abc")`.
   */
  const id = normalizeAdminUserId(raw);
  if (id === null) {
    // TanStack Router's own control-flow signal.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw notFound();
  }

  const adminUserId = adminIdentityOf(adminAccess);

  const [intl, user] = await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: ADMIN_USER_NAMESPACES }),
    ),
    queryClient.ensureQueryData({
      ...adminUserQuery({ adminUserId, id }),
      revalidateIfStale: true,
    }),
  ]);

  const t = createTranslator({
    locale,
    messages: intl.messages as {
      admin: { user: { show: { title: string } } };
    },
    namespace: "admin.user.show",
  });

  return {
    adminUserId,
    id,
    locale,
    title: `${user.name} - ${t("title")}`,
  };
};
