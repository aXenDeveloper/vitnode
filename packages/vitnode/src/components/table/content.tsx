import { SearchXIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { AlignDataTable, DataTable, DataTableTMin } from "./data-table";

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
import { OrderTableHeadDataTable } from "./order-table-head";
import { PaginationDataTable } from "./pagination";
import { SearchDataTable } from "./search";

const alignClassName = (align?: AlignDataTable) =>
  cn({
    "flex items-center justify-center gap-2": align === "center",
    "flex items-center justify-end gap-2": align === "right",
  });

export function ContentDataTable<T extends DataTableTMin>({
  columns,
  edges,
  pageInfo,
  order,
  customNoResults,
  search,
  searchPlaceholder,
  filters,
  ...props
}: React.ComponentProps<typeof DataTable<T>>) {
  const t = useTranslations("core.global");
  const hasToolbar = Boolean(search) || Boolean(filters?.length);

  return (
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

      <div className="[&>div]:rounded-md [&>div]:border">
        <Table {...props}>
          <TableHeader className="bg-card">
            <TableRow>
              {columns.map(column => {
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
              edges.map(row => (
                <TableRow key={row.id}>
                  {columns.map(column => {
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
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="mx-auto max-w-sm p-4 text-center whitespace-normal sm:px-10 sm:py-12"
                  colSpan={columns.length}
                >
                  <div className="[&>svg]:text-muted-foreground flex flex-col items-center justify-center gap-6 [&>svg]:size-16 [&>svg]:sm:size-24">
                    {customNoResults?.icon ?? <SearchXIcon />}

                    <div className="space-y-2 text-center">
                      <h3 className="text-xl font-semibold tracking-tight">
                        {customNoResults?.title ?? t("no_results.title")}
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        {customNoResults?.description ?? t("no_results.desc")}
                      </p>
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
}
