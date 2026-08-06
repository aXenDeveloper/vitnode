/**
 * Universal Content Engine - server surface.
 *
 * Imports Drizzle, so this must never be reachable from a client component.
 * It must also never import `server-only`: that package's `default` export
 * throws under plain Node, and both `apps/api` and `drizzle-kit` load these
 * modules in plain Node.
 */
export { CONTENT_SYSTEM_ACTOR, resolveContentActor } from "./actor";
export {
  buildContentColumn,
  buildEditorialColumns,
  buildPublicationColumns,
  buildSystemColumns,
} from "./column-builders";
export type { ColumnReferenceThunk } from "./column-builders";
export { contentEditorialEffects } from "./editorial-effects";
export { createContentEditorialService } from "./editorial-service";
export type {
  ContentEditorialOptions,
  ContentEditorialOutcome,
  ContentEditorialPublicationOptions,
  ContentEditorialService,
  ContentEditorialWriteOptions,
} from "./editorial-service";
export { emitContentEvent } from "./emit";
export {
  contentConflict,
  contentUnprocessable,
  rethrowAsHttpError,
  withHttpErrors,
} from "./http-errors";
export type { ContentHttpErrorOptions } from "./http-errors";
export { createContentModel, findContentModel } from "./model";
export type {
  AnyContentModel,
  ContentModel,
  RegisteredContentModel,
} from "./model";
export { buildContentAdminModule } from "./module";
export {
  createContentPreviewToken,
  verifyContentPreviewToken,
  zodContentPreviewTokenPayload,
} from "./preview-token";
export type {
  ContentPreviewToken,
  ContentPreviewTokenPayload,
} from "./preview-token";
export { buildContentPublicModule } from "./public-module";
export { buildContentPublicRoutes } from "./public-routes";
export {
  contentPublicSelection,
  createContentPublicProjector,
  createContentPublicService,
} from "./public-service";
export type {
  ContentPublicFindManyArgs,
  ContentPublicService,
} from "./public-service";
export {
  publicationColumns,
  publicationMethods,
  publishedCondition,
} from "./publication";
export type { PublicationColumns } from "./publication";
export {
  buildFilterCondition,
  buildOrderColumn,
  buildSearchCondition,
  diffChangedFields,
  escapeLikePattern,
  toColumnValues,
} from "./query";
export { LABEL_PREFIX, resolveReferenceTargets, toLabel } from "./references";
export type { ReferenceTarget } from "./references";
export {
  contentRevisionSnapshot,
  contentSnapshotRow,
  projectRevisionSnapshot,
} from "./revision-snapshot";
export { createContentRevisionsModel } from "./revisions-model";
export type {
  ContentRevisionCaptureInput,
  ContentRevisionsModel,
} from "./revisions-model";
export { buildContentRoutes } from "./routes";
export { contentSearchDocument } from "./search-document";
export { createContentSearchIndexer } from "./search-indexer";
export type { ContentSearchIndexer } from "./search-indexer";
export { syncContentSearch } from "./search-sync";
export type {
  ContentSearchOperation,
  ContentSearchSyncInput,
  ContentSearchSyncOutcome,
} from "./search-sync";
export { createContentService } from "./service";
export type {
  ContentDatabase,
  ContentFindManyArgs,
  ContentLabels,
  ContentListRow,
  ContentPageInfo,
  ContentPublicationMethods,
  ContentPublicationResult,
  ContentService,
  ContentServiceBase,
  ContentServiceOptions,
  ContentUpdateResult,
} from "./service";
export { createSlugNormalizer } from "./slugs";
export type { ContentSlugNormalizer } from "./slugs";
export { contentTableColumns, createContentTable } from "./table";
export type {
  ContentColumnBuilder,
  ContentColumnBuilders,
  ContentColumnName,
  ContentEditorialColumnBuilders,
  ContentPublicationColumnBuilders,
  ContentReferences,
  ContentSystemColumnBuilders,
  ContentTable,
  ContentTableFor,
} from "./types";
