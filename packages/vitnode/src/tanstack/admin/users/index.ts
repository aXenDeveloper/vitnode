export type { AdminTableNavigate } from "../table-search";
export { AdminUserBreadcrumbContent } from "./detail-breadcrumb";

export type { AdminUserRouteData } from "./detail-route";
export { ADMIN_USER_NAMESPACES, loadAdminUserRoute } from "./detail-route";
export type { AdminUserRouteProps } from "./detail-screen";
export { AdminUserRouteContent } from "./detail-screen";
export {
  adminUserQuery,
  adminUsersQuery,
  invalidateAdminUsers,
  invalidateAfterAdminUserRolesChange,
  useAdminUserMutations,
} from "./query";
export type { AdminUsersRouteData } from "./route";
export { ADMIN_USERS_NAMESPACES, loadAdminUsersRoute } from "./route";
export type { UncheckedUsersSearch, UsersRouteSearch } from "./route-search";
export {
  normalizeUsersRouteSearch,
  usersRouteParams,
  usersSearchFrom,
  usersSearchParams,
} from "./route-search";
export type { AdminUsersRouteProps } from "./screen";

export { AdminUsersRouteContent } from "./screen";

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
