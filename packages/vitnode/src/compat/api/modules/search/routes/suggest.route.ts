/**
 * Package entry for `@vitnode/core/api/modules/search/routes/suggest.route`.
 * Its own exports are served unchanged; the exports the API file migration
 * moved to other modules are re-exported here, deprecated, so existing deep
 * imports keep working. Source:
 * `src/api/modules/search/routes/suggest.route.ts`.
 */

/** @deprecated Import from `@vitnode/core/api/modules/search/lib/query-params`. */
export { searchSuggestionsLimit } from "@/api/modules/search/lib/query-params";
export { suggestRoute } from "@/api/modules/search/routes/suggest.route";
/** @deprecated Import from `@vitnode/core/api/modules/search/search.schema`. */
export { zodSearchSuggestion } from "@/api/modules/search/search.schema";
