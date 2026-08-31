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

/**
 * `/admin/content/{type}/create` and `/admin/content/{type}/edit/{id}` - the
 * page-mode form screens, for a TanStack Start host.
 *
 * The direct counterpart of `page/page-views.tsx`, which is the Next.js pair of
 * Server Components. The screen itself is the same component in both -
 * `ContentFormPage` - handed the same props; what differs is where those props
 * come from, and that is all this module is.
 *
 *     Next.js                         here
 *     -------------------------------------------------------------------
 *     checkAdminPermissionApi   →     requireAdminPermission, in the loader
 *     contentApiFetch (server)  →     two query entries, warmed in the loader
 *     getTranslations           →     the warmed intl entry, through ./spec
 *     notFound() on a missing   →     notFound(), via missingContentRecord
 *     notFound() on a failed read →   the read rejects, the boundary answers
 */

/** What {@link loadContentFormScreen} adds to the route's own loader data. */
export interface ContentFormScreenData {
  /**
   * The record's resolved title - `edit` only.
   *
   * Computed in the loader rather than in the component because it is the same
   * value the heading, the browser tab and every toast use, and because
   * resolving it means reading a localized title out of the right translation -
   * a decision that must be made once.
   */
  formTitle?: string;
}

/**
 * A record that is gone, told apart from an API that is broken.
 *
 * `/admin/content/blog/articles/999999/edit` addresses a record nobody deleted
 * because nobody ever created it, and that is a 404 rather than a failure: the
 * Next.js `ContentEditPageView` answers it with `notFound()`, so an
 * administrator who follows a stale link lands on the AdminCP's own not-found
 * inside the panel. Letting the read simply reject would have shown them an
 * error screen for a URL that is merely wrong, which is a different sentence.
 *
 * Only two statuses are read that way, and the narrowness is the whole point:
 *
 *     404   the record is not there
 *     403   the API will not show it to this administrator
 *
 * A 403 is the *authorization* answer rather than the route guard's - the guard
 * decides on a cached permission set, and a permission revoked mid-session
 * arrives here instead. `requireAdminPermission` above answers that case with
 * `notFound()` too, so both readings of "you may not open this" produce one
 * screen.
 *
 * Everything else rethrows, and it has to: a 429 from the rate limiter, a 500,
 * an API that is not listening and a schema mismatch between the installed
 * plugin and the running API are all operational failures, and dressing one of
 * them as "no such record" would hide an outage behind a 404 nobody
 * investigates. That is the one place this deliberately does not copy the
 * Next.js view, which turns every non-200 into `notFound()`.
 */
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

/**
 * The permission this screen needs, and the record it opens on.
 *
 * Called by the host route's loader **after** `loadContentAdminRoute`, which has
 * already resolved the content type and checked `can_view`. Three things happen
 * here and only here:
 *
 * 1. **`can_create` / `can_edit`.** `can_view` opens the list; it does not open
 *    a form. The Next.js page views check exactly these two and answer
 *    `notFound()`, and `requireAdminPermission` produces the same 404 one
 *    navigation earlier - before any request is sent, so an administrator who
 *    may not edit never provokes a refusal the API would issue anyway.
 * 2. **The record and its translations**, warmed with the identical options the
 *    screen reads back, so the edit form is populated in the first paint rather
 *    than a round trip later. A create screen warms nothing: there is no record.
 * 3. **The title**, from the two.
 *
 * A `list` URL passes straight through. This runs on every content navigation,
 * so it has to be free for the screen it is not for.
 *
 * A read that fails rejects rather than resolving empty, and the route's error
 * boundary owns the screen. An edit form rendered over a record that could not
 * be read would show blank fields and write them back on the first save.
 *
 * The one exception is {@link missingContentRecord} - see below.
 */
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
