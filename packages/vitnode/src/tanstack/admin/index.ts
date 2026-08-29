/**
 * VitNode's AdminCP runtime for TanStack Start - `@vitnode/core/tanstack/admin`.
 *
 * Everything an application needs to guard, enter and render the AdminCP, minus
 * the three things a package cannot own: its route tree, its server functions,
 * and where a visitor goes next.
 *
 *     ./state           the admin session as route state: the access union, the
 *                       one query key, the status policy, the permission
 *                       predicate, and the removal that isolates two admins
 *     ./session-api     the session's shape, read off the server-side read
 *     ./session-query   the canonical ["vitnode","admin-session"] entry - one
 *                       definition, read by the guard, the shell and every gate
 *     ./transport       the one server function the host registers
 *     ./permissions     the UI bridge: the existing AdminCP permission context,
 *                       fed from that query and from nowhere else
 *     ./identity        which administrator a cached read belongs to
 *     ./return-to       is this target somewhere inside the AdminCP at all
 *     ./intl            which strings the shell loads, and the locale note
 *     ./actions         the admin sign-in, over the shared auth transport
 *     ./sign-in-route   the `/admin` screen: loader, namespaces, component
 *     ./shell           the panel `_admin` renders: providers, sidebar, header
 *     ./nav             one navigation, read by the sidebar and the palette
 *     ./breadcrumb      the trail, from each match's `staticData`
 *     ./search          the command palette
 *     ./user-bar        the user menu, and the sign-out that clears the cache
 *     ./queries         every privileged AdminCP cache entry, and the one call
 *                       an identity boundary makes to drop all of it
 *     ./not-found       the AdminCP's 404
 *     ./screen          `requireAdminPermission`, and what a screen loader reads
 *     ./table-search    the search contract every AdminCP list route validates
 *
 * `@vitnode/core/tanstack/admin/server` is the other half: the request-scoped
 * call to the Hono admin API. It is a separate subpath because this barrel is
 * imported by browser bundles and that one may never be.
 *
 * ## The security boundary is not here
 *
 * `_admin`'s guard is navigation and UX. Authorization stays where it already
 * is: `api/config.ts` puts `globalAdminMiddleware()` in front of every request
 * whose path contains `/admin/`, each handler re-checks the staff tables, and
 * `SessionAdminModel.getUser()` re-runs `checkIfUserIsAdmin` on every request -
 * deleting the session the moment the answer turns false. Nothing in this
 * namespace may be relied on to keep anybody out of anything, and no admin
 * endpoint asks the client who it is.
 *
 * ## What stays in the application
 *
 * - **`createServerFn`.** A host externalises this package from Vite's SSR pass,
 *   so package code reaches the server uncompiled - and an uncompiled server
 *   function silently resolves to `undefined` during SSR. The host declares one
 *   one-line wrapper over `./server` and registers it; see `./transport`.
 * - **The route tree.** `/admin` is a leaf and `_admin` is a pathless shell, and
 *   which is which is route composition. This package hands the routes their
 *   decisions (`ensureAdminAccess`, `canEnterAdmin`, `sanitizeAdminReturnTo`)
 *   and never a `createFileRoute`.
 * - **Navigation.** Every action and the shell itself take a `navigate` and a
 *   `LinkComponent`, because during the migration part of `/admin/*` is still
 *   served by the Next.js application - `/admin/content/*` after Stage 12.
 */

export * from "./actions";
/**
 * The shell, and the navigation model it is built on.
 *
 * `AdminShellContent` is what a host's `_admin` route renders; everything else
 * here exists because a route or a host needs to reach one part of it directly -
 * a route declares a breadcrumb, a host with plugins registered in the browser
 * passes navigation declarations, a screen reads the navigation it is inside.
 *
 * The navigation model itself is *not* re-exported from here as an
 * implementation: it lives in `views/admin/layouts/sidebar/nav/nav-model`,
 * framework-free, because the Next.js AdminCP reads it too. What crosses this
 * barrel is the model's public vocabulary, so a TanStack host has one specifier
 * to import rather than a deep path into `views/`.
 */
