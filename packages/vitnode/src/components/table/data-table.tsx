import React from 'react';

import type { PaginationDataTable } from './pagination';

import { ErrorView } from '../../views/error/error-view';
import { Skeleton } from '../ui/skeleton';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { ContentDataTable } from './content';

export interface DataTableTMin {
  id: number;
}

export interface SearchParamsDataTable<T = unknown> {
  cursor?: string;
  first?: string;
  last?: string;
  order?: 'asc' | 'desc';
  orderBy?: keyof T;
}

export const DataTableSkeleton = ({ columns }: { columns: number }) => (
  <div className="space-y-4">
    <div className="overflow-hidden rounded-lg border">
      <div className="relative w-full overflow-auto">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              {Array.from({ length: columns }).map((_, i) => (
                <TableHead className="px-4 py-3" key={i}>
                  <Skeleton className="h-4 w-24" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: columns }).map((_, j) => (
                  <td className="px-4 py-3" key={j}>
                    <Skeleton className="h-4 w-full" />
                  </td>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
    <div className="flex justify-end">
      <Skeleton className="h-8 w-32" />
    </div>
  </div>
);

export function DataTable<T extends DataTableTMin>(
  props: Omit<React.ComponentProps<typeof Table>, 'columns'> &
    React.ComponentProps<typeof PaginationDataTable> & {
      columns: {
        cell?: (data: { allData: T[]; row: T }) => React.ReactNode;
        className?: string;
        id: 'actions' | keyof T;
        label: string;
      }[];
      customNotFoundComponent?: React.ReactNode;
      edges: T[];
      order: {
        columns?: (keyof T)[];
        defaultOrder: {
          column: keyof T;
          order: 'asc' | 'desc';
        };
      };
    },
) {
  if (!props.edges || !props.pageInfo) {
    return <ErrorView code={500} />;
  }

  return <ContentDataTable<T> {...props} />;
}
