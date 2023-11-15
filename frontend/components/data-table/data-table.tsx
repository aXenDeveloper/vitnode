'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Button } from '../ui/button';
import { PageInfo } from '@/graphql/hooks';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { usePathname, useRouter } from '@/i18n';
import { ToolbarDataTable, ToolbarDataTableProps } from './toolbar/toolbar-data-table';
import { GlobalLoader } from '../loader/global/global-loader';

interface DataTableProps<TData> extends ToolbarDataTableProps {
  columns: ColumnDef<TData>[];
  data: TData[];
  defaultItemsPerPage: number;
  isFetching: boolean | undefined;
  pageInfo?: PageInfo;
  searchPlaceholder?: string;
}

export function DataTable<TData>({
  columns,
  data,
  defaultItemsPerPage,
  isFetching,
  pageInfo,
  ...props
}: DataTableProps<TData>) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { push } = useRouter();
  const t = useTranslations('core');
  const table = useReactTable({
    data: useMemo(() => data, [data]),
    columns: useMemo(() => columns, [columns]),
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true
  });
  const pagination = {
    first: searchParams.get('first'),
    last: searchParams.get('last'),
    cursor: searchParams.get('cursor')
  };

  const changeState = ({
    cursor,
    nextPage,
    pageSize
  }: {
    cursor?: string | number;
    nextPage?: boolean;
    pageSize?: string | null;
  }) => {
    const params = new URLSearchParams(searchParams);

    if (cursor) {
      params.set('cursor', `${cursor}`);
    }

    const defaultPageSize = {
      first: pagination.first ? pagination.first : `${defaultItemsPerPage}`,
      last: pagination.last ? pagination.last : `${defaultItemsPerPage}`
    };

    if (nextPage || (pageSize && !nextPage)) {
      params.set('first', pageSize ? pageSize : defaultPageSize.first);
      params.delete('last');
    } else {
      params.set('last', pageSize ? pageSize : defaultPageSize.last);
      params.delete('first');
    }

    push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-4">
      {isFetching && <GlobalLoader />}

      <ToolbarDataTable {...props} />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {t('no_results')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pageInfo && (
        <div className="flex items-center justify-end px-2 pt-4 gap-4 lg:gap-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <Select
              value={`${pagination.first || pagination.last || defaultItemsPerPage}`}
              onValueChange={value => {
                changeState({ pageSize: value });
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue
                  placeholder={pagination.first || pagination.last || defaultItemsPerPage}
                />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map(pageSize => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="icon"
              disabled={!pageInfo.hasPreviousPage}
              onClick={() =>
                changeState({
                  cursor: pageInfo.startCursor,
                  pageSize: pagination.last
                })
              }
            >
              <span className="sr-only">{t('pagination.previous')}</span>
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={!pageInfo.hasNextPage}
              onClick={() =>
                changeState({
                  cursor: pageInfo.endCursor,
                  pageSize: pagination.first,
                  nextPage: true
                })
              }
            >
              <span className="sr-only">{t('pagination.next')}</span>
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
