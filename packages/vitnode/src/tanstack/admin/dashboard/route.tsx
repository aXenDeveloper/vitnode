import type { AdminScreenContext } from "../screen";

import { intlQueryOptions } from "../../i18n/query";
import { adminIdentityOf } from "../identity";
import { dashboardLayoutQuery } from "./query";

/**
 * `/admin/core` - the AdminCP dashboard, as everything a TanStack Start route
 * needs and nothing a route owns.
 */

/**
 * What this screen renders strings from.
 *
 * `admin.dashboard` is the heading, the widget panel, the edit controls and both
 * core widgets. `admin.global` is there for one key - `admin.global.nav.core`,
 * which is what a widget with no category of its own is filed under - and it has
 * to be listed even though the shell warms it, because `RouteMessages` mounts
 * its provider *over* the root's rather than adding to it. `core.global` is the
 * form chrome the settings dialog renders inside.
 *
 * A host that passes plugin widgets must add those plugins' namespaces: a
 * widget's title is `<pluginId>.admin.dashboard.widgets.<id>.title`, and an
 * unwarmed namespace is a missing title rather than a missing widget.
 */
export const ADMIN_DASHBOARD_NAMESPACES = [
  "admin.dashboard",
  "admin.global",
  "core.global",
] as const;

/**
 * What {@link loadAdminDashboardRoute} returns.
 *
 * No `adminUserId`, deliberately, even though the loader resolves one to warm
 * the right cache entry. The host spreads this straight into the screen's props,
 * so anything returned here is a prop - and the identity is not one: the screen
 * and its actions both read it from `useAdminIdentity`, which is the same
 * `["vitnode","admin-session"]` entry the loader derived it from. One source,
 * and no way for a prop to drift from the entry it was supposed to name.
 */
export interface AdminDashboardRouteData {
  /** The running VitNode version, or `undefined` outside a granted session. */
  vitnodeVersion?: string;
}

/**
 * Both reads the dashboard needs, in parallel, before it renders.
 *
 * **No permission check, and that is the current tuple rather than an
 * oversight.** The Next.js page wraps nothing in `<AdminPermissionRequired>`:
 * the board reads `dashboard.can_view` through the API and falls back to the
 * default layout when that read is refused, so every administrator who can enter
 * the AdminCP can see its landing screen. `_admin`'s guard is the whole of the
 * access rule here.
 *
 * **And no title.** The Next.js page exports no `generateMetadata`, so the tab
 * keeps the site's own name; returning one here would render "VitNode - VitNode".
 * A route that says nothing inherits, which is the parity-preserving answer.
 *
 * The version is read off the admin session the guard already resolved - the
 * same value the Next.js `DashboardVersion` fetches with `getSessionAdminApi()`,
 * without the second request or the `<Suspense>` that existed to hide it. It is
 * returned raw and formatted in the component, so the sentence around it is
 * translated by the provider that has this route's namespaces.
 */
export const loadAdminDashboardRoute = async ({
  adminAccess,
  locale,
  queryClient,
}: AdminScreenContext): Promise<AdminDashboardRouteData> => {
  const adminUserId = adminIdentityOf(adminAccess);

  await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: ADMIN_DASHBOARD_NAMESPACES }),
    ),
    queryClient.ensureQueryData({
      ...dashboardLayoutQuery(adminUserId),
      revalidateIfStale: true,
    }),
  ]);

  return {
    vitnodeVersion:
      adminAccess.status === "granted"
        ? adminAccess.session.vitnode_version
        : undefined,
  };
};

/** A plugin's widgets, as a browser-side registry carries them. */
