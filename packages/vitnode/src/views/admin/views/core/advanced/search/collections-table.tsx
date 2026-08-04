import { getTranslations } from "next-intl/server";

import type { ColumnDef } from "@/components/table/data-table";

import { DateFormat } from "@/components/date-format";
import { DataTable } from "@/components/table/data-table";
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

import {
  getCollectionCoverage,
  getCollectionCoverageBar,
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
  orphaned: {
    bar: "bg-destructive",
    dot: "bg-destructive",
    text: "text-destructive",
  },
};

export const CollectionsTable = async ({
  collections,
  labels,
  search,
}: {
  collections: SearchCollection[];
  /** Content type id -> label, for collections the renderer registry has no entry for. */
  labels?: Map<string, string>;
  search?: string;
}) => {
  const t = await getTranslations("core.search");

  const rows: CollectionRow[] = collections
    .map((collection, index) => ({
      ...collection,
      id: index,
      label:
        labels?.get(collection.itemType) ??
        t(getSearchTypeRenderer(collection.itemType).labelKey),
    }))
    .sort((a, b) => b.indexed - a.indexed || a.label.localeCompare(b.label));

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
            </div>
          </div>
        );
      },
    },
    {
      id: "items",
      header: t("admin.collections.columns.items"),
      cell: ({ row }) => (
        <span className="tabular-nums">
          <span className="text-foreground font-medium">{row.indexed}</span>
          {/* An em dash, not `indexed`: with no indexer there is no source count
              to compare against, and repeating the left number would read as
              full coverage. */}
          <span className="text-muted-foreground"> / {row.total ?? "—"}</span>
        </span>
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
                // Clamped, so an over-indexed collection cannot draw past the
                // track. The number beside it stays the measured one.
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
          <ReindexCollectionAction itemType={row.itemType} label={row.label} />
        ) : (
          // Rebuilding this would clear it and refill nothing, so the only offer
          // is the honest one: remove the documents.
          <RemoveCollectionDocumentsAction
            itemType={row.itemType}
            label={row.label}
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
        <DataTable<CollectionRow>
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
