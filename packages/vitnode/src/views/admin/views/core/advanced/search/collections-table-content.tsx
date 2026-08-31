"use client";

import { useTranslations } from "use-intl";

import type { ColumnDef } from "@/components/table/data-table-content";

import { DateFormat } from "@/components/date-format";
import { ContentDataTable } from "@/components/table/content";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getSearchTypeRenderer } from "@/views/search/registry";

import type { CollectionStatus, SearchCollection } from "./collection-status";
import type { SearchIndexActions } from "./search-index-mutations";

import {
  getCollectionCoverage,
  getCollectionCoverageBar,
  getCollectionIndexedCount,
  getCollectionStatus,
} from "./collection-status";
import { ReindexCollectionAction } from "./reindex-action";
import { RemoveCollectionDocumentsAction } from "./remove-documents-action";

interface CollectionRow extends SearchCollection {
  id: number;
  label: string;
}

const statusStyles: Record<
  CollectionStatus,
  { bar: string; dot: string; text: string }
> = {
  indexed: {
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  stale: {
    bar: "bg-amber-500",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  empty: {
    bar: "bg-muted-foreground/30",
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
  },
  unmanaged: {
    bar: "bg-destructive",
    dot: "bg-destructive",
    text: "text-destructive",
  },
};

/**
 * Every collection in the search index, as a table both frameworks render.
 *
 * Was a Server Component; the fetch and the translator have been lifted out, and
 * the two row actions arrive as `actions` rather than importing server actions
 * directly. Nothing else about it changed - the same four columns, the same
 * coverage bar, the same client-side filtering.
 *
 * `search` is the table's own search box, and it filters *in this component*
 * rather than in a request: the whole collection list arrives in one status read
 * (there are as many rows as there are content types), so paging or querying the
 * API for it would be a round trip to filter a list already on screen. That is
 * why the `pageInfo` below is synthesised - the table is a renderer here, not a
 * pager.
 */
export const CollectionsTableContent = ({
  actions,
  collections,
  labels,
  search,
}: {
  actions: SearchIndexActions;
  collections: SearchCollection[];
  labels?: Map<string, string>;
  search?: string;
}) => {
  const t = useTranslations("core.search");

  const rows: CollectionRow[] = collections
    .map((collection, index) => ({
      ...collection,
      id: index,
      label:
        labels?.get(collection.itemType) ??
        t(getSearchTypeRenderer(collection.itemType).labelKey),
    }))
    .sort(
      (a, b) =>
        getCollectionIndexedCount(b) - getCollectionIndexedCount(a) ||
        a.label.localeCompare(b.label),
    );

  const term = search?.trim().toLowerCase();
  const edges = term
    ? rows.filter(
        row =>
          row.label.toLowerCase().includes(term) ||
          row.itemType.toLowerCase().includes(term),
      )
    : rows;

  const columns: ColumnDef<CollectionRow>[] = [
    {
      accessorKey: "itemType",
      header: t("admin.collections.columns.collection"),
      cell: ({ row }) => {
        const Icon = getSearchTypeRenderer(row.itemType).icon;
        const status = getCollectionStatus(row);
        const styles = statusStyles[status];

        return (
          <div className="flex items-center gap-3">
            <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Icon aria-hidden className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-foreground truncate font-medium">
                {row.label}
              </p>
              <span
                className={cn("flex items-center gap-1.5 text-xs", styles.text)}
              >
                <span className={cn("size-1.5 rounded-full", styles.dot)} />
                {t(`admin.collections.status.${status}`)}
                <span className="text-muted-foreground truncate">
                  <span aria-hidden>· </span>
                  {row.pluginId}
                </span>
              </span>
              {status === "unmanaged" && (
                <p className="text-muted-foreground text-xs text-pretty">
                  {t("admin.collections.noIndexerDesc")}
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: "items",
      header: t("admin.collections.columns.items"),
      cell: ({ row }) => (
        <div className="tabular-nums">
          <span className="text-foreground font-medium">
            {getCollectionIndexedCount(row)}
          </span>
          <span className="text-muted-foreground"> / {row.total ?? "—"}</span>
          {row.languages.length > 0 && (
            <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 text-xs">
              {row.languages.map(language => (
                <span key={language.languageCode}>
                  {language.languageCode} {language.documents}
                </span>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "coverage",
      header: t("admin.collections.columns.coverage"),
      className: "w-52",
      cell: ({ row }) => {
        const coverage = getCollectionCoverage(row);
        const bar = getCollectionCoverageBar(row);
        const styles = statusStyles[getCollectionStatus(row)];

        if (coverage === null || bar === null) {
          return (
            <span className="text-muted-foreground text-sm">
              {t("admin.collections.noIndexer")}
            </span>
          );
        }

        return (
          <div className="flex items-center gap-3">
            <div className="bg-muted h-1.5 w-full max-w-40 overflow-hidden rounded-full">
              <div
                className={cn("h-full rounded-full", styles.bar)}
                style={{ width: `${bar}%` }}
              />
            </div>
            <span className="text-muted-foreground w-12 shrink-0 text-end text-sm tabular-nums">
              {coverage}%
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "lastIndexedAt",
      header: t("admin.collections.columns.lastIndexed"),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {row.lastIndexedAt ? (
            <DateFormat date={row.lastIndexedAt} />
          ) : (
            t("admin.never")
          )}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: ({ row }) =>
        row.hasIndexer ? (
          <ReindexCollectionAction
            itemType={row.itemType}
            label={row.label}
            onRebuild={actions.rebuild}
          />
        ) : (
          <RemoveCollectionDocumentsAction
            itemType={row.itemType}
            label={row.label}
            onClear={actions.clearCollection}
          />
        ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.collections.title")}</CardTitle>
        <CardDescription>{t("admin.collections.desc")}</CardDescription>
        <CardAction className="text-muted-foreground self-center text-sm tabular-nums">
          {t("admin.collections.count", {
            shown: edges.length,
            total: collections.length,
          })}
        </CardAction>
      </CardHeader>
      <CardContent>
        <ContentDataTable<CollectionRow>
          columns={columns}
          customNoResults={{
            title: t("admin.collections.empty"),
            description: t("admin.collections.emptyDesc"),
          }}
          edges={edges}
          id="collections-table"
          order={{ defaultOrder: { column: "itemType", order: "asc" } }}
          pageInfo={{
            count: edges.length,
            endCursor: null,
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            totalCount: collections.length,
          }}
          search
          searchPlaceholder={t("admin.collections.searchPlaceholder")}
        />
      </CardContent>
    </Card>
  );
};
