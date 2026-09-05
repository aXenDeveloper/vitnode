export {
  adminFilesQuery,
  deleteAdminFile,
  deleteAdminFiles,
  invalidateAdminFiles,
  useAdminFilesDeleteCallbacks,
} from "./query";
export type { AdminFilesRouteData } from "./route";
export { ADMIN_FILES_NAMESPACES, loadAdminFilesRoute } from "./route";
export type {
  AdminFilesRouteSearch,
  UncheckedAdminFilesSearch,
} from "./route-search";
export {
  adminFilesRouteParams,
  adminFilesSearchFrom,
  adminFilesSearchParams,
  normalizeAdminFilesRouteSearch,
} from "./route-search";
export type { AdminFilesRouteProps } from "./screen";
export { AdminFilesRouteContent } from "./screen";

export type {
  DeleteAdminFile,
  DeleteAdminFileArgs,
  DeleteAdminFiles,
  DeleteAdminFilesArgs,
} from "@/views/admin/views/core/system/files/files-delete";
export type {
  AdminFileRow,
  AdminFilesOrderBy,
  AdminFilesPage,
  AdminFilesParams,
} from "@/views/admin/views/core/system/files/files-query";
export {
  ADMIN_FILES_ORDER_BY,
  ADMIN_FILES_TABLE_CONTRACT,
  adminFilesQueryKey,
  adminFilesQueryRoot,
} from "@/views/admin/views/core/system/files/files-query";
