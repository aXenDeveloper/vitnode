import type { DataTable, DataTableTMin } from './data-table';

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
  ...props
}: React.ComponentProps<typeof DataTable<T>>) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border">
        <div className="relative w-full overflow-auto">
          <Table {...props}>
            <TableHeader className="bg-muted sticky top-0 z-10">
              <TableRow>
                {columns.map(column => (
                  <TableHead
                    className="[&:not(:first-child)]:pl-0"
                    key={column.id.toString()}
                  >
                    {order.columns?.includes(column.id) ? (
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
                        }) ?? String(row[column.id]);

                      return (
                        <TableCell key={`${row.id}_${column.id.toString()}`}>
                          {content}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="text-center" colSpan={columns.length}>
                    Not Found
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
