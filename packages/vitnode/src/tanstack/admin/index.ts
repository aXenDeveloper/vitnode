export * from "./actions";

export {
  AdminBreadcrumb,
  adminBreadcrumb,
  useAdminBreadcrumb,
} from "./breadcrumb";
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
export type { AdminSignInRouteData } from "./sign-in-route";
export {
  ADMIN_SIGN_IN_NAMESPACES,
  loadAdminSignInRoute,
} from "./sign-in-route";
export type { AdminSignInRouteProps } from "./sign-in-screen";
export { AdminSignInRouteContent } from "./sign-in-screen";

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
