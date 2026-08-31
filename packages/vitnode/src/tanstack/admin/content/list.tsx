"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";
import { useTranslations } from "use-intl";

import type { DataTableNavigation } from "@/components/table/navigation";
import type {
  ContentFrontendRegistry,
  RegisteredFrontendContentType,
} from "@/content/index";
import type { ContentColumnSpec } from "@/content/index";
import type { ContentLabelTranslator } from "@/content/index";
import type { ContentLabels } from "@/views/admin/views/content/content-labels";
import type { ContentRowData } from "@/views/admin/views/content/table/cells";
import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { ContentDataTable } from "@/components/table/content";
import { DataTableSkeleton } from "@/components/table/data-table-content";
import { DataTableNavigationProvider } from "@/components/table/navigation";
import { buildContentColumnSpec } from "@/content/index";
import { contentLabelsFrom } from "@/views/admin/views/content/content-labels";
import {
  buildContentTableColumns,
  contentTableColumnCount,
  contentTableOrder,
  contentTableSearchEnabled,
} from "@/views/admin/views/content/table/columns";

import type { AdminTableNavigate } from "../table-search";
import type {
  ContentListParams,
  ContentListRouteSearch,
  UncheckedContentListSearch,
} from "./route-search";

import { useLocale } from "../../i18n/locale";
import { ContentCreateAction } from "./create-action";
import { contentListPageQuery } from "./query";
import {
  contentListRouteParams,
  contentListSearchFrom,
  contentListSearchParams,
} from "./route-search";
import { ContentRowActions } from "./row-actions";

/**
 * `/admin/content/{path}` - one content type's records, for a TanStack Start
 * host.
 *
 * The same table the Next.js AdminCP renders, from the same specs: the columns
 * are `buildContentColumnSpec`'s, the cells are `ContentCell` or the plugin's
 * override, the actions are `row-actions-model`'s, and the URL contract is
 * `./route-search`'s. Nothing about the table was redesigned and nothing is
 * derived from a Zod schema here - a definition becomes a column spec in one
 * place, and both AdminCPs read that.
 *
 * What is genuinely this host's:
 *
 *     useSuspenseQuery         instead of an awaited server fetch
 *     DataTableNavigationProvider  instead of next-intl's locale-aware push
 *     browser writes + invalidation  instead of Server Actions + revalidatePath
 *
 * ## Labels are resolved here rather than carried from the loader
 *
 * `ContentLabels` is four strings and three *functions* - a field labeller, an
 * enum labeller and a section labeller, each of which reads a key assembled at
 * runtime. Functions do not survive a loader's serialization to the browser, so
 * they are rebuilt from the messages the route already warmed, through the same
 * `contentLabelsFrom` the Next.js screen uses. Nothing suspends doing it: the
 * loader warmed exactly the namespaces `RouteMessages` mounts.
 */

/** What the list screen needs on top of the route data the loader returned. */
export interface ContentListScreenProps {
  contentTypeId: string;
  /** How a path becomes a navigation. Defaults to the router's own link. */
  LinkComponent?: AuthLinkComponent;
  /** How a table control changes the URL - the Stage 7 seam. */
  navigate: AdminTableNavigate<ContentListRouteSearch>;
  /**
   * The normalised URL contract, as the loader computed it.
   *
   * Optional, and derived from the same `contentListRouteParams` when absent -
   * so the key this screen reads is the key the loader warmed whether or not the
   * loader data carried it.
   */
  params?: ContentListParams;
  /** This installation's content types, with their override components. */
  registry: ContentFrontendRegistry;
  /** The route's search, as the router hands it back on every navigation. */
  search: UncheckedContentListSearch;
}

interface ContentListTableProps extends Pick<
  ContentListScreenProps,
  "LinkComponent" | "navigate" | "search"
> {
  columnSpecs: ContentColumnSpec[];
  entry: RegisteredFrontendContentType;
  labels: ContentLabels;
  params: ContentListParams;
}

/**
 * The table itself - the one component that suspends.
 *
 * `useSuspenseQuery` over the identical options the loader ensured, so on the
 * first paint the rows are there. A later *refetch* does not suspend either: the
 * previous page stays on screen while an invalidated entry refreshes, which is
 * what keeps a delete from blanking the table under the dialog that is still
 * open.
 *
 * A failed read is left to reject. The query throws an `AdminRequestError`
 * rather than resolving to an empty page, and the route's error boundary owns
 * the screen from there - because a table with no rows is what a content type
 * nobody has written in looks like, and those two must never be confusable.
 */
