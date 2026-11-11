/**
 * Package entry for
 * `@vitnode/core/api/modules/search/routes/timeline.route`. Its own exports
 * are served unchanged; the exports the API file migration moved to other
 * modules are re-exported here, deprecated, so existing deep imports keep
 * working. Source: `src/api/modules/search/routes/timeline.route.ts`.
 */

/** @deprecated Import from `@vitnode/core/api/modules/search/lib/timeline`. */
export { searchTimeline } from "@/api/modules/search/lib/timeline";
export { timelineRoute } from "@/api/modules/search/routes/timeline.route";
/** @deprecated Import from `@vitnode/core/api/modules/search/search.schema`. */
export {
  zodSearchTimelineQuery,
  zodSearchTimelineUserId,
} from "@/api/modules/search/search.schema";
