export type { AdminTableNavigate } from "../table-search";
export {
  AdminStaffBreadcrumbContent,
  AdminStaffCreateBreadcrumbContent,
  AdminStaffEditBreadcrumbContent,
} from "./breadcrumbs";

export type { AdminStaffCreateRouteData } from "./create-route";
export {
  ADMIN_STAFF_CREATE_NAMESPACES,
  loadAdminStaffCreateRoute,
} from "./create-route";
export type { AdminStaffCreateRouteProps } from "./create-screen";
export { AdminStaffCreateRouteContent } from "./create-screen";
export type {
  AdminStaffEditRouteData,
  AdminStaffEditSubject,
} from "./edit-route";
export {
  ADMIN_STAFF_EDIT_NAMESPACES,
  loadAdminStaffEditRoute,
  loadStaffPermissionLabels,
} from "./edit-route";
export type { AdminStaffEditRouteProps } from "./edit-screen";
export { AdminStaffEditRouteContent } from "./edit-screen";
export {
  adminStaffCatalogQuery,
  adminStaffEntryQuery,
  adminStaffQuery,
  invalidateAfterStaffChange,
  useStaffCreateCallback,
  useStaffDeleteCallback,
  useStaffSaveCallback,
} from "./query";
export type { AdminStaffRouteData } from "./route";
export { ADMIN_STAFF_NAMESPACES, loadAdminStaffRoute } from "./route";
export type { StaffRouteSearch, UncheckedStaffSearch } from "./route-search";
export {
  normalizeStaffRouteSearch,
  staffRouteParams,
  staffSearchFrom,
  staffSearchParams,
} from "./route-search";
export type { AdminStaffRouteProps } from "./screen";

export { AdminStaffRouteContent } from "./screen";

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
