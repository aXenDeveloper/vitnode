export type { ContentAdminBreadcrumbProps } from "./breadcrumb";
export { ContentAdminBreadcrumbContent } from "./breadcrumb";
export { ContentCreateAction } from "./create-action";

export {
  ContentEditorialHost,
  contentEditorialRowPanels,
  contentEditorialTransport,
} from "./editorial";

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
