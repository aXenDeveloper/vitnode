import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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

import { ContentDataTable } from "@/components/table/content";
import { DataTableSkeleton } from "@/components/table/data-table-content";
import { DataTableNavigationProvider } from "@/components/table/navigation";
import {
  buildContentColumnSpec,
  CONTENT_PERMISSIONS,
  contentEditHref,
} from "@/content/index";
import { contentLabelsFrom } from "@/views/admin/views/content/content-labels";
import { contentBulkActions } from "@/views/admin/views/content/table/bulk-actions-model";
import {
  buildContentTableColumns,
  contentTableColumnCount,
  contentTableOrder,
  contentTableSearchEnabled,
} from "@/views/admin/views/content/table/columns";
import { contentListToolbarFilters } from "@/views/admin/views/content/table/list-filters";

import type { AdminTableNavigate } from "../table-search";
import type {
  ContentListParams,
  ContentListRouteSearch,
  UncheckedContentListSearch,
} from "./route-search";
import type { ContentDuplicatedRecord } from "./row-actions";

import { useLocale } from "../../i18n/locale";
import { useAdminPermission } from "../permissions";
import { ContentBulkActions } from "./bulk-actions";
import { ContentCreateAction } from "./create-action";
import { contentListPageQuery } from "./query";
import {
  contentListRouteParams,
  contentListSearchFrom,
  contentListSearchParams,
} from "./route-search";
import { ContentRowActions } from "./row-actions";
import { ContentFormDialogSlot } from "./slot-render";
import { contentAdminSlots } from "./slots";

/** What the list screen needs on top of the route data the loader returned. */
export interface ContentListScreenProps {
  contentTypeId: string;
  /** How a table control changes the URL - the Stage 7 seam. */
  navigate: AdminTableNavigate<ContentListRouteSearch>;

  params?: ContentListParams;
  /** This installation's content types, with their override components. */
  registry: ContentFrontendRegistry;
  /** The route's search, as the router hands it back on every navigation. */
  search: UncheckedContentListSearch;
}

interface ContentListTableProps extends Pick<
  ContentListScreenProps,
  "navigate" | "search"
> {
  columnSpecs: ContentColumnSpec[];
  entry: RegisteredFrontendContentType;
  labels: ContentLabels;
  params: ContentListParams;
}

const ContentListTable = ({
  columnSpecs,
  entry,
  labels,
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
  const canDelete = useAdminPermission({
    module: definition.permissionModule,
    permission: CONTENT_PERMISSIONS.delete,
    plugin: pluginId,
  });
  const canPublish = useAdminPermission({
    module: definition.permissionModule,
    permission: CONTENT_PERMISSIONS.publish,
    plugin: pluginId,
  });
  const routerNavigate = useNavigate();
  const [duplicated, setDuplicated] =
    React.useState<ContentDuplicatedRecord | null>(null);
  const formDialog = contentAdminSlots().FormDialog;
  const isNarrowed =
    Boolean(params.search) || Object.keys(params.filters).length > 0;
  const bulkActions = contentBulkActions({
    canDelete,
    canPublish,
    publication: definition.publication.enabled,
  });

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

  /**
   * A fresh copy opens where this content type edits: its own page, or the
   * edit dialog. Held here rather than in the row, because the refreshed list
   * may no longer contain the row the copy was made from.
   */
  const onDuplicated = React.useCallback(
    (copy: ContentDuplicatedRecord) => {
      if (definition.admin.edit.mode === "page") {
        void routerNavigate({
          // The AdminCP's hrefs are still number-typed; a serial id is one.
          to: contentEditHref(definition, copy.id as number),
        });

        return;
      }

      setDuplicated(copy);
    },
    [definition, routerNavigate],
  );

  const filters = React.useMemo(
    () =>
      contentListToolbarFilters(definition, {
        all: t("filters.all"),
        status: {
          draft: t("status.draft"),
          label: t("status.label"),
          published: t("status.published"),
        },
        visibility: {
          hidden: t("visibility.hidden"),
          label: t("visibility.label"),
          visible: t("visibility.visible"),
        },
      }),
    [definition, t],
  );

  const columns = React.useMemo(
    () =>
      buildContentTableColumns({
        columnSpecs,
        labels: {
          empty: t("table.empty_value"),
          status: {
            draft: t("status.draft"),
            ...(definition.visibility.enabled
              ? { hidden: t("visibility.hidden") }
              : {}),
            published: t("status.published"),
          },
        },
        registration,
        renderRowActions: (row: ContentRowData) => (
          <ContentRowActions
            entry={entry}
            labelField={labels.labelField}
            locale={locale}
            onDuplicated={onDuplicated}
            row={row}
            singular={labels.singular}
          />
        ),
      }),
    [
      columnSpecs,
      definition.visibility.enabled,
      entry,
      labels.labelField,
      labels.singular,
      locale,
      onDuplicated,
      registration,
      t,
    ],
  );

  return (
    <DataTableNavigationProvider value={navigation}>
      <ContentDataTable<ContentRowData>
        bulkActions={
          bulkActions.length > 0 ? (
            <ContentBulkActions
              actions={bulkActions}
              entry={entry}
              labels={labels}
              rows={data.edges}
            />
          ) : undefined
        }
        columns={columns}
        customNoResults={
          isNarrowed
            ? undefined
            : { description: t("empty.desc"), title: t("empty.title") }
        }
        edges={data.edges}
        filters={filters.length > 0 ? filters : undefined}
        id={`content-${definition.id}`}
        order={contentTableOrder(definition)}
        pageInfo={data.pageInfo}
        search={contentTableSearchEnabled(definition)}
      />

      {duplicated && formDialog ? (
        <ContentFormDialogSlot
          action="edit"
          dialog={formDialog}
          entry={entry}
          key={String(duplicated.id)}
          onOpenChange={open => {
            if (!open) setDuplicated(null);
          }}
          open
          row={{ labels: {}, ...duplicated.row }}
          singular={labels.singular}
          title={duplicated.title}
        >
          {null}
        </ContentFormDialogSlot>
      ) : null}
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
  registry,
  contentTypeId,
}: Pick<ContentListScreenProps, "contentTypeId" | "registry">) => {
  const entry = registry.byId(contentTypeId);
  const t = useTranslations() as unknown as ContentLabelTranslator;

  if (!entry) return null;

  return (
    <ContentCreateAction
      entry={entry}
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
 * heading rather than replacing the page. The fallback matches
 * `ContentTableView`'s column count and toolbar rule, and it is a boundary for
 * this screen, not a second global strategy.
 */
export const ContentListScreen = ({
  contentTypeId,
  navigate,
  params,
  registry,
  search,
}: ContentListScreenProps) => {
  const entry = registry.byId(contentTypeId);
  const t = useTranslations() as unknown as ContentLabelTranslator;
  // Memoised so the row actions' `labelField` keeps its identity, and the
  // table's columns are not rebuilt on every render of this screen.
  const labels = React.useMemo(
    () => (entry ? contentLabelsFrom(entry, t) : null),
    [entry, t],
  );

  // The loader already answered `notFound()` for an unresolvable path, so this
  // is unreachable in a mounted route - and it is what lets everything below
  // read a resolved entry rather than an optional one.
  if (!entry || !labels) return null;

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
          toolbar={
            contentTableSearchEnabled(entry.definition) ||
            entry.definition.publication.enabled
          }
        />
      }
    >
      <ContentListTable
        columnSpecs={columnSpecs}
        entry={entry}
        labels={labels}
        navigate={navigate}
        params={listParams}
        search={search}
      />
    </React.Suspense>
  );
};
