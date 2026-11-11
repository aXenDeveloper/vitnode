/**
 * Package entry for
 * `@vitnode/blog/api/modules/categories/categories.module`. Its own exports
 * are served unchanged; the exports the API file migration moved to other
 * modules are re-exported here, deprecated, so existing deep imports keep
 * working. Source: `src/api/modules/categories/categories.module.ts`.
 */

export { categoriesModule } from "@/api/modules/categories/categories.module";
/** @deprecated Import from `@vitnode/blog/api/modules/categories/routes/list.route`. */
export { zodBlogCategorySummary } from "@/api/modules/categories/routes/list.route";
