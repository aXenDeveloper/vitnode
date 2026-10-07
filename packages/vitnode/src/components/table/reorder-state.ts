import { arrayMove } from "@dnd-kit/sortable";

import type { DataTableRowId } from "./data-table-content";

import { readTableOrder, readTableSearch, type TableOrder } from "./url-state";

export interface ReorderDetailsDataTable {
  activeId: DataTableRowId;
  from: number;
  overId: DataTableRowId;
  to: number;
}

export interface RowMoveDataTable extends ReorderDetailsDataTable {
  ids: DataTableRowId[];
}

export const moveRowId = (
  ids: readonly DataTableRowId[],
  activeId: DataTableRowId,
  overId: DataTableRowId,
): null | RowMoveDataTable => {
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);

  if (from === -1 || to === -1 || from === to) return null;

  return {
    activeId,
    from,
    ids: arrayMove([...ids], from, to),
    overId,
    to,
  };
};

export const isTableInStoredOrder = (
  searchParams: URLSearchParams,
  {
    defaultOrder,
    filterIds,
  }: {
    defaultOrder: TableOrder;
    filterIds: readonly string[];
  },
): boolean => {
  if (readTableSearch(searchParams).trim() !== "") return false;
  if (filterIds.some(id => searchParams.get(id))) return false;

  const ordered = readTableOrder(searchParams, defaultOrder);

  return (
    ordered.column === defaultOrder.column &&
    ordered.order === defaultOrder.order
  );
};
