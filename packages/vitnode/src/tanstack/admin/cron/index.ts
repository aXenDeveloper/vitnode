export type { AdminTableNavigate } from "../table-search";
/**
 * `/admin/core/advanced/cron` - the AdminCP cron list, for a TanStack Start host.
 *
 * Three modules behind one specifier:
 *
 *     ./query   the cache contract - one query definition, one invalidation
 *               family, and the run that decides when to use it
 *     ./route   the screen: namespaces, permission, loader, component
 *     ./server  the SSR transport, reached only through `./query`'s isomorphic
 *               function and never imported from a browser bundle
 *
 * The rendering is not here and does not belong here: `CronTableContent` is
 * framework-free and is imported from `@/views/admin/views/core/advanced/cron`
 * by both applications.
 */
export {
  cronQuery,
  invalidateCron,
  runCron,
  useCronRunCallback,
} from "./query";
export type { AdminCronRouteData } from "./route";
export { ADMIN_CRON_NAMESPACES, loadAdminCronRoute } from "./route";
export type { CronRouteSearch, UncheckedCronSearch } from "./route-search";
export {
  cronRouteParams,
  cronSearchFrom,
  cronSearchParams,
  normalizeCronRouteSearch,
} from "./route-search";
export type { AdminCronRouteProps } from "./screen";

export { AdminCronRouteContent } from "./screen";

export type {
  CronJobRow,
  CronOrderBy,
  CronPage,
  CronParams,
} from "@/views/admin/views/core/advanced/cron/cron-query";
export {
  CRON_ORDER_BY,
  CRON_TABLE_CONTRACT,
  cronQueryKey,
  cronQueryRoot,
} from "@/views/admin/views/core/advanced/cron/cron-query";
