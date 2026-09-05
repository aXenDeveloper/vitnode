import { SearchXIcon } from "lucide-react";

import type {
  AlignDataTable,
  ColumnDef,
  DataTableProps,
  DataTableTMin,
} from "./data-table-content";

import { cn } from "../../lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { FiltersDataTable } from "./filters";
import { NoResultsDataTable } from "./no-results";
import { OrderTableHeadDataTable } from "./order-table-head";
import { PaginationDataTable } from "./pagination";
import { SearchDataTable } from "./search";
import {
  BulkActionsDataTable,
  RowSelectableDataTable,
  SelectAllDataTable,
  SelectionProviderDataTable,
  SelectRowDataTable,
} from "./selection";

const alignClassName = (align?: AlignDataTable) =>
  cn({
    "flex items-center justify-center gap-2": align === "center",
    "flex items-center justify-end gap-2": align === "right",
  });

export function ContentDataTable<T extends DataTableTMin>({
  bulkActions,
  columns,
  edges,
  pageInfo,
  order,
  customNoResults,
  search,
  searchPlaceholder,
  filters,
  ...props
}: DataTableProps<T>) {
  const hasToolbar = Boolean(search) || Boolean(filters?.length);
  const allColumns: ColumnDef<T>[] = bulkActions
    ? [
        {
          id: "select",
          header: <SelectAllDataTable />,
          className: "w-8",
          cell: ({ row }) => <SelectRowDataTable id={row.id} />,
        },
        ...columns,
      ]
    : columns;

  const table = (
    <div className="space-y-4">
      {hasToolbar && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {search && (
            <div className="flex-1">
              <SearchDataTable searchPlaceholder={searchPlaceholder} />
            </div>
          )}
          {filters && filters.length > 0 && (
            <FiltersDataTable filters={filters} />
          )}
        </div>
      )}

      <div className="[&>div]:bg-card [&>div]:rounded-md [&>div]:border">
        <Table {...props}>
          <TableHeader className="bg-muted/60">
            <TableRow>
              {allColumns.map(column => {
                const columnKey = column.id ?? String(column.accessorKey);
                const isOrderable =
                  column.accessorKey != null &&
                  Boolean(order.columns?.includes(column.accessorKey));

                return (
                  <TableHead
                    className={cn(
                      alignClassName(column.align),
                      column.className,
                    )}
                    key={columnKey}
                  >
                    {isOrderable && column.accessorKey ? (
                      <OrderTableHeadDataTable
                        id={column.accessorKey}
                        order={order}
                      >
                        {column.header}
                      </OrderTableHeadDataTable>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>

          <TableBody>
            {edges.length ? (
              edges.map(row => {
                const cells = allColumns.map(column => {
                  const columnKey = column.id ?? String(column.accessorKey);
                  const content = column.cell
                    ? column.cell({ allData: edges, row })
                    : column.accessorKey != null
                      ? String(row[column.accessorKey])
                      : "";

                  return (
                    <TableCell
                      className={alignClassName(column.align)}
                      key={`${row.id}_${columnKey}`}
                    >
                      {content}
                    </TableCell>
                  );
                });

                return bulkActions ? (
                  <RowSelectableDataTable id={row.id} key={row.id}>
                    {cells}
                  </RowSelectableDataTable>
                ) : (
                  <TableRow key={row.id}>{cells}</TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  className="mx-auto max-w-sm p-4 text-center whitespace-normal sm:px-10 sm:py-12"
                  colSpan={allColumns.length}
                >
                  <div className="[&>svg]:text-muted-foreground flex flex-col items-center justify-center gap-6 [&>svg]:size-16 [&>svg]:sm:size-24">
                    {customNoResults?.icon ?? <SearchXIcon />}

                    <div className="space-y-2 text-center">
                      <NoResultsDataTable
                        description={customNoResults?.description}
                        title={customNoResults?.title}
                      />
                      {customNoResults?.footer}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationDataTable pageInfo={pageInfo} />
    </div>
  );

  if (!bulkActions) {
    return table;
  }

  return (
    <SelectionProviderDataTable rowIds={edges.map(row => row.id)}>
      {table}
      <BulkActionsDataTable actions={bulkActions} />
    </SelectionProviderDataTable>
  );
}
