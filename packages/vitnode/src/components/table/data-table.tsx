import React from 'react';

import { Table } from '../ui/table';
import { ContentDataTable } from './content';
import { PaginationDataTable } from './pagination';

export interface DataTableTMin {
  id: number;
}

export interface SearchParamsDataTable {
  cursor?: string;
  first?: string;
  last?: string;
  order?: 'asc' | 'desc';
  orderBy?: keyof DataTableTMin;
}

export function DataTable<T extends DataTableTMin>(
  props: Omit<React.ComponentProps<typeof Table>, 'columns'> &
    React.ComponentProps<typeof PaginationDataTable> & {
      columns: {
        cell?: (data: { allData: T[]; row: T }) => React.ReactNode;
        id: keyof T;
        label: string;
      }[];
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
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <ContentDataTable<T> {...props} />
    </React.Suspense>
  );
}
