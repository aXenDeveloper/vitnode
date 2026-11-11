/**
 * Package entry for `@vitnode/core/api/modules/search/routes/search.route`.
 * Its own exports are served unchanged; the exports the API file migration
 * moved to other modules are re-exported here, deprecated, so existing deep
 * imports keep working. Source:
 * `src/api/modules/search/routes/search.route.ts`.
 */

/** @deprecated Import from `@vitnode/core/api/modules/search/lib/query-params`. */
export {
  dateOrUndefined,
  MAX_SEARCH_AUTHOR_IDS,
  positiveIntListOrUndefined,
  positiveIntOrUndefined,
} from "@/api/modules/search/lib/query-params";
export { searchRoute } from "@/api/modules/search/routes/search.route";
/** @deprecated Import from `@vitnode/core/api/modules/search/search.schema`. */
export {
  zodSearchHitAuthor,
  zodSearchHitSchema,
  zodSearchResultSchema,
} from "@/api/modules/search/search.schema";
