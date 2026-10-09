import type React from "react";

import type { DataTableTMin } from "./data-table-content";

import { TableHead, TableRow } from "../ui/table";

export interface GroupByDataTable<T extends DataTableTMin> {
  key: (row: T) => string;
  label?: (group: GroupDataTable<T>) => React.ReactNode;
}

export interface GroupDataTable<T extends DataTableTMin> {
  key: string;
  rows: T[];
}

export const groupRowsDataTable = <T extends DataTableTMin>(
  rows: T[],
  keyOf: (row: T) => string,
): GroupDataTable<T>[] => {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return [...groups.entries()].map(([key, groupRows]) => ({
    key,
    rows: groupRows,
  }));
};

export const GroupHeadingRowDataTable = <T extends DataTableTMin>({
  colSpan,
  group,
  label,
}: {
  colSpan: number;
  group: GroupDataTable<T>;
  label?: GroupByDataTable<T>["label"];
}) => (
  <TableRow className="bg-muted/40 hover:bg-muted/40">
    <TableHead className="h-9" colSpan={colSpan} scope="rowgroup">
      <span className="flex items-center gap-2">
        <span className="min-w-0 truncate">{label?.(group) ?? group.key}</span>
        <span className="text-muted-foreground font-normal tabular-nums">
          {group.rows.length}
        </span>
      </span>
    </TableHead>
  </TableRow>
);
