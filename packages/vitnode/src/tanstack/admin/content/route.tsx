import { notFound } from "@tanstack/react-router";
import { createTranslator } from "use-intl";

import type { ContentLabelTranslator } from "@/content/admin/labels";
import type {
  ContentAdminAction,
  ContentFrontendRegistry,
  RegisteredFrontendContentType,
} from "@/content/index";
import type { ContentRouteLabels } from "@/views/admin/views/content/content-labels";

import { resolveContentAdminRoute } from "@/content/index";
import { CONTENT_PERMISSIONS } from "@/content/index";
import {
  contentLabelsFrom,
  contentRouteLabels,
  contentRouteNamespaces,
} from "@/views/admin/views/content/content-labels";

import type { AdminScreenContext } from "../screen";
import type {
  ContentListParams,
  UncheckedContentListSearch,
} from "./route-search";

import { intlQueryOptions } from "../../i18n/query";
import { requireAdminPermission } from "../screen";
import { contentListPageQuery } from "./query";
import { contentListRouteParams } from "./route-search";

export const contentRouteSegments = (splat: string | undefined): string[] =>
  (splat ?? "").split("/").filter(segment => segment !== "");

/** What a content URL resolved to: which screen, and which content type. */
export interface ContentAdminScreen {
  action: ContentAdminAction;
  entry: RegisteredFrontendContentType;
  /** The record being edited. Only ever set for `edit`. */
  itemId?: number;
}

export const resolveContentAdminScreen = (
  segments: readonly string[],
  registry: ContentFrontendRegistry,
): ContentAdminScreen | undefined => {
  const route = resolveContentAdminRoute(segments, registry.lookup);
  if (!route) return undefined;

  const entry = registry.byId(route.contentTypeId);

  return entry ? { ...route, entry } : undefined;
};

/** The permission tuple one content screen checks, for one action. */
export const contentPermissionFor = (
  entry: RegisteredFrontendContentType,
  permission: (typeof CONTENT_PERMISSIONS)[keyof typeof CONTENT_PERMISSIONS],
) => ({
  module: entry.definition.permissionModule,
  permission,
  plugin: entry.pluginId,
});

/** What {@link loadContentAdminRoute} returns, and therefore what `head` gets. */
export interface ContentAdminRouteData {
  action: ContentAdminAction;
  adminPath: string;
  contentTypeId: string;
  description: string | undefined;
  itemId?: number;

  labels: ContentRouteLabels;

  listParams?: ContentListParams;
  namespaces: string[];
  pluginId: string;
  title: string;
}

export const loadContentAdminRoute = async ({
  adminAccess,
  locale,
  queryClient,
  registry,
  search,
  segments,
}: AdminScreenContext & {
  registry: ContentFrontendRegistry;

  search?: UncheckedContentListSearch;
  segments: readonly string[];
}): Promise<ContentAdminRouteData> => {
  const screen = resolveContentAdminScreen(segments, registry);

  if (!screen) {
    // TanStack Router's own control-flow signal, answered by `_admin`'s
    // `notFoundComponent` - the same outcome the Next.js page's `notFound()`
    // produces, one navigation earlier.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw notFound();
  }

  const { action, entry, itemId } = screen;

  requireAdminPermission(
    adminAccess,
    contentPermissionFor(entry, CONTENT_PERMISSIONS.view),
  );

  const namespaces = contentRouteNamespaces(entry.pluginId);
  const listParams =
    action === "list"
      ? contentListRouteParams(search ?? {}, entry.definition)
      : undefined;

  const [intl] = await Promise.all([
    queryClient.ensureQueryData(intlQueryOptions({ locale, namespaces })),
    listParams
      ? queryClient.ensureQueryData({
          ...contentListPageQuery({
            definition: entry.definition,
            locale,
            params: listParams,
            pluginId: entry.pluginId,
          }),
          revalidateIfStale: true,
        })
      : undefined,
  ]);

  const t = createTranslator({
    locale,
    messages: intl.messages,
    onError: () => {
      // A missing key is the *expected* case here - every label key is optional
      // and the resolver falls back to a humanised field name. Left unhandled,
      // `use-intl` logs one console error per absent translation, which for an
      // untranslated plugin is a screenful of noise on every render.
    },
  }) as unknown as ContentLabelTranslator;

  const labels = contentLabelsFrom(entry, t);

  return {
    action,
    adminPath: entry.definition.admin.path,
    contentTypeId: entry.definition.id,
    description: labels.desc,
    ...(itemId === undefined ? {} : { itemId }),
    labels: contentRouteLabels(labels),
    ...(listParams === undefined ? {} : { listParams }),
    namespaces,
    pluginId: entry.pluginId,
    title: labels.title,
  };
};
