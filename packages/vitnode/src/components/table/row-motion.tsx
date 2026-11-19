import type React from "react";

import { cn } from "cn";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useState } from "react";

import type { DataTableRowId } from "./data-table-content";

import { TableRow } from "../ui/table";

const MotionTableRow = m.create(TableRow);

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export interface RowMotionDataTable {
  entering: boolean;
}

export const enteringRowIdsDataTable = (
  previous: readonly DataTableRowId[],
  next: readonly DataTableRowId[],
): ReadonlySet<DataTableRowId> => {
  const before = new Set(previous);

  return new Set(next.filter(id => !before.has(id)));
};

export const useEnteringRowIdsDataTable = (
  rowIds: readonly DataTableRowId[],
): ReadonlySet<DataTableRowId> => {
  const [previousRowIds, setPreviousRowIds] = useState(rowIds);
  const [entering, setEntering] = useState<ReadonlySet<DataTableRowId>>(
    () => new Set(),
  );

  if (previousRowIds !== rowIds) {
    setPreviousRowIds(rowIds);
    setEntering(enteringRowIdsDataTable(previousRowIds, rowIds));
  }

  return entering;
};

export const AnimatedTableRow = ({
  className,
  motion,
  ...props
}: Omit<
  React.ComponentProps<typeof TableRow>,
  | "onAnimationEnd"
  | "onAnimationIteration"
  | "onAnimationStart"
  | "onDrag"
  | "onDragEnd"
  | "onDragStart"
> & {
  motion?: RowMotionDataTable;
}) => {
  const shouldReduceMotion = useReducedMotion();

  if (!motion || shouldReduceMotion) {
    return <TableRow className={className} {...props} />;
  }

  return (
    <MotionTableRow
      {...props}
      animate={{ opacity: 1 }}
      className={cn(
        "bg-card border-b-0 shadow-[inset_0_-1px_0_var(--color-border)] last:shadow-none",
        className,
      )}
      initial={motion.entering ? { opacity: 0 } : false}
      layout="position"
      transition={{
        layout: { type: "spring", duration: 0.35, bounce: 0 },
        opacity: { duration: 0.25, ease: EASE_OUT },
      }}
    />
  );
};
