export { AdminDebugBreadcrumbContent } from "./breadcrumb";
export { AdminDebugLayoutContent } from "./layout";
export {
  clearAdminCache,
  debugLogsQuery,
  debugQueueQuery,
  debugSourceQueries,
  useClearAdminCache,
  useDebugSources,
  useRecheckDebugSources,
  warmDebugSources,
} from "./query";
export type { AdminDebugLayoutData } from "./route";
export {
  ADMIN_DEBUG_NAMESPACES,
  debugAiRoute,
  debugCacheRoute,
  debugCronRoute,
  debugLogsRoute,
  debugOverviewRoute,
  debugPluginsRoute,
  debugQueueRoute,
  debugSearchRoute,
  debugServicesRoute,
  debugVitnodeRoute,
  loadAdminDebugLayout,
} from "./route";
export type { DebugLogsRouteSearch, DebugTab } from "./route-search";
export {
  DEBUG_PATH,
  DEBUG_TABS,
  debugCronParams,
  debugLogsRouteParams,
  debugLogsSearchFrom,
  debugLogsSearchParams,
  debugTabFromPath,
  debugTabPath,
  normalizeDebugLogsSearch,
} from "./route-search";
export {
  DebugCacheTab,
  DebugOverviewTab,
  DebugPluginsTab,
  DebugServicesTab,
  DebugVitnodeTab,
} from "./sections";
export {
  DebugAiTab,
  DebugCronTab,
  DebugLogsTab,
  DebugQueueTab,
  DebugSearchTab,
} from "./tables";
export type { DebugSystemTab } from "./tabs";
export {
  DEBUG_DIAGNOSTIC_TABS,
  DEBUG_SYSTEM_TABS,
  DEBUG_TAB_PERMISSION,
  visibleDebugTabs,
} from "./tabs";

export type {
  DebugLogRow,
  DebugLogsOrderBy,
  DebugLogsPage,
  DebugLogsParams,
  DebugQueueSnapshot,
  DebugQueueTask,
} from "@/views/admin/views/core/debug/debug-query";
export {
  DEBUG_LOGS_ORDER_BY,
  DEBUG_LOGS_TABLE_CONTRACT,
  debugLogsQueryKey,
  debugLogsQueryRoot,
  debugQueueQueryKey,
} from "@/views/admin/views/core/debug/debug-query";
