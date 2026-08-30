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

/**
 * `/admin/content/*` - the Content Engine, as everything a TanStack Start route
 * needs and nothing a route owns.
 *
 * One splat serves three screens, exactly as the Next.js catch-all does, and for
 * the same reason: a plugin adds a content type without adding a file. Which
 * screen a URL is asking for is decided by `resolveContentAdminRoute`, the pure
 * resolver `content/admin/route.ts` has always used - imported, not
 * reimplemented. There is no second slug parser in this package and there must
 * not be one: the exact-match-first rule and the page-mode gates are subtle
 * enough that a second reading of them would diverge silently.
 */

/**
 * The splat, as the resolver reads it.
 *
 * TanStack hands `params._splat` as the matched remainder - `"blog/articles"`,
 * or `undefined` when the splat matched nothing at all. The resolver takes the
 * segments, so this is the whole of the conversion, and the two filters matter:
 * an empty segment (`//`, a trailing slash) is not a path segment, and an empty
 * splat is not `[""]`.
 *
 * The resolver already answers `undefined` for an empty array, so
 * `/admin/content` with nothing after it is a not-found rather than a list of
 * every content type. That is deliberate - there is no index screen, and
 * inventing one here would be a URL the Next.js AdminCP never served.
 */
export const contentRouteSegments = (splat: string | undefined): string[] =>
  (splat ?? "").split("/").filter(segment => segment !== "");

/** What a content URL resolved to: which screen, and which content type. */
export interface ContentAdminScreen {
  action: ContentAdminAction;
  entry: RegisteredFrontendContentType;
  /** The record being edited. Only ever set for `edit`. */
  itemId?: number;
}

/**
 * The splat, resolved against this installation's registry, or `undefined`.
 *
 * Two lookups, and they are deliberately different: the resolver is keyed by
 * `admin.path` - the URL's own name for a content type - and the entry is then
 * fetched by the id it returned. A content type is free to make those disagree
 * (`blog.post` answering at `blog/articles`), which is exactly why the registry
 * exposes both and why nothing here derives one from the other.
 */
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
  /**
   * The content type's nouns, and only those.
   *
   * `ContentRouteLabels` rather than `ContentLabels`, because everything
   * returned from here is serialized into the SSR payload - see the note on
   * that type. The screens that need a field, enum or section labeller build
   * their own from the messages this loader warmed.
   */
  labels: ContentRouteLabels;
  /**
   * The normalised list request, for the `list` screen only.
   *
   * Returned rather than recomputed in the component so the entry the loader
   * warmed and the entry the table reads back are the same key by construction.
   * Plain strings, so it survives the loader's serialization to the browser.
   */
  listParams?: ContentListParams;
  namespaces: string[];
  pluginId: string;
  title: string;
}

/**
 * Everything the screen needs to know *which* screen it is, before it renders.
 *
 * Four steps, in this order, and the order is the point:
 *
 * 1. **Resolve.** An unresolvable URL is the AdminCP's not-found. Never a
 *    redirect to a neighbouring content type - a mistyped path that quietly
 *    opened somebody else's records would be far worse than a 404.
 * 2. **Permit.** `can_view` on this content type's own module, checked before
 *    any request is sent, so an administrator who may not open the screen never
 *    provokes a refusal the API would issue anyway. The tuple is read off the
 *    definition rather than assembled from the id: `admin.permissionModule` may
 *    differ from the entity name, and guessing it would check a permission that
 *    does not exist - which grants nothing and denies nothing.
 * 3. **Warm the strings**, for exactly the two namespaces this content type
 *    renders from.
 * 4. **Resolve the labels** from those strings, through the one label resolver
 *    both AdminCPs use.
 *
 * 5. **Warm the list**, but only when this URL *is* a list. The two form
 *    screens read a record rather than a page, so fetching one for them would
 *    cost a request on every navigation for no paint. It is warmed with the
 *    identical options `ContentListScreen` reads back - `contentListPageQuery`
 *    from the parameters returned below - which is the only way the first paint
 *    is free rather than a round trip late.
 *
 * A refused or unreachable list rejects here rather than resolving to an empty
 * page, and the route's error boundary owns the screen. That is deliberate: a
 * table with no rows is what a content type nobody has written in looks like,
 * and an operational failure must never be dressed as one.
 */
export const loadContentAdminRoute = async ({
  adminAccess,
  locale,
  queryClient,
  registry,
  search,
  segments,
}: AdminScreenContext & {
  registry: ContentFrontendRegistry;
  /**
   * The route's search, as the router parsed it.
   *
   * Unvalidated on purpose. `validateSearch` is handed the query string alone -
   * never the path params - so it cannot know which content type this URL is
   * for, and the contract it would have to check against is a function of that
   * content type's sortable columns and filters. So the URL is normalised
   * *here*, where the definition has just been resolved, through the same
   * `contentListRouteParams` the table's own controls go back through.
   */
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

  /**
   * A translator over the whole warmed record rather than a namespaced one.
   *
   * Every key the label resolver reads is assembled at runtime from the content
   * type id and spans both namespaces - `core.content.*` and
   * `{pluginId}.content.{entity}.*` - so a namespaced translator could not reach
   * them. The cast is the one `ContentLabelTranslator` exists for: `use-intl`
   * types its keys as a union of every message in the catalogue, which a runtime
   * key cannot satisfy, and `has` is what keeps it honest.
   */
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
