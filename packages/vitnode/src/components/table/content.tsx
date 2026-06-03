import { SearchXIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { DataTable, DataTableTMin } from "./data-table";

import { cn } from "../../lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { OrderTableHeadDataTable } from "./order-table-head";
import { PaginationDataTable } from "./pagination";
import { SearchDataTable } from "./search";

export function ContentDataTable<T extends DataTableTMin>({
  columns,
  edges,
  pageInfo,
  order,
  customNoResults,
  search,
  searchPlaceholder,
  ...props
}: React.ComponentProps<typeof DataTable<T>>) {
  const t = useTranslations("core.global");

  return (
    <div className="space-y-4">
      {search && <SearchDataTable searchPlaceholder={searchPlaceholder} />}

      <div className="[&>div]:rounded-md [&>div]:border">
        <Table {...props}>
          <TableHeader className="bg-card">
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
                      (column.id === "actions" ? "" : String(row[column.id]));

                    return (
                      <TableCell
                        className={cn({
                          "flex items-center justify-end gap-2":
                            column.id === "actions",
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
