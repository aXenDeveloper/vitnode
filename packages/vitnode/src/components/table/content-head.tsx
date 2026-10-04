import { cn } from "cn";

import type {
  ColumnDef,
  DataTableProps,
  DataTableTMin,
} from "./data-table-content";

import { TableHead, TableHeader, TableRow } from "../ui/table";
import { alignClassName } from "./align";
import { OrderTableHeadDataTable } from "./order-table-head";
import { readTableOrder } from "./url-state";

type SortStateDataTable = "ascending" | "descending" | "none";

export const HeadRowDataTable = <T extends DataTableTMin>({
  columns,
  order,
  searchParams,
}: {
  columns: ColumnDef<T>[];
  order: DataTableProps<T>["order"];
  searchParams: URLSearchParams;
}) => {
  // WHICH COLUMN THE LIST IS ORDERED BY, SAID AND NOT ONLY DRAWN. The arrow on
  // the active header is the whole of what states the order once a surface
  // stops carrying an "Ordered" control beside its list, and an arrow is not
  // read out.
  const ordered = readTableOrder(searchParams, {
    column: String(order.defaultOrder.column),
    order: order.defaultOrder.order,
  });
  const orderableColumns = new Set(order.columns);
  const isOrderable = (column: ColumnDef<T>) =>
    column.accessorKey != null && orderableColumns.has(column.accessorKey);
  const sortStateOf = (
    column: ColumnDef<T>,
  ): SortStateDataTable | undefined => {
    if (!isOrderable(column)) {
      return undefined;
    }
    if (ordered.column !== String(column.accessorKey)) {
      return "none";
    }

    return ordered.order === "asc" ? "ascending" : "descending";
  };

  return (
    <TableHeader className="bg-muted/60">
      <TableRow>
        {columns.map(column => (
          <TableHead
            aria-sort={sortStateOf(column)}
            className={cn(alignClassName(column.align), column.className)}
            key={column.id ?? String(column.accessorKey)}
          >
            {isOrderable(column) && column.accessorKey ? (
              <OrderTableHeadDataTable
                align={column.align}
                id={column.accessorKey}
                order={order}
              >
                {column.header}
              </OrderTableHeadDataTable>
            ) : (
              column.header
            )}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
};
