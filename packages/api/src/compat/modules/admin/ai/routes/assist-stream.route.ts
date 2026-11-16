/**
 * Package entry for `@vitnode/api/modules/admin/ai/routes/assist-
 * stream.route`. Its own exports are served unchanged; the exports the API
 * file migration moved to other modules are re-exported here, deprecated, so
 * existing deep imports keep working. Source:
 * `src/api/modules/admin/ai/routes/assist-stream.route.ts`.
 */

/** @deprecated Import from `@vitnode/api/modules/admin/ai/routes/assist-estimate.route`. */
export { estimateAiAdminRoute } from "@/modules/admin/ai/routes/assist-estimate.route";
export { assistStreamAiAdminRoute } from "@/modules/admin/ai/routes/assist-stream.route";
