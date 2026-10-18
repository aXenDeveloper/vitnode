import React from "react";
import { useTranslations } from "use-intl";

import type { DataTableTMin } from "./data-table-content";

export const SortableRowHandleContext =
  React.createContext<null | React.ReactElement>(null);

export const ROW_GROUP_CLASS =
  "[&:last-child>tr:last-child]:border-0 [&:last-child>tr:last-child>td]:border-b-0 [&>tr>td]:border-b";

export function ReorderHeaderDataTable() {
  const t = useTranslations("core.global.data_table");

  return <span className="sr-only">{t("reorder_column")}</span>;
}

export function ReorderHandleDataTable() {
  return <>{React.use(SortableRowHandleContext)}</>;
}

// Holds the handle's place, so rows keep their height while the drag-and-drop
// chunk loads.
const HANDLE_PLACEHOLDER = (
  <span aria-hidden="true" className="-ms-1.5 inline-flex size-8" />
);

/**
 * What a reorderable table shows until its drag-and-drop chunk arrives: the
 * same row groups and the same first column, only not draggable yet.
 */
export const ReorderFallbackBodyDataTable = <T extends DataTableTMin>({
  renderRow,
  rows,
}: {
  renderRow: (row: T) => React.ReactNode;
  rows: T[];
}) => (
  <SortableRowHandleContext value={HANDLE_PLACEHOLDER}>
    {rows.map(row => (
      <tbody
        className={ROW_GROUP_CLASS}
        data-slot="table-row-group"
        key={row.id}
      >
        {renderRow(row)}
      </tbody>
    ))}
  </SortableRowHandleContext>
);
