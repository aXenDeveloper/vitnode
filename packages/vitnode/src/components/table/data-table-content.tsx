import React from "react";

import type { FilterDataTable } from "./filters";
import type { PaginationDataTable } from "./pagination";
import type { SearchDataTable } from "./search";

import { cn } from "../../lib/utils";
import { Skeleton } from "../ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

export interface DataTableTMin {
  id: number;
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
  cell?: (data: { allData: T[]; row: T }) => React.ReactNode;
  className?: string;
  header: React.ReactNode;
}

interface AccessorColumnDef<T extends DataTableTMin> extends ColumnDefBase<T> {
  accessorKey: keyof T;
  id?: string;
}

interface DisplayColumnDef<T extends DataTableTMin> extends ColumnDefBase<T> {
  accessorKey?: never;
  id: string;
}

export type ColumnDef<T extends DataTableTMin> =
  AccessorColumnDef<T> | DisplayColumnDef<T>;

/**
 * Everything a data table is told, in one place both frameworks can import.
 *
 * Named rather than inferred from the component because the component the props
 * belong to is now the Next.js one - `content.tsx` and the sort header would
 * otherwise reach for `ComponentProps<typeof DataTable>` and, through it, for a
 * module a TanStack Start route cannot load.
 */
export type DataTableProps<T extends DataTableTMin> = Omit<
  React.ComponentProps<typeof Table>,
  "columns"
> &
  React.ComponentProps<typeof PaginationDataTable> &
  React.ComponentProps<typeof SearchDataTable> & {
    bulkActions?: React.ReactNode;
    columns: ColumnDef<T>[];
    customNoResults?: {
      description?: string;
      footer?: React.ReactNode;
      icon?: React.ReactNode;
      title?: string;
    };
    edges: T[];
    filters?: FilterDataTable[];
    id: string;
    order: {
      columns?: (keyof T)[];
      defaultOrder: {
        column: keyof T;
        order: "asc" | "desc";
      };
    };
    search?: boolean;
  };

const SKELETON_HEAD_WIDTHS = ["w-24", "w-16", "w-20", "w-14"];
const SKELETON_CELL_WIDTHS = ["w-full", "w-3/4", "w-1/2", "w-5/6", "w-2/3"];

/**
 * The table's shape before its rows arrive.
 *
 * It lives beside the types rather than with `DataTable` because a Suspense
 * fallback is the one part of the table a route renders *outside* the table -
 * and a TanStack Start route reaching into the Next.js module for it would drag
 * `next-intl`'s navigation in behind it.
 */
export const DataTableSkeleton = ({
  columns,
  rows = 6,
  toolbar = false,
}: {
  columns: number;
  rows?: number;
  toolbar?: boolean;
}) => {
  const headerIds = Array.from({ length: columns }, (_, i) => `s-head-${i}`);
  const rowIds = Array.from({ length: rows }, (_, i) => `s-row-${i}`);

  return (
    <div className="space-y-4">
      {toolbar && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      )}

      <div className="[&>div]:rounded-md [&>div]:border">
        <Table className="min-w-full">
          <TableHeader className="bg-card">
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

      <div className="flex w-full flex-col-reverse items-center justify-end gap-4 overflow-auto p-1 sm:flex-row sm:gap-8">
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 lg:gap-8">
          <Skeleton className="h-8 w-[4.5rem]" />

          <div className="flex items-center space-x-2">
            <Skeleton className="size-8" />
            <Skeleton className="size-8" />
          </div>
        </div>
      </div>
    </div>
  );
};
