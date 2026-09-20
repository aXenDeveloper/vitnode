export {
  adminNavigationPresetsQuery,
  adminNavigationQuery,
  invalidateAfterAdminNavigationChange,
  useAdminNavigationMutations,
} from "./query";
export type { AdminNavigationRouteData } from "./route";
export { ADMIN_NAVIGATION_NAMESPACES, loadAdminNavigationRoute } from "./route";
export { AdminNavigationRouteContent } from "./screen";

export type {
  AdminNavigationFormProps,
  AdminNavigationFormValues,
} from "@/views/admin/views/core/navigation/navigation-form-content";
export type { NavigationAdminListProps } from "@/views/admin/views/core/navigation/navigation-list-content";
export type {
  AdminNavigationCreateInput,
  AdminNavigationOrderInput,
  AdminNavigationUpdateInput,
} from "@/views/admin/views/core/navigation/navigation-mutations";
export {
  createAdminNavigation,
  deleteAdminNavigation,
  reorderAdminNavigation,
  updateAdminNavigation,
} from "@/views/admin/views/core/navigation/navigation-mutations";
export type {
  AdminNavigationItem,
  AdminNavigationList,
  AdminNavigationPresets,
} from "@/views/admin/views/core/navigation/navigation-query";
export {
  adminNavigationQueryRoot,
  fetchAdminNavigation,
  fetchAdminNavigationPresets,
} from "@/views/admin/views/core/navigation/navigation-query";
