import { SearchXIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { DataTable, DataTableTMin } from './data-table';

import { cn } from '../../lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { OrderTableHeadDataTable } from './order-table-head';
import { PaginationDataTable } from './pagination';

export function ContentDataTable<T extends DataTableTMin>({
  columns,
  edges,
  pageInfo,
  order,
  customNotFoundComponent,
  ...props
}: React.ComponentProps<typeof DataTable<T>>) {
  const t = useTranslations('core.global');

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border">
        <div className="relative w-full overflow-auto">
          <Table {...props}>
            <TableHeader className="bg-muted sticky top-0 z-10">
              <TableRow>
                {columns.map(column => (
                  <TableHead
                    className={cn(column.className)}
                    key={column.id.toString()}
                  >
                    {order.columns?.includes(column.id as keyof T) ? (
                      <OrderTableHeadDataTable id={column.id} order={order}>
                        {column.label}
                      </OrderTableHeadDataTable>
                    ) : (
                      column.label
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {edges.length ? (
                edges.map(row => (
                  <TableRow key={row.id}>
                    {columns.map(column => {
                      const content =
                        column.cell?.({
                          allData: edges,
                          row,
                        }) ??
                        (column.id === 'actions' ? '' : String(row[column.id]));

                      return (
                        <TableCell
                          className={cn({
                            'flex flex-wrap items-center justify-end gap-2':
                              column.id === 'actions',
                          })}
                          key={`${row.id}_${column.id.toString()}`}
                        >
                          {content}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    className="mx-auto max-w-sm whitespace-normal p-4 text-center sm:px-10 sm:py-12"
                    colSpan={columns.length}
                  >
                    {customNotFoundComponent ?? (
                      <div className="flex flex-col items-center justify-center gap-6">
                        <SearchXIcon className="text-muted-foreground size-16 sm:size-24" />

                        <div className="space-y-2 text-center">
                          <h3 className="text-xl font-semibold tracking-tight">
                            {t('no_results.title')}
                          </h3>
                          <p className="text-muted-foreground text-sm">
                            {t('no_results.desc')}
                          </p>
                        </div>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <PaginationDataTable pageInfo={pageInfo} />
    </div>
  );
}
