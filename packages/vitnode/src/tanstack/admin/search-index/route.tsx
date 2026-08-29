"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";
import { createTranslator } from "use-intl";

import type { DataTableNavigation } from "@/components/table/navigation";

import { DataTableNavigationProvider } from "@/components/table/navigation";
import { HeaderContent } from "@/components/ui/header-content";
import { SearchHeaderActions } from "@/views/admin/views/core/advanced/search/search-header-actions";
import { SearchIndexContent } from "@/views/admin/views/core/advanced/search/search-index-content";

import type { AdminScreenContext } from "../screen";
import type { AdminTableNavigate } from "../table-search";
import type {
  SearchIndexRouteSearch,
  UncheckedSearchIndexSearch,
} from "./route-search";

import { intlQueryOptions } from "../../i18n/query";
import { RouteMessages } from "../../i18n/route-messages";
import { requireAdminPermission } from "../screen";
import { searchIndexQuery, useSearchIndexActions } from "./query";
import { searchIndexSearchFrom, searchIndexSearchParams } from "./route-search";

/**
 * `/admin/core/advanced/search`, as everything a TanStack Start route needs and
 * nothing a route owns.
 */

/**
 * What this screen renders strings from.
 *
 * `core.search` and not an `admin.*` namespace, which looks wrong and is not:
 * the search index's AdminCP copy lives under `core.search.admin.*`, beside the
 * public feed's, because the collection labels and the result-type names are the
 * same strings on both surfaces. The Next.js page declares the identical
 * `<I18nProvider namespaces="core.search">`.
 *
 * `core.global` is the table chrome - the search placeholder, the confirm
 * dialog's buttons and the error toasts.
 */
export const ADMIN_SEARCH_INDEX_NAMESPACES = [
  "core.global",
  "core.search",
] as const;

/** What {@link loadAdminSearchIndexRoute} returns - and what `head` receives. */
export interface AdminSearchIndexRouteData {
  description: string;
  title: string;
}

/**
 * The tuple `<AdminPermissionRequired module="system" permission="can_view">`
 * states in the Next.js page, and the one every `/admin/debug/search/*` route
 * declares - the status read and both mutations.
 */
const SEARCH_INDEX_PERMISSION = {
  module: "system",
  permission: "can_view",
} as const;

/**
 * Both reads this screen needs, in parallel, before it renders.
 *
 * The permission is checked first, so an administrator who may not open the
 * screen never sends a request the API is going to refuse.
 *
 * A refusal is left to propagate rather than caught. This screen's whole job is
 * to say whether search is healthy; a failed read rendered as "unhealthy, zero
 * documents" would be a false alarm, and rendered as "healthy" would be a lie.
 */
export const loadAdminSearchIndexRoute = async ({
  adminAccess,
  locale,
  queryClient,
}: AdminScreenContext): Promise<AdminSearchIndexRouteData> => {
  requireAdminPermission(adminAccess, SEARCH_INDEX_PERMISSION);

  const [intl] = await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: ADMIN_SEARCH_INDEX_NAMESPACES }),
    ),
    queryClient.ensureQueryData(searchIndexQuery()),
  ]);

  const t = createTranslator({
    locale,
    messages: intl.messages as {
      core: { search: { admin: { desc: string; title: string } } };
    },
    namespace: "core.search.admin",
  });

  return { description: t("desc"), title: t("title") };
};

export interface AdminSearchIndexRouteProps extends AdminSearchIndexRouteData {
  /**
   * Names for the collections a Content Engine content type contributes.
   *
   * Optional, and absent in Stage 12. They come from the *frontend* content-type
   * registry, which is server-side config: the Next.js page reads it directly,
   * and a TanStack Start host can only pass them once it has a browser-side
   * registry - the same seam `AdminShellContent`'s `declarations` prop is
   * waiting on. Without them a content collection falls back to the search
   * renderer's own label, and its `itemType` is still shown, so nothing is
   * hidden - it is named less well.
   */
  collectionLabels?: Map<string, string>;
  navigate: AdminTableNavigate<SearchIndexRouteSearch>;
  search: UncheckedSearchIndexSearch;
}

/**
 * `/admin/core/advanced/search`, as everything below a route file's `component`.
 *
 * The header's "rebuild everything" button and the two row actions share one
 * `actions` object, so all three refresh the same way: a query invalidation on
 * success. `useSearchIndexActions` is the TanStack half of the pair whose other
 * half is `useSearchIndexActionsNext`.
 */
export const AdminSearchIndexRouteContent = ({
  collectionLabels,
  description,
  navigate,
  search,
  title,
}: AdminSearchIndexRouteProps) => {
  const { data } = useSuspenseQuery(searchIndexQuery());
  const actions = useSearchIndexActions();

  const navigation = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: async nextSearch => {
        await navigate({
          resetScroll: false,
          search: searchIndexSearchFrom(nextSearch),
        });
      },
      searchParams: searchIndexSearchParams(search),
    }),
    [navigate, search],
  );

  return (
    <RouteMessages namespaces={ADMIN_SEARCH_INDEX_NAMESPACES}>
      <div className="p-4">
        <HeaderContent desc={description} h1={title}>
          <SearchHeaderActions onRebuild={actions.rebuild} />
        </HeaderContent>

        <DataTableNavigationProvider value={navigation}>
          <SearchIndexContent
            actions={actions}
            data={data}
            labels={collectionLabels}
            search={
              typeof search.search === "string" ? search.search : undefined
            }
          />
        </DataTableNavigationProvider>
      </div>
    </RouteMessages>
  );
};
