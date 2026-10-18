import type { DataTableRowId } from "./data-table-content";

import { readTableOrder, readTableSearch, type TableOrder } from "./url-state";

/** One drag, as `onReorder` receives it. Indexes are positions on the current page. */
export interface ReorderDetailsDataTable {
  /** The dragged row. */
  activeId: DataTableRowId;
  from: number;
  /** The row it was dropped on. */
  overId: DataTableRowId;
  to: number;
}

/** A drag plus the page's row ids in their new order. */
export interface RowMoveDataTable extends ReorderDetailsDataTable {
  ids: DataTableRowId[];
}

// Local rather than dnd-kit's `arrayMove`, so a table that never reorders
// does not pull `@dnd-kit/sortable` into its bundle.
const arrayMove = <T>(items: readonly T[], from: number, to: number): T[] => {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);

  return next;
};

/** Moves `activeId` to `overId`'s position; `null` when either is missing or they are the same row. */
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
    ids: arrayMove(ids, from, to),
    overId,
    to,
  };
};

/**
 * Whether the table shows rows in their stored order - no search, no filter
 * and the default sort - which is the only time dragging can mean anything.
 */
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
