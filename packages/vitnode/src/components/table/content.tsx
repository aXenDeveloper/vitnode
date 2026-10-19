import { cn } from "cn";
import React from "react";

import type {
  ColumnDef,
  DataTableProps,
  DataTableRowId,
  DataTableTMin,
} from "./data-table-content";

import { Table, TableBody } from "../ui/table";
import { TooltipGroup } from "../ui/tooltip";
import { HeadRowDataTable } from "./content-head";
import { EmptyBodyDataTable, RowDataTable } from "./content-row";
import {
  ExpandHeaderDataTable,
  ExpandToggleDataTable,
  useRowExpansionDataTable,
} from "./expansion";
import { FiltersDataTable } from "./filters";
import { GroupHeadingRowDataTable, groupRowsDataTable } from "./group";
import { useDataTableUrl } from "./navigation";
import { PaginationDataTable } from "./pagination";
import {
  ReorderFallbackBodyDataTable,
  ReorderHandleDataTable,
  ReorderHeaderDataTable,
} from "./reorder-handle";
import { isTableInStoredOrder } from "./reorder-state";
import { useRowOrderDataTable } from "./row-order";
import { SearchDataTable } from "./search";
import {
  BulkActionsDataTable,
  SelectAllDataTable,
  SelectionProviderDataTable,
  SelectRowDataTable,
} from "./selection";

interface ExpansionColumnDataTable<T extends DataTableTMin> {
  canExpand: (row: T) => boolean;
  expandedIdOf: (row: T) => string;
  isExpanded: (id: DataTableRowId) => boolean;
  toggle: (id: DataTableRowId) => void;
}

const reorderColumn = <T extends DataTableTMin>(): ColumnDef<T> => ({
  id: "reorder",
  header: <ReorderHeaderDataTable />,
  className: "w-8",
  cell: () => <ReorderHandleDataTable />,
});

const selectColumn = <T extends DataTableTMin>(): ColumnDef<T> => ({
  id: "select",
  header: <SelectAllDataTable />,
  className: "w-8",
  cell: ({ row }) => <SelectRowDataTable id={row.id} />,
});

const expandColumn = <T extends DataTableTMin>({
  canExpand,
  expandedIdOf,
  isExpanded,
  toggle,
}: ExpansionColumnDataTable<T>): ColumnDef<T> => ({
  id: "expand",
  header: <ExpandHeaderDataTable />,
  className: "w-8",
  cell: ({ row }) =>
    canExpand(row) ? (
      <ExpandToggleDataTable
        controls={expandedIdOf(row)}
        expanded={isExpanded(row.id)}
        onToggle={() => toggle(row.id)}
      />
    ) : null,
});

const customRowColumn = <T extends DataTableTMin>(
  renderRow: NonNullable<DataTableProps<T>["renderRow"]>,
): ColumnDef<T> => ({
  id: "row",
  header: null,
  className: "w-full whitespace-normal",
  cell: renderRow,
});

const withControlColumns = <T extends DataTableTMin>({
  columns,
  expansion,
  reorderable,
  selectable,
}: {
  columns: ColumnDef<T>[];
  expansion?: ExpansionColumnDataTable<T>;
  reorderable: boolean;
  selectable: boolean;
}): ColumnDef<T>[] => [
  ...(reorderable ? [reorderColumn<T>()] : []),
  ...(selectable ? [selectColumn<T>()] : []),
  ...(expansion ? [expandColumn(expansion)] : []),
  ...columns,
];

const ToolbarDataTable = ({
  filters,
  search,
  searchPlaceholder,
}: Pick<
  DataTableProps<DataTableTMin>,
  "filters" | "search" | "searchPlaceholder"
>) => {
  if (!search && !filters?.length) {
    return null;
  }

  return (
    <div className="border-foreground/10 flex flex-wrap items-center gap-2 border-b px-4 py-3">
      <div className="min-w-48 flex-1">
        {search && <SearchDataTable searchPlaceholder={searchPlaceholder} />}
      </div>
      {filters && filters.length > 0 && <FiltersDataTable filters={filters} />}
    </div>
  );
};

// dnd-kit is only downloaded by tables that can actually be reordered.
const ReorderableBodyDataTable = React.lazy(async () =>
  import("./reorder").then(module => ({
    default: module.ReorderableBodyDataTable,
  })),
);

/**
 * A server-paginated data table driven by the URL: sorting, cursor paging,
 * search and filters are read from and written to the query string through
 * the enclosing `DataTableNavigationProvider`, so the route's loader fetches
 * each page. Optional row selection with bulk actions, expandable and
 * reorderable rows, and grouping.
 *
 * Pass the API's `edges` and `pageInfo` for the current page. Leave
 * `pageInfo` out for a short list that is never paged, and the pagination
 * footer is not rendered.
 */
