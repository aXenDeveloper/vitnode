/**
 * `/admin/core/debug` - the debug panel, for a TanStack Start host.
 *
 *     ./query         two query definitions, and `clearAdminCache` - the one
 *                     action on this screen with no endpoint behind it
 *     ./route-search  the URL contract, which is the system log's
 *     ./route         the screen: namespaces, permission, loader, component
 *     ./server        the SSR transport, reached only through `./query`
 *
 * `SystemLogsContent`, `QueueViewContent` and `ClearCacheAction` are
 * framework-free and imported from `@/views/admin/views/core/debug` by both
 * applications.
 */
export {
  clearAdminCache,
  debugLogsQuery,
  debugQueueQuery,
  useClearAdminCache,
} from "./query";
export type { AdminDebugRouteData, AdminDebugRouteProps } from "./route";
export {
  ADMIN_DEBUG_NAMESPACES,
  AdminDebugRouteContent,
  loadAdminDebugRoute,
} from "./route";
export type { DebugRouteSearch, UncheckedDebugSearch } from "./route-search";
export {
  debugLogsRouteParams,
  debugSearchFrom,
  debugSearchParams,
  normalizeDebugRouteSearch,
} from "./route-search";

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
