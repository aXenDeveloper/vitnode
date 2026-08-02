/**
 * Universal Content Engine - server surface.
 *
 * Imports Drizzle, so this must never be reachable from a client component.
 * It must also never import `server-only`: that package's `default` export
 * throws under plain Node, and both `apps/api` and `drizzle-kit` load these
 * modules in plain Node.
 */
export { buildContentColumn, buildSystemColumns } from "./column-builders";
export type { ColumnReferenceThunk } from "./column-builders";
export { emitContentEvent } from "./emit";
export { rethrowAsHttpError, withHttpErrors } from "./http-errors";
export { createContentModel } from "./model";
export type { ContentModel } from "./model";
export { buildContentAdminModule } from "./module";
export {
  buildFilterCondition,
  buildOrderColumn,
  buildSearchCondition,
  diffChangedFields,
  escapeLikePattern,
  toColumnValues,
} from "./query";
export { buildContentRoutes } from "./routes";
export { createContentService } from "./service";
export type {
  ContentDatabase,
  ContentFindManyArgs,
  ContentLabels,
  ContentListRow,
  ContentPageInfo,
  ContentService,
  ContentServiceOptions,
  ContentUpdateResult,
} from "./service";
export { contentTableColumns, createContentTable } from "./table";
export type {
  ContentColumnBuilder,
  ContentColumnBuilders,
  ContentColumnName,
  ContentReferences,
  ContentSystemColumnBuilders,
  ContentTable,
  ContentTableFor,
} from "./types";
