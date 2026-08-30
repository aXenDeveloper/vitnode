/**
 * `/admin/content/*` - the Content Engine, for a TanStack Start host.
 *
 *     ./route         resolution, permissions, i18n, labels, the screen shell
 *     ./route-search  the list's URL contract, derived from a content type
 *     ./query         one list query definition, and the writes a row performs
 *     ./list          the table, its columns, its navigation and its skeleton
 *     ./create-action the heading's create button - a link or a dialog
 *     ./row-actions   publish, edit, delete, and the editorial menu
 *     ./editorial     the four `⋯` panels - history, schedule, preview, delivery
 *     ./slots         what the list does not implement - forms, editorial panels
 *     ./screen        the composition: which of the three screens a URL is
 *     ./breadcrumb    the trail, from the same labels
 *     ./server        the SSR transport, reached only through a query
 *
 * One splat serves the list, the page-mode create screen and the page-mode edit
 * screen, exactly as the Next.js catch-all does - so a plugin adds a content
 * type without adding a route file. Which of the three a URL means is
 * `resolveContentAdminRoute`'s answer, imported from `@vitnode/core/content`
 * rather than reimplemented here.
 *
 * The host supplies two things this package cannot know: which plugins are
 * installed (`ContentFrontendRegistry`, from the generated registry) and how a
 * path becomes a navigation (`LinkComponent`).
 */
export type { ContentAdminBreadcrumbProps } from "./breadcrumb";
export { ContentAdminBreadcrumbContent } from "./breadcrumb";
export { ContentCreateAction } from "./create-action";
/**
 * The editorial panels, republished at the screen's own entry point.
 *
 * Two segments below `tanstack/` is the export map's bound, so a host reaches
 * them through here. `./screen` already imports the namespace for its side
 * effect - importing it is what registers the panels - and a host normally needs
 * none of this; it is exported for an application that mounts a content screen
 * of its own.
 */
export {
  ContentEditorialHost,
  contentEditorialRowPanels,
  contentEditorialTransport,
} from "./editorial";
/**
 * The form screens' loader, republished at the screen's own entry point.
 *
 * `@vitnode/core/tanstack/admin/content/form` is a *screen's internals* as far
 * as the package's export map is concerned - two segments below `tanstack/` is
 * the bound, and `apps/web`'s `package-boundary.test.ts` enforces it - so a host
 * route reaches the loader through here. `./screen` already imports the
 * namespace itself, both to render the form screens and because importing it is
 * what registers the dialog slot.
 */
/**
 * The form loader, reached past `./form` rather than through it.
 *
 * `./form/index.ts` registers the create/edit dialog as a module side effect -
 * that is what makes a dialog-mode content type openable at all - so it is
 * marked side-effectful in the package's `sideEffects` list and a bundler may
 * never drop it. Which means every static edge into that barrel keeps
 * `ContentAdminFormDialog` and the whole AutoForm stack behind it.
 *
 * A host's route file imports `loadContentFormScreen` from a `loader`, and a
 * `loader` is evaluated in the client entry - so that edge put `react-hook-form`
 * and `@hookform/resolvers` on the path to every page of the application.
 * Importing the loader's own module instead keeps the eager half clear; the
 * registration still happens, because `./screen` imports `./form` and that is
 * the module a content screen actually renders through.
 */
export type { ContentFormScreenData } from "./form/route";
export { loadContentFormScreen } from "./form/route";
export type { ContentListScreenProps } from "./list";
export { ContentListActions, ContentListScreen } from "./list";
export type { ContentListQueryArgs, ContentRowWriteArgs } from "./query";
export {
  contentApiTarget,
  contentListPageQuery,
  contentListRequestFor,
  deleteContentRow,
  invalidateContentAfterWrite,
  setContentPublication,
} from "./query";
export type { ContentAdminRouteData, ContentAdminScreen } from "./route";
export {
  contentPermissionFor,
  contentRouteSegments,
  loadContentAdminRoute,
  resolveContentAdminScreen,
} from "./route";
export type { ContentAdminRouteProps } from "./route-screen";
export { ContentAdminRouteContent } from "./route-screen";
export type {
  ContentListFilters,
  ContentListParams,
  ContentListRouteSearch,
  UncheckedContentListSearch,
} from "./route-search";
export {
  contentListFilters,
  contentListQuery,
  contentListRouteParams,
  contentListSearchFrom,
  contentListSearchParams,
  contentTableContract,
  normalizeContentListSearch,
} from "./route-search";
export type { ContentRowActionsProps } from "./row-actions";
export { ContentRowActions } from "./row-actions";
export type { ContentAdminScreenProps } from "./screen";
export { ContentAdminScreenContent } from "./screen";
export type {
  ContentAdminSlots,
  ContentFormDialogProps,
  ContentRowPanel,
  ContentRowPanelProps,
} from "./slots";
export {
  contentAdminSlots,
  registeredContentRowPanels,
  setContentAdminSlots,
} from "./slots";

