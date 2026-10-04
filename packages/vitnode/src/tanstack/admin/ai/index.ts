export { AdminAiAccessRouteContent } from "./access-screen";
export { AdminAiActionsRouteContent } from "./actions-screen";
export { AdminAiHistoryRouteContent } from "./history-screen";
export { AdminAiModelsRouteContent } from "./models-screen";
export { AdminAiOverviewRouteContent } from "./overview-screen";
export {
  adminAiAccessQuery,
  adminAiActionsQuery,
  adminAiHistoryQuery,
  adminAiModelsQuery,
  adminAiOverviewQuery,
  adminAiRunQuery,
  adminAiSettingsQuery,
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
  loadAdminAiAccessRoute,
  loadAdminAiActionsRoute,
  loadAdminAiHistoryRoute,
  loadAdminAiModelsRoute,
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
  AdminAiAccess,
  AdminAiAction,
  AdminAiModel,
  AdminAiOverview,
  AdminAiRunDetail,
  AdminAiRunRow,
  AdminAiSettings,
} from "@/views/admin/views/core/ai/ai-query";
