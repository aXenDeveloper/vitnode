import { cn } from "cn";
import React from "react";

import type { ExpandableDataTable } from "./expansion";
import type { FilterDataTable } from "./filters";
import type { GroupByDataTable } from "./group";
import type { PaginationDataTable } from "./pagination";
import type { ReorderableDataTable } from "./reorder";
import type { SearchDataTable } from "./search";

import { Skeleton } from "../ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

export type DataTableRowId = number | string;

export interface DataTableTMin {
  id: DataTableRowId;
}

export interface SearchParamsDataTable<T = unknown> {
  cursor?: string;
  first?: string;
  last?: string;
  order?: "asc" | "desc";
  orderBy?: keyof T;
}

export type AlignDataTable = "center" | "left" | "right";

interface ColumnDefBase<T extends DataTableTMin> {
  align?: AlignDataTable;
  /** Renders the cell. Defaults to the `accessorKey` value. */
  cell?: (data: { allData: T[]; row: T }) => React.ReactNode;
  className?: string;
  header: React.ReactNode;
}

interface AccessorColumnDef<T extends DataTableTMin> extends ColumnDefBase<T> {
  /** The row key the column shows, and sorts by when listed in `order.columns`. */
  accessorKey: keyof T;
  id?: string;
}

interface DisplayColumnDef<T extends DataTableTMin> extends ColumnDefBase<T> {
  accessorKey?: never;
  id: string;
}

/** One column of a `ContentDataTable`: bound to a row key, or a display column with its own `id`. */
export type ColumnDef<T extends DataTableTMin> =
  | AccessorColumnDef<T>
  | DisplayColumnDef<T>;

/** What `ContentDataTable` accepts. */
export type DataTableProps<T extends DataTableTMin> = Omit<
  React.ComponentProps<typeof Table>,
  "columns"
> &
  React.ComponentProps<typeof PaginationDataTable> &
  React.ComponentProps<typeof SearchDataTable> & {
    /** Adds a checkbox per row and shows these actions while rows are selected. */
    bulkActions?: React.ReactNode;
    columns?: ColumnDef<T>[];
    /** Replaces the default empty state. */
    customNoResults?: {
      description?: string;
      footer?: React.ReactNode;
      icon?: React.ReactNode;
      title?: string;
    };
    /** The rows of the current page. */
    edges: T[];
    expandable?: ExpandableDataTable<T>;
    /** Faceted filters in the toolbar, kept in the URL. */
    filters?: FilterDataTable[];
    groupBy?: GroupByDataTable<T>;
    /** A band above the table, e.g. a count or an action button. */
    header?: React.ReactNode;
    id: string;
    order: {
      /** The columns a header click sorts by. */
      columns?: (keyof T)[];
      /** The sort used while the URL names none. */
      defaultOrder: {
        column: keyof T;
        order: "asc" | "desc";
      };
    };
    /** Renders each row as one full-width cell instead of `columns`. */
    renderRow?: (data: { allData: T[]; row: T }) => React.ReactNode;
    /** Lets rows be dragged into a new order. */
    reorderable?: ReorderableDataTable<T>;
    /**
     * Makes a whole row clickable (and Enter/Space-activatable); clicks on
     * controls inside it are ignored. Ignored when `bulkActions` is set.
     */
    rowOpens?: (row: T) => void;
    /** Shows a search box in the toolbar, kept in the URL. */
    search?: boolean;
  };

const SKELETON_HEAD_WIDTHS = ["w-24", "w-16", "w-20", "w-14"];
const SKELETON_CELL_WIDTHS = ["w-full", "w-3/4", "w-1/2", "w-5/6", "w-2/3"];

/** A loading placeholder shaped like a `ContentDataTable`, for `Suspense` fallbacks. */
export const DataTableSkeleton = ({
  columns,
  header = false,
  rows = 6,
  toolbar = false,
}: {
  columns: number;
  header?: boolean;
  rows?: number;
  toolbar?: boolean;
}) => {
  const headerIds = Array.from({ length: columns }, (_, i) => `s-head-${i}`);
  const rowIds = Array.from({ length: rows }, (_, i) => `s-row-${i}`);

  return (
    // The surface the table settles into, band for band — see `ContentDataTable`.
    <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl shadow-xs ring-1">
      {header && (
        <div className="border-foreground/10 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-40" />
        </div>
      )}

      {toolbar && (
        <div className="border-foreground/10 flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <Skeleton className="h-9 min-w-0 flex-1" />
          <Skeleton className="h-9 w-24" />
        </div>
      )}

      <div>
        <Table
          className={cn(
            "min-w-full [&_td]:px-3 [&_td]:py-3 [&_th]:px-3",
            "[&_td:first-child]:pl-4 sm:[&_td:first-child]:pl-6 [&_th:first-child]:pl-4 sm:[&_th:first-child]:pl-6",
            "[&_td:last-child]:pr-4 sm:[&_td:last-child]:pr-6 [&_th:last-child]:pr-4 sm:[&_th:last-child]:pr-6",
          )}
        >
          <TableHeader className="bg-muted/60">
            <TableRow>
              {headerIds.map((hid, i) => (
                <TableHead key={hid}>
                  <Skeleton
                    className={cn(
                      "h-4",
                      SKELETON_HEAD_WIDTHS[i % SKELETON_HEAD_WIDTHS.length],
                    )}
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowIds.map((rid, i) => (
              <TableRow className="h-9" key={rid}>
                {headerIds.map((hid, j) => (
                  <TableCell key={`${rid}-${hid}`}>
                    <Skeleton
                      className={cn(
                        "h-4",
                        SKELETON_CELL_WIDTHS[
                          (i + j) % SKELETON_CELL_WIDTHS.length
                        ],
                      )}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="border-foreground/10 flex w-full flex-col gap-4 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex h-5 items-center">
          <Skeleton className="h-4 w-40" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 sm:justify-end sm:gap-6">
          <Skeleton className="h-8 w-18" />

          <div className="flex items-center gap-1">
            <Skeleton className="size-9 sm:w-24" />
            <Skeleton className="size-9 sm:w-20" />
          </div>
        </div>
      </div>
    </div>
  );
};
