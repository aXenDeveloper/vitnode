import { notFound } from "@tanstack/react-router";
import { createTranslator } from "use-intl";

import type { ContentLabelTranslator } from "@/content/admin/labels";
import type { ContentId } from "@/content/ids";
import type {
  ContentAdminAction,
  ContentFrontendRegistry,
  RegisteredFrontendContentType,
} from "@/content/index";
import type { ContentRouteLabels } from "@/views/admin/views/content/content-labels";

import { resolveContentAdminRoute } from "@/content/index";
import { CONTENT_PERMISSIONS } from "@/content/index";
import { contentContainerListQuery } from "@/views/admin/views/containers/container-query";
import { contentContainerApiTarget } from "@/views/admin/views/containers/container-request";
import {
  contentLabelsFrom,
  contentRouteLabels,
  contentRouteNamespaces,
} from "@/views/admin/views/content/content-labels";

import type { AdminScreenContext } from "../screen";
import type { AdminAccessState } from "../session-api";
import type {
  ContentListParams,
  UncheckedContentListSearch,
} from "./route-search";

import { intlQueryOptions } from "../../i18n/query";
import { requireAdminPermission } from "../screen";
import { hasAdminPermission } from "../state";
import { contentListPageQuery } from "./query";
import { contentListRouteParams } from "./route-search";

export const contentRouteSegments = (splat: string | undefined): string[] =>
  (splat ?? "").split("/").filter(segment => segment !== "");

/** What a content URL resolved to: which screen, and which content type. */
export interface ContentAdminScreen {
  action: ContentAdminAction;
  entry: RegisteredFrontendContentType;
  /** The record being edited. Only ever set for `edit`. */
  itemId?: ContentId;
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
  itemId?: ContentId;

  labels: ContentRouteLabels;

  listParams?: ContentListParams;
  namespaces: string[];
  pluginId: string;
  title: string;
}

/**
 * Warms the container trees a list's `container` columns name, so the cells
 * render names on the server rather than ids. Only collections this admin may
 * view; a failed read leaves the cells on the id.
 */
const preloadListContainers = async ({
  adminAccess,
  entry,
  queryClient,
  registry,
}: Pick<AdminScreenContext, "queryClient"> & {
  adminAccess: AdminAccessState;
  entry: RegisteredFrontendContentType;
  registry: ContentFrontendRegistry;
}): Promise<void> => {
  const { fields } = entry.definition;
  const reads = entry.definition.admin.list.columns.flatMap(name => {
    const descriptor = fields[name] as (typeof fields)[string] | undefined;
    if (descriptor?.kind !== "container") return [];

    const collection = registry.containers.byId(descriptor.definition.id);
    if (
      !collection ||
      !hasAdminPermission(adminAccess, {
        module: collection.definition.admin.permissionModule,
        permission: CONTENT_PERMISSIONS.view,
        plugin: collection.pluginId,
      })
    ) {
      return [];
    }

    return [
      queryClient
        .query({
          ...contentContainerListQuery({
            definitionId: collection.definition.id,
            target: contentContainerApiTarget(collection),
          }),
          staleTime: "static",
        })
        .catch(() => undefined),
    ];
  });

  await Promise.all(reads);
};

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
    // oxlint-disable-next-line typescript/only-throw-error
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
    queryClient.query({
      ...intlQueryOptions({ locale, namespaces }),
      staleTime: "static",
    }),
    listParams
      ? queryClient.query({
          ...contentListPageQuery({
            definition: entry.definition,
            locale,
            params: listParams,
            pluginId: entry.pluginId,
          }),
          staleTime: "static",
        })
      : undefined,
    listParams
      ? preloadListContainers({ adminAccess, entry, queryClient, registry })
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
