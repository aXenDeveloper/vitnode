/**
 * Package entry for `@vitnode/api/modules/search/routes/search.route`.
 * Its own exports are served unchanged; the exports the API file migration
 * moved to other modules are re-exported here, deprecated, so existing deep
 * imports keep working. Source:
 * `src/api/modules/search/routes/search.route.ts`.
 */

/** @deprecated Import from `@vitnode/api/modules/search/lib/query-params`. */
export {
  dateOrUndefined,
  MAX_SEARCH_AUTHOR_IDS,
  positiveIntListOrUndefined,
  positiveIntOrUndefined,
} from "@/modules/search/lib/query-params";
export { searchRoute } from "@/modules/search/routes/search.route";
/** @deprecated Import from `@vitnode/api/modules/search/search.schema`. */
export {
  zodSearchHitAuthor,
  zodSearchHitSchema,
  zodSearchResultSchema,
} from "@/modules/search/search.schema";
