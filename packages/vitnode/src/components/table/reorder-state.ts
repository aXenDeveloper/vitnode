import { arrayMove } from "@dnd-kit/sortable";

import { readTableOrder, readTableSearch, type TableOrder } from "./url-state";

export interface ReorderDetailsDataTable {
  activeId: number;
  from: number;
  overId: number;
  to: number;
}

export interface RowMoveDataTable extends ReorderDetailsDataTable {
  ids: number[];
}

export const moveRowId = (
  ids: readonly number[],
  activeId: number,
  overId: number,
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
