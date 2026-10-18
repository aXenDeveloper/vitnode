import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { DataTableRowId, DataTableTMin } from "./data-table-content";

import { moveRowId, type ReorderDetailsDataTable } from "./reorder-state";

type RowIdOf<T> = T extends { id: infer TId } ? TId : DataTableRowId;

/**
 * Drag-to-reorder rows, by pointer, touch (press and hold) or keyboard, with
 * screen-reader announcements. Dragging is turned off while the table is
 * searched, filtered or sorted by anything but its `defaultOrder`.
 */
export interface ReorderableDataTable<T> {
  /** Turns dragging off; the handles stay, disabled, with an explanation. */
  disabled?: boolean;
  /** The row's name in the drag handle's label and in announcements. Defaults to its position. */
  getRowLabel?: (row: T) => string;
  /**
   * Saves the page's new order, given every row id on the page in that order.
   * The table shows the new order at once; if this throws or rejects, it goes
   * back and shows an error toast.
   */
  onReorder: (
    ids: RowIdOf<T>[],
    details: ReorderDetailsDataTable,
  ) => Promise<void> | void;
}

interface RowOrderOverride {
  ids: DataTableRowId[];
  key: string;
}

/** The rows in their optimistic order, and the move that persists through `onReorder`. */
export const useRowOrderDataTable = <T extends DataTableTMin>({
  edges,
  onReorder,
}: {
  edges: T[];
  onReorder?: ReorderableDataTable<T>["onReorder"];
}) => {
  const t = useTranslations("core.global.data_table");
  const [override, setOverride] = React.useState<null | RowOrderOverride>(null);
  const unfailedAttemptsRef = React.useRef<RowOrderOverride[]>([]);
  // Memoized so `rows` keeps its identity between renders, which lets the
  // table's selection and expansion contexts stay put.
  const { ids, rows, serverKey } = React.useMemo(() => {
    const serverIds = edges.map(row => row.id);
    const key = serverIds.join(",");
    if (override?.key !== key) {
      return { ids: serverIds, rows: edges, serverKey: key };
    }

    const byId = new Map(edges.map(row => [row.id, row]));

    return {
      ids: override.ids,
      rows: override.ids.flatMap(id => {
        const row = byId.get(id);

        return row ? [row] : [];
      }),
      serverKey: key,
    };
  }, [edges, override]);

  const reorder = (activeId: DataTableRowId, overId: DataTableRowId) => {
    const move = moveRowId(ids, activeId, overId);
    if (!move || !onReorder) return;

    const attempt: RowOrderOverride = { ids: move.ids, key: serverKey };
    unfailedAttemptsRef.current = [...unfailedAttemptsRef.current, attempt];
    setOverride(attempt);

    const persist = async () => {
      try {
        await onReorder(move.ids as RowIdOf<T>[], {
          activeId: move.activeId,
          from: move.from,
          overId: move.overId,
          to: move.to,
        });
        const position = unfailedAttemptsRef.current.indexOf(attempt);
        if (position > 0) {
          unfailedAttemptsRef.current =
            unfailedAttemptsRef.current.slice(position);
        }
      } catch {
        unfailedAttemptsRef.current = unfailedAttemptsRef.current.filter(
          pending => pending !== attempt,
        );
        setOverride(unfailedAttemptsRef.current.at(-1) ?? null);
        toast.error(t("reorder_failed"), {
          description: t("reorder_failed_desc"),
        });
      }
    };

    void persist();
  };

  return { reorder, rows };
};
