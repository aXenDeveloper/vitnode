export type { AdminTableNavigate } from "../table-search";
/**
 * `/admin/core/users` and `/admin/core/users/$id` - the AdminCP users screens,
 * for a TanStack Start host.
 *
 *     ./query         the cache contract - two query definitions, one
 *                     invalidation family, and the three writes that use it
 *     ./route         the list: namespaces, permission, loader, component
 *     ./detail-route  one user: the same, plus the breadcrumb that names them
 *     ./route-search  the URL contract, including the role filter
 *     ./server        the SSR transport, reached only through `./query`'s
 *                     isomorphic functions and never imported from a browser
 *                     bundle
 *
 * The rendering is not here and does not belong here: `UsersAdminTableContent`
 * and `UserDetailContent` are framework-free and are imported from
 * `@/views/admin/views/core/users` by both applications.
 */
export type { AdminUserRouteData, AdminUserRouteProps } from "./detail-route";
export {
  ADMIN_USER_NAMESPACES,
  AdminUserBreadcrumbContent,
  AdminUserRouteContent,
  loadAdminUserRoute,
} from "./detail-route";
export {
  adminUserQuery,
  adminUsersQuery,
  invalidateAdminUsers,
  useAdminUserMutations,
} from "./query";
export type { AdminUsersRouteData, AdminUsersRouteProps } from "./route";
export {
  ADMIN_USERS_NAMESPACES,
  AdminUsersRouteContent,
  loadAdminUsersRoute,
} from "./route";
export type { UncheckedUsersSearch, UsersRouteSearch } from "./route-search";

export {
  normalizeUsersRouteSearch,
  usersRouteParams,
  usersSearchFrom,
  usersSearchParams,
} from "./route-search";

export type {
  AdminUserDetail,
  AdminUserFetcher,
} from "@/views/admin/views/core/users/detail/user-query";
export {
  adminUserQueryKey,
  canEditAdminUser,
  normalizeAdminUserId,
} from "@/views/admin/views/core/users/detail/user-query";
export type {
  AdminUserOption,
  AdminUserRow,
  AdminUsersOrderBy,
  AdminUsersPage,
  AdminUsersParams,
} from "@/views/admin/views/core/users/list/users-query";
export {
  ADMIN_USERS_ORDER_BY,
  ADMIN_USERS_TABLE_CONTRACT,
  adminUsersQueryKey,
  adminUsersQueryRoot,
  normalizeAdminRoleFilter,
  normalizeAdminUsersParams,
  searchAdminUsersInBrowser,
} from "@/views/admin/views/core/users/list/users-query";
export type {
  AdminUserCreated,
  AdminUserCreateInput,
  AdminUserUpdateInput,
} from "@/views/admin/views/core/users/users-mutations";
export {
  adminUserCreateConflictField,
  createAdminUser,
  updateAdminUser,
  updateAdminUserRoles,
  verifyAdminUserEmail,
} from "@/views/admin/views/core/users/users-mutations";
