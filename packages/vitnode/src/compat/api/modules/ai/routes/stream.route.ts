/**
 * Package entry for `@vitnode/core/api/modules/ai/routes/stream.route`. Its
 * own exports are served unchanged; the exports the API file migration moved
 * to other modules are re-exported here, deprecated, so existing deep
 * imports keep working. Source: `src/api/modules/ai/routes/stream.route.ts`.
 */

/** @deprecated Import from `@vitnode/core/api/modules/ai/routes/estimate.route`. */
export { estimateAiRoute } from "@/api/modules/ai/routes/estimate.route";
export { streamAiRoute } from "@/api/modules/ai/routes/stream.route";
