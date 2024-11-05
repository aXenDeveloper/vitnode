'use client';

// import { PageInfo } from '@/graphql/types';
import { useTranslations } from 'next-intl';
import React from 'react';
import { PageInfo } from 'vitnode-shared/utils/pagination.dto';

import { HeaderDataTable } from '../data-table/header';
import { SkeletonDataTable } from '../data-table/skeleton';
import { ToolbarDataTable } from '../data-table/toolbar/toolbar';
import { Pagination } from './pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';

interface TMin {
  id: number;
}

export interface DataTableProps<T extends TMin> {
  columns: {
    cell?: (data: { allData: T[]; row: T }) => React.ReactNode;
    id: keyof T | string;
    sortable?: boolean;
    title?: string;
  }[];
  data: T[];
  defaultPageSize?: 10 | 20 | 30 | 40 | 50;
  defaultSorting: {
    sortBy: keyof T;
    sortDirection: 'asc' | 'desc';
  };
  pageInfo?: PageInfo;
  searchPlaceholder?: string;
}

export function DataTable<T extends TMin>({
  data,
  columns,
  defaultSorting,
  searchPlaceholder,
  pageInfo,
  defaultPageSize = 10,
}: DataTableProps<T>) {
  const t = useTranslations('core.global');
  const [isPending, startTransition] = React.useTransition();

  return (
    <div className="space-y-6">
      {searchPlaceholder && (
        <ToolbarDataTable
          searchPlaceholder={searchPlaceholder}
          startTransition={startTransition}
        />
      )}

      <div className="bg-card rounded-md border">
        {isPending ? (
          <SkeletonDataTable />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(column => {
                  const text =
                    column.id.toString() === 'actions'
                      ? ''
                      : (column.title ?? column.id.toString());

                  return (
                    <TableHead key={column.id.toString()}>
                      {column.sortable ? (
                        <HeaderDataTable
                          columnId={column.id.toString()}
                          defaultSortingDirection={
                            defaultSorting.sortBy === column.id.toString()
                              ? defaultSorting.sortDirection
                              : undefined
                          }
                        >
                          {text}
                        </HeaderDataTable>
                      ) : (
                        text
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>

            <TableBody>
              {data.length > 0 ? (
                data.map(row => (
                  <TableRow key={row.id}>
                    {columns.map(column => {
                      const cell = row[
                        column.id.toString() as keyof T
                      ] as React.ReactNode;
                      const content =
                        column.cell?.({ row, allData: data }) ?? cell;

                      if (content === null || content === undefined) {
                        return (
                          <TableCell
                            key={`${column.id.toString()}_${row.id}`}
                          ></TableCell>
                        );
                      }

                      return (
                        <TableCell key={`${column.id.toString()}_${row.id}`}>
                          {column.id.toString() === 'actions' ? (
                            <div className="flex items-center justify-end gap-1">
                              {content}
                            </div>
                          ) : (
                            content
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    className="h-24 text-center"
                    colSpan={columns.length}
                  >
                    {t('no_results')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {pageInfo && (
        <Pagination defaultPageSize={defaultPageSize} pageInfo={pageInfo} />
      )}
    </div>
  );
}
