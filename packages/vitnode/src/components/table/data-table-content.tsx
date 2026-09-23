import { cn } from "cn";
import React from "react";

import type { FilterDataTable } from "./filters";
import type { PaginationDataTable } from "./pagination";
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
    header?: React.ReactNode;
    id: string;
    order: {
      columns?: (keyof T)[];
      defaultOrder: {
        column: keyof T;
        order: "asc" | "desc";
      };
    };
    rowOpens?: (row: T) => void;
    search?: boolean;
  };

const SKELETON_HEAD_WIDTHS = ["w-24", "w-16", "w-20", "w-14"];
const SKELETON_CELL_WIDTHS = ["w-full", "w-3/4", "w-1/2", "w-5/6", "w-2/3"];

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
        <div className="border-foreground/10 flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-40" />
        </div>
      )}

      {toolbar && (
        <div className="border-foreground/10 flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <Skeleton className="h-9 w-full sm:w-80" />
          <Skeleton className="h-9 w-24" />
        </div>
      )}

      <div>
        <Table className="min-w-full [&_td]:px-4 [&_td]:py-3 sm:[&_td]:px-6 [&_th]:px-4 sm:[&_th]:px-6">
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

      <div className="border-foreground/10 flex w-full flex-col-reverse items-center justify-between gap-4 border-t px-4 py-3 sm:flex-row sm:gap-8 sm:px-6">
        <Skeleton className="h-4 w-24" />

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
