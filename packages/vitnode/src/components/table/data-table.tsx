import React from "react";
import { ErrorView } from "../../views/error/error-view";
import { Skeleton } from "../ui/skeleton";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { ContentDataTable } from "./content";
import type { PaginationDataTable } from "./pagination";

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

export const DataTableSkeleton = ({ columns }: { columns: number }) => {
  const headerIds = React.useMemo(
    () =>
      Array.from({ length: columns }).map(
        () => `s-head-${Math.random().toString(36).slice(2, 9)}`,
      ),
    [columns],
  );

  const rowIds = React.useMemo(
    () =>
      Array.from({ length: 6 }).map(
        () => `s-row-${Math.random().toString(36).slice(2, 9)}`,
      ),
    [],
  );

  return (
    <div className="space-y-4">
      <div className="[&>div]:rounded-md [&>div]:border">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              {headerIds.map(hid => (
                <TableHead className="px-4 py-3" key={hid}>
                  <Skeleton className="h-4 w-24" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowIds.map(rid => (
              <TableRow key={rid}>
                {headerIds.map((_, j) => {
                  const cellId = `s-cell-${rid}-${j}`;
                  return (
                    <td className="px-4 py-3" key={cellId}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <Skeleton className="h-8 w-32" />
      </div>
    </div>
  );
};

export function DataTable<T extends DataTableTMin>(
  props: Omit<React.ComponentProps<typeof Table>, "columns"> &
    React.ComponentProps<typeof PaginationDataTable> & {
      columns: {
        cell?: (data: { allData: T[]; row: T }) => React.ReactNode;
        className?: string;
        id: "actions" | keyof T;
        label: string;
      }[];
      customNotFoundComponent?: React.ReactNode;
      edges: T[];
      order: {
        columns?: (keyof T)[];
        defaultOrder: {
          column: keyof T;
          order: "asc" | "desc";
        };
      };
    },
) {
  if (!(props.edges && props.pageInfo)) {
    return <ErrorView code={500} />;
  }

  return <ContentDataTable<T> {...props} />;
}
