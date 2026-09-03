import { notFound } from "@tanstack/react-router";

import type { ContentFrontendRegistry } from "@/content/index";
import type { TranslationRow } from "@/views/admin/views/content/content-mutation";

import { CONTENT_PERMISSIONS } from "@/content/index";
import { isAdminRequestError } from "@/views/admin/admin-request";
import {
  contentItemQueryOptions,
  contentItemTitle,
  contentTranslationsQueryOptions,
} from "@/views/admin/views/content/form/item-query";

import type { AdminScreenContext } from "../../screen";
import type { ContentAdminRouteData } from "../route";

import { requireAdminPermission } from "../../screen";
import { contentApiTarget } from "../query";
import { contentPermissionFor } from "../route";
import { fetchContentItem, fetchContentTranslations } from "./transport";

/** What {@link loadContentFormScreen} adds to the route's own loader data. */
export interface ContentFormScreenData {
  formTitle?: string;
}

const missingContentRecord = (error: unknown): never => {
  if (
    isAdminRequestError(error) &&
    (error.status === 403 || error.status === 404)
  ) {
    // TanStack Router's own control-flow signal, answered by the host's
    // `notFoundComponent` - the same one `requireAdminPermission` throws.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw notFound();
  }

  throw error;
};

export const loadContentFormScreen = async ({
  adminAccess,
  locale,
  queryClient,
  registry,
  route,
}: AdminScreenContext & {
  registry: ContentFrontendRegistry;
  route: ContentAdminRouteData;
}): Promise<ContentFormScreenData> => {
  if (route.action === "list") return {};

  const entry = registry.byId(route.contentTypeId);
  // The route loader resolved this id from the same registry moments ago, so an
  // absent entry means the registry changed mid-navigation. Nothing to render.
  if (!entry) return {};

  requireAdminPermission(
    adminAccess,
    contentPermissionFor(
      entry,
      route.action === "create"
        ? CONTENT_PERMISSIONS.create
        : CONTENT_PERMISSIONS.edit,
    ),
  );

  if (route.action !== "edit" || route.itemId === undefined) return {};

  const request = {
    contentTypeId: entry.definition.id,
    itemId: route.itemId,
    target: contentApiTarget(entry.definition, entry.pluginId),
  };

  const [row, translations] = await Promise.all([
    queryClient.ensureQueryData({
      ...contentItemQueryOptions({ fetchItem: fetchContentItem, request }),
      revalidateIfStale: true,
    }),
    entry.definition.localization.enabled
      ? queryClient.ensureQueryData({
          ...contentTranslationsQueryOptions({
            fetchTranslations: fetchContentTranslations,
            request,
          }),
          revalidateIfStale: true,
        })
      : Promise.resolve<TranslationRow[]>([]),
  ]).catch(missingContentRecord);

  return {
    formTitle: contentItemTitle({
      definition: entry.definition,
      locale,
      row,
      translations,
    }),
  };
};
