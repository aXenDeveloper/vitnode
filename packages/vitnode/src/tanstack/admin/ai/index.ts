export { AdminAiActionsRouteContent } from "./actions-screen";
export { AdminAiHistoryRouteContent } from "./history-screen";
export { AdminAiOverviewRouteContent } from "./overview-screen";
export {
  adminAiActionsQuery,
  adminAiAltStatusQuery,
  adminAiHistoryQuery,
  adminAiModelsQuery,
  adminAiOverviewQuery,
  adminAiRoleAccessQuery,
  adminAiRunQuery,
  adminAiSettingsQuery,
  adminAiUserOverrideQuery,
  invalidateAdminAi,
  useAdminAiMutations,
} from "./query";
export type { AdminAiMutations } from "./query";
export type {
  AdminAiHistoryRouteData,
  AdminAiOverviewRouteData,
  AdminAiRouteData,
} from "./route";
export {
  ADMIN_AI_NAMESPACES,
  loadAdminAiActionsRoute,
  loadAdminAiHistoryRoute,
  loadAdminAiOverviewRoute,
  loadAdminAiSettingsRoute,
} from "./route";
export type {
  AiHistoryRouteSearch,
  AiOverviewRouteSearch,
  UncheckedAiHistorySearch,
} from "./route-search";
export {
  aiHistoryRouteParams,
  aiHistorySearchFrom,
  aiHistorySearchParams,
  normalizeAiHistoryRouteSearch,
  normalizeAiOverviewSearch,
} from "./route-search";
export { AdminAiSettingsRouteContent } from "./settings-screen";

export type {
  AdminAiAction,
  AdminAiModel,
  AdminAiOverview,
  AdminAiRunDetail,
  AdminAiRunRow,
  AdminAiSettings,
} from "@/views/admin/views/core/ai/ai-query";