const ContentListTable = ({
  columnSpecs,
  entry,
  labels,
  LinkComponent,
  navigate,
  params,
  search,
}: ContentListTableProps) => {
  const { definition, pluginId, registration } = entry;
  const t = useTranslations("core.content");
  const locale = useLocale();
  const { data } = useSuspenseQuery(
    contentListPageQuery({ definition, locale, params, pluginId }),
  );

  /**
   * The Stage 7 seam, and the whole of what this screen tells the table about
   * navigation: where it is, and how to get somewhere else. No pathname - with
   * no destination the router stays on this route and changes only its search,
   * which is all a pager, a sort header, a search box or a filter ever does.
   *
   * `contentListSearchFrom` re-validates what the control wrote against this
   * content type's own contract, so a control cannot produce a sort column the
   * definition does not have.
   */
  const navigation = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: async nextSearch => {
        await navigate({
          resetScroll: false,
          search: contentListSearchFrom(nextSearch, definition),
        });
      },
      searchParams: contentListSearchParams(search, definition),
    }),
    [definition, navigate, search],
  );

  const columns = React.useMemo(
    () =>
      buildContentTableColumns({
        columnSpecs,
        labels: {
          empty: t("table.empty_value"),
          missing: t("translations.states.missing"),
          status: {
            draft: t("status.draft"),
            published: t("status.published"),
          },
        },
        registration,
        renderRowActions: (row: ContentRowData) => (
          <ContentRowActions
            entry={entry}
            LinkComponent={LinkComponent}
            locale={locale}
            row={row}
            singular={labels.singular}
          />
        ),
      }),
    [
      columnSpecs,
      entry,
      labels.singular,
      LinkComponent,
      locale,
      registration,
      t,
    ],
  );

  return (
    <DataTableNavigationProvider value={navigation}>
      <ContentDataTable<ContentRowData>
        columns={columns}
        customNoResults={{
          description: t("empty.desc"),
          title: t("empty.title"),
        }}
        edges={data.edges}
        id={`content-${definition.id}`}
        order={contentTableOrder(definition)}
        pageInfo={data.pageInfo}
        search={contentTableSearchEnabled(definition)}
      />
    </DataTableNavigationProvider>
  );
};

/**
 * The create button, for the shell's heading.
 *
 * Separate from the table so it renders while the rows are still arriving - the
 * one control on this screen that does not depend on them.
 */
export const ContentListActions = ({
  LinkComponent,
  registry,
  contentTypeId,
}: Pick<
  ContentListScreenProps,
  "contentTypeId" | "LinkComponent" | "registry"
>) => {
  const entry = registry.byId(contentTypeId);
  const t = useTranslations() as unknown as ContentLabelTranslator;

  if (!entry) return null;

  return (
    <ContentCreateAction
      entry={entry}
      LinkComponent={LinkComponent}
      singular={contentLabelsFrom(entry, t).singular}
    />
  );
};

/**
 * The list, with its own loading boundary.
 *
 * The boundary is here rather than around the whole screen on purpose: the
 * heading, the breadcrumb and the create button are known before any request,
 * so a list that is still loading shows a table-shaped skeleton under a real
 * heading rather than replacing the page. It is the same
 * `<Suspense fallback={<DataTableSkeleton …>}>` the Next.js page wraps
 * `ContentTableView` in, with the same column count and the same toolbar rule -
 * and it is a boundary for this screen, not a second global strategy.
 */
export const ContentListScreen = ({
  contentTypeId,
  LinkComponent,
  navigate,
  params,
  registry,
  search,
}: ContentListScreenProps) => {
  const entry = registry.byId(contentTypeId);
  const t = useTranslations() as unknown as ContentLabelTranslator;

  // The loader already answered `notFound()` for an unresolvable path, so this
  // is unreachable in a mounted route - and it is what lets everything below
  // read a resolved entry rather than an optional one.
  if (!entry) return null;

  const labels = contentLabelsFrom(entry, t);
  /**
   * The loader's parameters, or the same arithmetic run again.
   *
   * `contentListRouteParams` is total and idempotent, so re-running it on the
   * search the loader was given produces the identical request - which is what
   * makes the fallback a guarantee rather than a guess.
   */
  const listParams = params ?? contentListRouteParams(search, entry.definition);
  const columnSpecs = buildContentColumnSpec({
    definition: entry.definition,
    labelEnum: labels.labelEnum,
    labelField: labels.labelField,
  });

  return (
    <React.Suspense
      fallback={
        <DataTableSkeleton
          columns={contentTableColumnCount(columnSpecs)}
          toolbar={contentTableSearchEnabled(entry.definition)}
        />
      }
    >
      <ContentListTable
        columnSpecs={columnSpecs}
        entry={entry}
        labels={labels}
        LinkComponent={LinkComponent}
        navigate={navigate}
        params={listParams}
        search={search}
      />
    </React.Suspense>
  );
};
