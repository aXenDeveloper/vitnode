export type { AdminTableNavigate } from "../table-search";
export {
  AdminStaffBreadcrumbContent,
  AdminStaffCreateBreadcrumbContent,
  AdminStaffEditBreadcrumbContent,
} from "./breadcrumbs";
/**
 * `/admin/core/staff/*` - the AdminCP staff screens, for a TanStack Start host.
 *
 *     ./query         three query definitions and three writes - each of which
 *                     also invalidates the admin session, because a staff entry
 *                     *is* a permission grant
 *     ./route         both lists: one screen, parameterised by staff type
 *     ./create-route  adding a role or a user to a group
 *     ./edit-route    choosing what an entry may do, and the chunked label load
 *                     the flat permission-message keys require
 *     ./route-search  the URL contract both lists share
 *     ./server        the SSR transports, reached only through `./query`
 *
 * The rendering is framework-free and lives in
 * `@/views/admin/views/core/staff`; the rules the forms apply are
 * `staff-model.ts`, which is pure and has its own tests.
 */
export type {
  AdminStaffCreateRouteData,
  AdminStaffCreateRouteProps,
} from "./create-route";
export {
  ADMIN_STAFF_CREATE_NAMESPACES,
  AdminStaffCreateRouteContent,
  loadAdminStaffCreateRoute,
} from "./create-route";
export type {
  AdminStaffEditRouteData,
  AdminStaffEditRouteProps,
  AdminStaffEditSubject,
} from "./edit-route";
export {
  ADMIN_STAFF_EDIT_NAMESPACES,
  AdminStaffEditRouteContent,
  loadAdminStaffEditRoute,
  loadStaffPermissionLabels,
} from "./edit-route";
export {
  adminStaffCatalogQuery,
  adminStaffEntryQuery,
  adminStaffQuery,
  invalidateAfterStaffChange,
  useStaffCreateCallback,
  useStaffDeleteCallback,
  useStaffSaveCallback,
} from "./query";
export type { AdminStaffRouteData, AdminStaffRouteProps } from "./route";
export {
  ADMIN_STAFF_NAMESPACES,
  AdminStaffRouteContent,
  loadAdminStaffRoute,
} from "./route";
export type { StaffRouteSearch, UncheckedStaffSearch } from "./route-search";

export {
  normalizeStaffRouteSearch,
  staffRouteParams,
  staffSearchFrom,
  staffSearchParams,
} from "./route-search";

export type {
  StaffCatalog,
  StaffModuleGroup,
  StaffPermissionItem,
  StaffPluginGroup,
} from "@/views/admin/views/core/staff/staff-model";
export {
  buildStaffPermissionGroups,
  normalizeStaffEntryId,
  STAFF_TYPE_SEGMENT,
  staffBreadcrumbLabels,
  staffCreateHref,
  staffEditHref,
  staffListHref,
  staffPermissionsForSubmit,
  staffTypeFromSegment,
} from "@/views/admin/views/core/staff/staff-model";
export {
  createStaffEntry,
  deleteStaffEntry,
  updateStaffPermissions,
} from "@/views/admin/views/core/staff/staff-mutations";
export type {
  AdminStaffEntry,
  AdminStaffOrderBy,
  AdminStaffPage,
  AdminStaffParams,
  AdminStaffRole,
  AdminStaffRow,
} from "@/views/admin/views/core/staff/staff-query";
export {
  ADMIN_STAFF_ORDER_BY,
  ADMIN_STAFF_TABLE_CONTRACT,
  adminStaffQueryKey,
  adminStaffQueryRoot,
  normalizeAdminStaffParams,
  staffPermissionModuleFor,
} from "@/views/admin/views/core/staff/staff-query";
