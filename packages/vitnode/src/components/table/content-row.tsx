import type React from "react";

import { cn } from "cn";
import { SearchXIcon } from "lucide-react";
import { AnimatePresence } from "motion/react";

import type {
  ColumnDef,
  DataTableProps,
  DataTableTMin,
} from "./data-table-content";
import type { ExpandableDataTable } from "./expansion";

import { Empty, EmptyContent, EmptyHeader, EmptyMedia } from "../ui/empty";
import { TableBody, TableCell, TableRow } from "../ui/table";
import { alignClassName } from "./align";
import { ExpandedRowDataTable } from "./expansion";
import { NoResultsDataTable } from "./no-results";
import { RowSelectableDataTable } from "./selection";

const INTERACTIVE_TARGET = "a,button,input,select,textarea,[role=checkbox]";

const isInsideControl = (target: EventTarget) =>
  Boolean((target as HTMLElement).closest(INTERACTIVE_TARGET));

const cellContentOf = <T extends DataTableTMin>(
  column: ColumnDef<T>,
  row: T,
  rows: T[],
): React.ReactNode => {
  if (column.cell) {
    return column.cell({ allData: rows, row });
  }
  if (column.accessorKey != null) {
    return String(row[column.accessorKey]);
  }

  return "";
};

const OpenableRowDataTable = <T extends DataTableTMin>({
  children,
  row,
  rowOpens,
}: {
  children: React.ReactNode;
  row: T;
  rowOpens?: (row: T) => void;
}) => {
  if (!rowOpens) {
    return <TableRow>{children}</TableRow>;
  }

  return (
    <TableRow
      className="focus-visible:bg-muted/50 focus-visible:outline-ring active:not-has-[:is(a,button,input,label,select,textarea):active]:bg-muted cursor-pointer focus-visible:outline-1"
      onClick={event => {
        // A control inside the row answers for itself,
        // and a reader who has selected text in a cell
        // was reading it rather than asking to leave.
        if (isInsideControl(event.target)) {
          return;
        }
        if (window.getSelection()?.toString()) {
          return;
        }
        rowOpens(row);
      }}
      onKeyDown={event => {
        if (isInsideControl(event.target)) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          rowOpens(row);
        }
      }}
      tabIndex={0}
    >
      {children}
    </TableRow>
  );
};

export const RowDataTable = <T extends DataTableTMin>({
  columns,
  expandable,
  expanded,
  expandedId,
  row,
  rowOpens,
  rows,
  selectable,
}: {
  columns: ColumnDef<T>[];
  expandable?: ExpandableDataTable<T>;
  expanded: boolean;
  expandedId: string;
  row: T;
  rowOpens?: (row: T) => void;
  rows: T[];
  selectable: boolean;
}) => {
  const cells = columns.map(column => (
    <TableCell
      // The column's own class reaches the cell as well as the
      // head. It reached the head alone, so a caller could
      // neither align a value under its own header nor let a
      // long name wrap, and both had to be redone on an element
      // inside the cell.
      className={cn(alignClassName(column.align), column.className)}
      key={`${row.id}_${column.id ?? String(column.accessorKey)}`}
    >
      {cellContentOf(column, row, rows)}
    </TableCell>
  ));

  return (
    <>
      {selectable ? (
        <RowSelectableDataTable id={row.id}>{cells}</RowSelectableDataTable>
      ) : (
        <OpenableRowDataTable row={row} rowOpens={rowOpens}>
          {cells}
        </OpenableRowDataTable>
      )}
      {expandable && (
        <AnimatePresence initial={false}>
          {expanded && (
            <ExpandedRowDataTable
              colSpan={columns.length}
              id={expandedId}
              key="expanded"
            >
              {expandable.render(row)}
            </ExpandedRowDataTable>
          )}
        </AnimatePresence>
      )}
    </>
  );
};

export const EmptyBodyDataTable = ({
  colSpan,
  customNoResults,
}: {
  colSpan: number;
  customNoResults: DataTableProps<DataTableTMin>["customNoResults"];
}) => (
  <TableBody>
    <TableRow className="hover:bg-transparent">
      <TableCell className="!p-0 whitespace-normal" colSpan={colSpan}>
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
  </TableBody>
);
