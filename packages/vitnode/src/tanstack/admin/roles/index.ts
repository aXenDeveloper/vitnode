export type { AdminTableNavigate } from "../table-search";

export {
  adminRolesQuery,
  invalidateAfterAdminRoleChange,
  useAdminRoleMutations,
} from "./query";
export type { AdminRolesRouteData } from "./route";
export { ADMIN_ROLES_NAMESPACES, loadAdminRolesRoute } from "./route";
export type { RolesRouteSearch, UncheckedRolesSearch } from "./route-search";
export {
  normalizeRolesRouteSearch,
  rolesRouteParams,
  rolesSearchFrom,
  rolesSearchParams,
} from "./route-search";
export type { AdminRolesRouteProps } from "./screen";

export { AdminRolesRouteContent } from "./screen";

export type { AdminRoleInput } from "@/views/admin/views/core/users/roles/roles-mutations";
export {
  createAdminRole,
  deleteAdminRole,
  deleteAdminRoleArgs,
  updateAdminRole,
} from "@/views/admin/views/core/users/roles/roles-mutations";
export type {
  AdminRoleOption,
  AdminRoleRow,
  AdminRoleSearch,
  AdminRolesOrderBy,
  AdminRolesPage,
  AdminRolesParams,
} from "@/views/admin/views/core/users/roles/roles-query";
export {
  ADMIN_ROLE_SEARCH_LIMIT,
  ADMIN_ROLES_ORDER_BY,
  ADMIN_ROLES_TABLE_CONTRACT,
  adminRoleOptionsFrom,
  adminRolesQueryKey,
  adminRolesQueryRoot,
  normalizeAdminRolesParams,
  searchAdminRolesInBrowser,
} from "@/views/admin/views/core/users/roles/roles-query";