export function ContentDataTable<T extends DataTableTMin>({
  bulkActions,
  columns = [],
  edges,
  expandable,
  groupBy,
  pageInfo,
  order,
  reorderable,
  customNoResults,
  header,
  renderRow: customRow,
  rowOpens,
  search,
  searchPlaceholder,
  filters,
  ...props
}: DataTableProps<T>) {
  const { searchParams } = useDataTableUrl();
  const expandedBaseId = React.useId();
  const { reorder, rows } = useRowOrderDataTable({
    edges,
    onReorder: reorderable?.onReorder,
  });
  // Memoized on the rows so the selection context does not change every render.
  const rowIds = React.useMemo(() => rows.map(row => row.id), [rows]);
  const expansion = useRowExpansionDataTable({
    defaultExpanded: expandable?.defaultExpanded,
    rowIds,
  });
  const canExpand = (row: T) =>
    expandable !== undefined && (expandable.canExpand?.(row) ?? true);
  const expandedIdOf = (row: T) => `${expandedBaseId}expanded-${row.id}`;
  const allColumns = withControlColumns({
    columns: customRow ? [customRowColumn(customRow)] : columns,
    expansion: expandable
      ? {
          canExpand,
          expandedIdOf,
          isExpanded: expansion.isExpanded,
          toggle: expansion.toggle,
        }
      : undefined,
    reorderable: Boolean(reorderable),
    selectable: Boolean(bulkActions),
  });
  const hasHead =
    !customRow ||
    bulkActions !== undefined ||
    expandable !== undefined ||
    reorderable !== undefined;

  const renderRow = (row: T) => (
    <RowDataTable
      columns={allColumns}
      expandable={expandable}
      expanded={canExpand(row) && expansion.isExpanded(row.id)}
      expandedId={expandedIdOf(row)}
      row={row}
      rowOpens={rowOpens}
      rows={rows}
      selectable={Boolean(bulkActions)}
    />
  );

  const renderBody = () => {
    if (rows.length === 0) {
      return (
        <EmptyBodyDataTable
          colSpan={allColumns.length}
          customNoResults={customNoResults}
        />
      );
    }

    if (reorderable) {
      return (
        <React.Suspense
          fallback={
            <ReorderFallbackBodyDataTable renderRow={renderRow} rows={rows} />
          }
        >
          <ReorderableBodyDataTable
            disabled={
              reorderable.disabled === true ||
              !isTableInStoredOrder(searchParams, {
                defaultOrder: {
                  column: String(order.defaultOrder.column),
                  order: order.defaultOrder.order,
                },
                filterIds: filters?.map(filter => filter.id) ?? [],
              })
            }
            onMove={reorder}
            rows={rows.map(row => ({
              content: renderRow(row),
              id: row.id,
              label: reorderable.getRowLabel?.(row),
            }))}
          />
        </React.Suspense>
      );
    }

    if (groupBy) {
      return groupRowsDataTable(rows, groupBy.key).map(group => (
        <TableBody key={group.key}>
          <GroupHeadingRowDataTable
            colSpan={allColumns.length}
            group={group}
            label={groupBy.label}
          />
          {group.rows.map(row => (
            <React.Fragment key={row.id}>{renderRow(row)}</React.Fragment>
          ))}
        </TableBody>
      ));
    }

    return (
      <TableBody>
        {rows.map(row => (
          <React.Fragment key={row.id}>{renderRow(row)}</React.Fragment>
        ))}
      </TableBody>
    );
  };

  const table = (
    <div className="bg-card text-card-foreground ring-foreground/10 overflow-hidden rounded-xl shadow-xs ring-1">
      {header !== undefined && (
        <div className="border-foreground/10 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
          {header}
        </div>
      )}

      <ToolbarDataTable
        filters={filters}
        search={search}
        searchPlaceholder={searchPlaceholder}
      />

      {/* THE TABLE SCROLLS, NEVER THE PAGE. `<main>` is `flex-1` with
          `min-width: auto`, so a table wider than the shell grows the page
          instead of overflowing inside it — measured at 1440, the page went
          from 1201 to 1312 and the title and the last filter clipped with it.
          A single-column grid track gives the container a definite width, which
          the table's own `overflow-x-auto` then works against. It lives here
          because every caller sits in that same `<main>`. */}
      <div className="grid grid-cols-[minmax(0,1fr)]">
        <div className={expandable ? "@container" : undefined}>
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
                !reorderable &&
                "[&_td:first-child]:pe-4 sm:[&_td:first-child]:pe-5 [&_th:first-child]:pe-4 sm:[&_th:first-child]:pe-5",
              props.className,
            )}
          >
            {hasHead && (
              <HeadRowDataTable
                columns={allColumns}
                order={order}
                searchParams={searchParams}
              />
            )}

            {renderBody()}
          </Table>
        </div>
      </div>

      {pageInfo ? <PaginationDataTable pageInfo={pageInfo} /> : null}
    </div>
  );

  if (!bulkActions) {
    return <TooltipGroup>{table}</TooltipGroup>;
  }

  return (
    <TooltipGroup>
      <SelectionProviderDataTable rowIds={rowIds}>
        {table}
        <BulkActionsDataTable actions={bulkActions} />
      </SelectionProviderDataTable>
    </TooltipGroup>
  );
}