export {
  contentDeliveryRequestLocale,
  hasContentDelivery,
} from "@/views/admin/views/content/actions/delivery-model";
export {
  contentDeliveryLocaleQueryKey,
  contentHistoryListQueryKey,
  contentRevisionQueryKey,
  flattenContentRevisionPages,
  nextContentRevisionCursor,
} from "@/views/admin/views/content/actions/editorial-query";
/**
 * The canonical query key family, re-exported so a screen imports its keys from
 * the same place it imports its loader.
 */
export type {
  ContentEditorialSettled,
  ContentEditorialTransport,
  ContentEditorialWriteScope,
} from "@/views/admin/views/content/actions/editorial-transport";
export {
  CONTENT_EDITORIAL_TRANSPORT_MISSING,
  ContentEditorialTransportProvider,
  useContentEditorialTransport,
} from "@/views/admin/views/content/actions/editorial-transport";
/**
 * The list's shared model, re-exported so a screen imports the rules it renders
 * from the same place it imports the screen. All of it is framework-neutral and
 * all of it is what the Next.js AdminCP reads too.
 */
export type {
  ContentEditorialActionId,
  ContentRowActionId,
} from "@/views/admin/views/content/actions/row-actions-model";
export {
  CONTENT_EDITORIAL_ACTION_IDS,
  CONTENT_ROW_ACTION_IDS,
  CONTENT_ROW_INLINE_ACTION_LIMIT,
  contentRowActionIds,
  contentRowActionsAreInline,
  isDestructiveContentRowAction,
} from "@/views/admin/views/content/actions/row-actions-model";
export type {
  ContentLabels,
  ContentRouteLabels,
} from "@/views/admin/views/content/content-labels";
export {
  contentLabelsFrom,
  contentRouteNamespaces,
} from "@/views/admin/views/content/content-labels";
export {
  ADMIN_CONTENT_SCREEN,
  CONTENT_USER_TARGET,
  contentDeliveryQueryKey,
  contentHistoryQueryKey,
  contentHistoryQueryRoot,
  contentItemQueryKey,
  contentItemQueryRoot,
  contentListQueryKey,
  contentListQueryRoot,
  contentOptionsQueryKey,
  contentOptionsQueryRoot,
  contentQueryRoot,
  contentSchedulesQueryKey,
  contentTranslationsQueryKey,
  contentTypeQueryRoot,
} from "@/views/admin/views/content/content-query";
export type {
  ContentApiRead,
  ContentApiRequest,
  ContentApiTarget,
} from "@/views/admin/views/content/content-request";
export {
  contentApiFetchArgs,
  contentApiFetchInBrowser,
  readContentApiJson,
} from "@/views/admin/views/content/content-request";
/**
 * The narrow invalidation helpers, shared with the Next.js AdminCP.
 *
 * One prefix each, none of them above the content type that was written to.
 * `invalidateContentAfterWrite` in `./query` composes the three a record write
 * owes; these are what a panel reaches for when it owes less than that.
 */
export {
  invalidateContentDelivery,
  invalidateContentHistory,
  invalidateContentItem,
  invalidateContentList,
  invalidateContentSchedules,
  invalidateContentTranslations,
  removeContentItem,
  removeContentOptions,
} from "@/views/admin/views/content/lib/invalidate";
export type { ContentRowData } from "@/views/admin/views/content/table/cells";
export type { ContentCellLabels } from "@/views/admin/views/content/table/columns";
export {
  buildContentTableColumns,
  contentColumnEntries,
  contentRowTitle,
  contentTableColumnCount,
  contentTableOrder,
  contentTableSearchEnabled,
} from "@/views/admin/views/content/table/columns";
export type { ContentRowMutationResult } from "@/views/admin/views/content/table/list-mutations";
export type {
  ContentListPage,
  ContentListPageFetcher,
  ContentListRequest,
} from "@/views/admin/views/content/table/list-query";
export {
  contentListQueryOptions,
  contentListRequestKey,
  contentListWireQuery,
} from "@/views/admin/views/content/table/list-query";
