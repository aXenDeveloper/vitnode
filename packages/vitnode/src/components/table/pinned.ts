import { cn } from "cn";

import type { ColumnDef, DataTableTMin } from "./data-table-content";

export const isPinnedColumn = <T extends DataTableTMin>(column: ColumnDef<T>) =>
  column.id === "actions";

const PINNED_EDGE_CLASS_NAME = cn(
  "bg-card sticky end-0 z-10 bg-linear-to-r",
  "inset-shadow-[0_-1px_0_var(--color-border)] [tbody>tr:last-child>&]:inset-shadow-none",
  "[@container_data-table_scroll-state(scrollable:inline-end)]:shadow-[inset_1px_0_0_var(--color-border)]",
  "rtl:[@container_data-table_scroll-state(scrollable:inline-end)]:shadow-[inset_-1px_0_0_var(--color-border)]",
);

export const pinnedHeadClassName = cn(
  PINNED_EDGE_CLASS_NAME,
  "from-muted/60 to-muted/60",
);

export const pinnedCellClassName = cn(
  PINNED_EDGE_CLASS_NAME,
  "[tr:hover>&]:from-muted/50 [tr:hover>&]:to-muted/50",
  "[tr:has([aria-expanded=true])>&]:from-muted/50 [tr:has([aria-expanded=true])>&]:to-muted/50",
  "[tr[data-state=selected]>&]:from-primary/15 [tr[data-state=selected]>&]:to-primary/15",
  "[tr[data-state=selected]:hover>&]:from-primary/20 [tr[data-state=selected]:hover>&]:to-primary/20",
);