export { AdminBreadcrumb, useAdminBreadcrumb } from "./breadcrumb";
export * from "./intl";
export { AdminNavProvider, useAdminNav, useAdminSearchNavItems } from "./nav";
export { AdminNotFound } from "./not-found";
export * from "./permissions";
export { removeAdminIdentityQueries, removeAdminShellQueries } from "./queries";
export * from "./return-to";
export type { AdminScreenContext } from "./screen";
export { requireAdminPermission } from "./screen";

// ------------------------------------------------------------------ shell ---
// The panel itself: the frame, the navigation, the breadcrumb, the palette, the
// user menu and the sign-in screen - plus the table search contract every
// AdminCP list route validates through.
// -----------------------------------------------------------------------------

export { AdminSearch } from "./search";
export type {
  AdminAccessState,
  AdminSessionApi,
  AdminSessionReadResult,
  AdminUser,
} from "./session-api";
export * from "./session-query";
export { AdminShellContent } from "./shell";
export type {
  AdminSignInRouteData,
  AdminSignInRouteProps,
} from "./sign-in-route";
export {
  ADMIN_SIGN_IN_NAMESPACES,
  AdminSignInRouteContent,
  loadAdminSignInRoute,
} from "./sign-in-route";

export * from "./state";
export type {
  AdminTableContract,
  AdminTableNavigate,
  AdminTableOrder,
  AdminTableParams,
  AdminTableRouteSearch,
  UncheckedAdminTableSearch,
} from "./table-search";

export {
  adminTableRouteParams,
  adminTableSearchFrom,
  adminTableSearchParams,
  normalizeAdminTableSearch,
} from "./table-search";
export * from "./transport";
export { AdminUserBar } from "./user-bar";

// ---------------------------------------------------------------- screens ---
// What every AdminCP screen shares - and, by its absence, where each screen
// lives.
//
// The screens themselves are *not* re-exported here, deliberately. Each is its
// own subpath - `@vitnode/core/tanstack/admin/cron`, `.../queue`, `.../files`,
// `.../integrations`, `.../search-index`, `.../debug`, `.../dashboard`,
// `.../users`, `.../roles`, `.../staff` - so a route bundles the screen it
// renders and not the other nine. This barrel is what the *shell* imports, and
// it is loaded on every admin page.
// -----------------------------------------------------------------------------

export {
  AdminRequestError,
  isAdminRequestError,
} from "@/views/admin/admin-request";
export type { AdminSearchNavItem } from "@/views/admin/layouts/search/flatten-nav";
export { flattenAdminNav } from "@/views/admin/layouts/search/flatten-nav";
export type {
  AdminSearchUser,
  AdminUserSearch,
} from "@/views/admin/layouts/search/search-users";
export type {
  AdminNavBundle,
  AdminNavConfig,
  AdminNavGroupDeclaration,
  AdminNavItem,
  AdminNavItemDeclaration,
  AdminNavSubItem,
  AdminNavSubItemDeclaration,
  AdminNavTitle,
  AdminNavTranslator,
  NavAdminParent,
} from "@/views/admin/layouts/sidebar/nav/nav-model";

export {
  adminNavBundle,
  adminNavDeclarations,
  adminNavNamespaces,
  buildAdminNav,
  resolveAdminNav,
} from "@/views/admin/layouts/sidebar/nav/nav-model";
export {
  ADMIN_TABLE_MAX_PAGE_SIZE,
  normalizeAdminTableParams,
} from "@/views/admin/table/params";
export type { RawAdminTableParams } from "@/views/admin/table/params";
export { ADMIN_QUERY_ROOT, adminQueryRoot } from "@/views/admin/table/query";
