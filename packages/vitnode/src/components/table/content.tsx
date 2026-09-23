import { cn } from "cn";
import { SearchXIcon } from "lucide-react";

import type {
  AlignDataTable,
  ColumnDef,
  DataTableProps,
  DataTableTMin,
} from "./data-table-content";

import { Empty, EmptyContent, EmptyHeader, EmptyMedia } from "../ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { FiltersDataTable } from "./filters";
import { useDataTableUrl } from "./navigation";
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
import { readTableOrder } from "./url-state";

/**
 * ALIGNMENT WITHOUT LEAVING TABLE LAYOUT. This was `flex`, which takes a cell
 * out of the row: two adjacent aligned columns were then wrapped in one
 * anonymous cell and rendered one above the other. Measured at 1440 with
 * Matched beside Checked on `/app/narrations`; the styleguide sample aligns a
 * single column, which is why it had never shown.
 */
const alignClassName = (align?: AlignDataTable) =>
  cn({
    "text-center": align === "center",
    "text-right": align === "right",
  });

export function ContentDataTable<T extends DataTableTMin>({
  bulkActions,
  columns,
  edges,
  pageInfo,
  order,
  customNoResults,
  header,
  rowOpens,
  search,
  searchPlaceholder,
  filters,
  ...props
}: DataTableProps<T>) {
  const { searchParams } = useDataTableUrl();
  // WHICH COLUMN THE LIST IS ORDERED BY, SAID AND NOT ONLY DRAWN. The arrow on
  // the active header is the whole of what states the order once a surface
  // stops carrying an "Ordered" control beside its list, and an arrow is not
  // read out.
  const ordered = readTableOrder(searchParams, {
    column: String(order.defaultOrder.column),
    order: order.defaultOrder.order,
  });
  const sortStateOf = (
    column: ColumnDef<T>,
  ): "ascending" | "descending" | "none" | undefined => {
    if (
      column.accessorKey == null ||
      !order.columns?.includes(column.accessorKey)
    ) {
      return undefined;
    }
    if (ordered.column !== String(column.accessorKey)) {
      return "none";
    }

    return ordered.order === "asc" ? "ascending" : "descending";
  };
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
    <div className="bg-card text-card-foreground ring-foreground/10 overflow-hidden rounded-md shadow-xs ring-1">
      {header !== undefined && (
        <div className="border-foreground/10 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
          {header}
        </div>
      )}

      {hasToolbar && (
        <div className="border-foreground/10 flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <div className="w-full min-w-0 flex-1">
            {search && (
              <SearchDataTable searchPlaceholder={searchPlaceholder} />
            )}
          </div>
          {filters && filters.length > 0 && (
            <FiltersDataTable filters={filters} />
          )}
        </div>
      )}

      {/* THE TABLE SCROLLS, NEVER THE PAGE. `<main>` is `flex-1` with
          `min-width: auto`, so a table wider than the shell grows the page
          instead of overflowing inside it — measured at 1440, the page went
          from 1201 to 1312 and the title and the last filter clipped with it.
          A single-column grid track gives the container a definite width, which
          the table's own `overflow-x-auto` then works against. It lives here
          because every caller sits in that same `<main>`. */}
      <div className="grid grid-cols-[minmax(0,1fr)]">
        <div>
          <Table
            {...props}
            className={cn(
              // THE OUTER EDGE TAKES THE BANDS' PADDING AND THE COLUMNS
              // BETWEEN TAKE LESS. The first column then starts where the count
              // above it does and the last ends where the page control does,
              // while the gutters inside stay a gutter — at the bands' own
              // `px-6` on every column, seven of them spent 336px of a 1137px
              // table on air, and the subject's column was clipping names to
              // pay for it. The row's height is set once here, not by every
              // caller's cell.
              "[&_td]:px-3 [&_td]:py-3 [&_th]:px-3",
              "[&_td:first-child]:pl-4 sm:[&_td:first-child]:pl-6 [&_th:first-child]:pl-4 sm:[&_th:first-child]:pl-6",
              "[&_td:last-child]:pr-4 sm:[&_td:last-child]:pr-6 [&_th:last-child]:pr-4 sm:[&_th:last-child]:pr-6",
              bulkActions &&
                "[&_td:first-child]:pe-4 sm:[&_td:first-child]:pe-5 [&_th:first-child]:pe-4 sm:[&_th:first-child]:pe-5",
              props.className,
            )}
          >
            <TableHeader className="bg-muted/60">
              <TableRow>
                {allColumns.map(column => {
                  const columnKey = column.id ?? String(column.accessorKey);
                  const isOrderable =
                    column.accessorKey != null &&
                    Boolean(order.columns?.includes(column.accessorKey));

                  return (
                    <TableHead
                      aria-sort={sortStateOf(column)}
                      className={cn(
                        alignClassName(column.align),
                        column.className,
                      )}
                      key={columnKey}
                    >
                      {isOrderable && column.accessorKey ? (
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
                        // The column's own class reaches the cell as well as the
                        // head. It reached the head alone, so a caller could
                        // neither align a value under its own header nor let a
                        // long name wrap, and both had to be redone on an element
                        // inside the cell.
                        className={cn(
                          alignClassName(column.align),
                          column.className,
                        )}
                        key={`${row.id}_${columnKey}`}
                      >
                        {content}
                      </TableCell>
                    );
                  });

                  if (bulkActions) {
                    return (
                      <RowSelectableDataTable id={row.id} key={row.id}>
                        {cells}
                      </RowSelectableDataTable>
                    );
                  }

                  return (
                    <TableRow
                      className={
                        rowOpens
                          ? "focus-visible:bg-muted/50 focus-visible:outline-ring cursor-pointer focus-visible:outline-1"
                          : undefined
                      }
                      key={row.id}
                      onClick={
                        rowOpens
                          ? event => {
                              // A control inside the row answers for itself,
                              // and a reader who has selected text in a cell
                              // was reading it rather than asking to leave.
                              if (
                                (event.target as HTMLElement).closest(
                                  "a,button,input,select,textarea,[role=checkbox]",
                                )
                              ) {
                                return;
                              }
                              if (window.getSelection()?.toString()) {
                                return;
                              }
                              rowOpens(row);
                            }
                          : undefined
                      }
                      onKeyDown={
                        rowOpens
                          ? event => {
                              if (
                                (event.target as HTMLElement).closest(
                                  "a,button,input,select,textarea,[role=checkbox]",
                                )
                              ) {
                                return;
                              }
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                rowOpens(row);
                              }
                            }
                          : undefined
                      }
                      tabIndex={rowOpens ? 0 : undefined}
                    >
                      {cells}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    className="!p-0 whitespace-normal"
                    colSpan={allColumns.length}
                  >
                    <Empty data-testid="table-no-results">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          {customNoResults?.icon ?? <SearchXIcon />}
                        </EmptyMedia>
                        <NoResultsDataTable
                          description={customNoResults?.description}
                          title={customNoResults?.title}
                        />
                      </EmptyHeader>
                      {customNoResults?.footer ?? (
                        <EmptyContent>{customNoResults?.footer}</EmptyContent>
                      )}
                    </Empty>
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
