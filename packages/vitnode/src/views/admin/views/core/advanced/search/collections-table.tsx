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
  getCollectionStatus,
} from "./collection-status";
import { ReindexCollectionAction } from "./reindex-action";

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
};

export const CollectionsTable = async ({
  collections,
  search,
}: {
  collections: SearchCollection[];
  search?: string;
}) => {
  const t = await getTranslations("core.search");

  const rows: CollectionRow[] = collections
    .map((collection, index) => ({
      ...collection,
      id: index,
      label: t(getSearchTypeRenderer(collection.itemType).labelKey),
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
          <span className="text-muted-foreground"> / {row.total}</span>
        </span>
      ),
    },
    {
      id: "coverage",
      header: t("admin.collections.columns.coverage"),
      className: "w-52",
      cell: ({ row }) => {
        const coverage = getCollectionCoverage(row);
        const styles = statusStyles[getCollectionStatus(row)];

        return (
          <div className="flex items-center gap-3">
            <div className="bg-muted h-1.5 w-full max-w-40 overflow-hidden rounded-full">
              <div
                className={cn("h-full rounded-full", styles.bar)}
                style={{ width: `${coverage}%` }}
              />
            </div>
            <span className="text-muted-foreground w-9 shrink-0 text-end text-sm tabular-nums">
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
      cell: ({ row }) => (
        <ReindexCollectionAction itemType={row.itemType} label={row.label} />
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
