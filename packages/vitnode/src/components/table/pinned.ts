import { cn } from "cn";

import type { ColumnDef, DataTableTMin } from "./data-table-content";

export const isPinnedColumn = <T extends DataTableTMin>(column: ColumnDef<T>) =>
  column.id === "actions";

const PINNED_EDGE_CLASS_NAME = cn(
  "bg-card sticky end-0 z-10 bg-linear-to-r",
  "before:pointer-events-none before:absolute before:end-full before:top-0 before:bottom-px before:w-(--scroll-fade-e) before:[background:inherit]",
  "before:[mask-image:linear-gradient(to_left,#000,transparent)] rtl:before:[mask-image:linear-gradient(to_right,#000,transparent)]",
  "before:[--_scroll-fade-size-e:calc(var(--spacing)*10)]",
  "supports-[animation-timeline:scroll()]:before:[animation-duration:1ms] supports-[animation-timeline:scroll()]:before:[animation-name:scroll-fade-reveal-e]",
  "supports-[animation-timeline:scroll()]:before:[animation-fill-mode:both] supports-[animation-timeline:scroll()]:before:[animation-timeline:scroll(nearest_inline)]",
  "supports-[animation-timeline:scroll()]:before:[animation-range:calc(100%_-_var(--scroll-fade-reveal,calc(var(--spacing)*24)))_100%]",
);

export const pinnedHeadClassName = cn(
  PINNED_EDGE_CLASS_NAME,
  "from-muted/60 to-muted/60",
);

// Body cells only: a sticky `td` paints over its row's border and redraws it,
// while a `th`'s border stays visible and would be drawn twice.
export const pinnedCellClassName = cn(
  PINNED_EDGE_CLASS_NAME,
  "inset-shadow-[0_-1px_0_var(--color-border)] [tbody>tr:last-child>&]:inset-shadow-none",
  "[tr:hover>&]:from-muted/50 [tr:hover>&]:to-muted/50",
  "[tr:has([aria-expanded=true])>&]:from-muted/50 [tr:has([aria-expanded=true])>&]:to-muted/50",
  "[tr[data-state=selected]>&]:from-primary/15 [tr[data-state=selected]>&]:to-primary/15",
  "[tr[data-state=selected]:hover>&]:from-primary/20 [tr[data-state=selected]:hover>&]:to-primary/20",
);
