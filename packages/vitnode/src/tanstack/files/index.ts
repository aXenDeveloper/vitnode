export {
  deleteMyFile,
  deleteMyFiles,
  invalidateMyFiles,
  myFilesQuery,
  useMyFilesDeleteCallbacks,
} from "./query";
export type {
  MyFilesLoaderContext,
  MyFilesNavigate,
  MyFilesRouteData,
} from "./route";
export { loadMyFilesRoute, MY_FILES_NAMESPACES } from "./route";
export type {
  MyFilesRouteSearch,
  UncheckedMyFilesSearch,
} from "./route-search";
export {
  myFilesRouteParams,
  myFilesSearchFrom,
  myFilesSearchParams,
  normalizeMyFilesRouteSearch,
} from "./route-search";
export type { MyFilesRouteProps } from "./screen";
export { MyFilesRouteContent } from "./screen";

export type {
  BulkDeleteFilesResult,
  DeleteFileResult,
  DeleteMyFile,
  DeleteMyFileArgs,
  DeleteMyFiles,
  DeleteMyFilesArgs,
} from "@/views/files/my-files-delete";
/**
 * `/files`, as everything a TanStack Start route needs and nothing a route owns.
 *
 * Two halves, and they are separate files for a reason rather than by habit:
 *
 * - `./route-search` is the URL contract. Pure functions, no transport, no
 *   React, so what `?orderBy=name` means can be stated and tested without a
 *   router.
 * - `./query` is the cache contract. One query definition, one invalidation
 *   family, and the two deletes that decide when to use it.
 *
 * The rendering is not here and does not belong here: `MyFilesTableContent` is
 * framework-free already and is imported from `@vitnode/core/views/files/
 * my-files-table-content` by both applications. What this namespace adds is the
 * half that only a TanStack Start host can run - an isomorphic fetcher whose
 * server branch reads the request being rendered.
 *
 * The key factories are re-exported rather than left to be imported from
 * `views/files/my-files-query`, so a route has one place to reach for and cannot
 * invent a second spelling of an entry this module's invalidation would then
 * miss.
 */
export {
  isMyFilesRequestError,
  MY_FILES_MAX_PAGE_SIZE,
  MY_FILES_ORDER,
  MY_FILES_ORDER_BY,
  myFilesQueryKey,
  myFilesQueryRoot,
  MyFilesRequestError,
} from "@/views/files/my-files-query";
export type {
  MyFile,
  MyFilesOrder,
  MyFilesOrderBy,
  MyFilesPage,
  MyFilesParams,
} from "@/views/files/my-files-query";
