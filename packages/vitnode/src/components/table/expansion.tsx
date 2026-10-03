import { cn } from "cn";
import { ChevronRightIcon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import React from "react";
import { useTranslations } from "use-intl";

import { MotionFeatures } from "../motion-features";
import { Button } from "../ui/button";
import { TableCell, TableRow } from "../ui/table";

export interface ExpandableDataTable<T> {
  canExpand?: (row: T) => boolean;
  defaultExpanded?: number[];
  render: (row: T) => React.ReactNode;
}

export const useRowExpansionDataTable = ({
  defaultExpanded,
  rowIds,
}: {
  defaultExpanded?: number[];
  rowIds: number[];
}) => {
  const [expanded, setExpanded] = React.useState<number[]>(
    defaultExpanded ?? [],
  );
  const pageKey = rowIds.join(",");
  const [prevPageKey, setPrevPageKey] = React.useState(pageKey);

  if (pageKey !== prevPageKey) {
    setPrevPageKey(pageKey);
    const visibleIds = new Set(rowIds);
    setExpanded(current => {
      const next = current.filter(id => visibleIds.has(id));

      return next.length === current.length ? current : next;
    });
  }

  const isExpanded = React.useCallback(
    (id: number) => expanded.includes(id),
    [expanded],
  );

  const toggle = React.useCallback((id: number) => {
    setExpanded(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id],
    );
  }, []);

  return { isExpanded, toggle };
};

export function ExpandHeaderDataTable() {
  const t = useTranslations("core.global.data_table");

  return <span className="sr-only">{t("row_details")}</span>;
}

export function ExpandToggleDataTable({
  controls,
  expanded,
  onToggle,
}: {
  controls: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("core.global.data_table");

  return (
    <Button
      aria-controls={controls}
      aria-expanded={expanded}
      aria-label={expanded ? t("collapse_row") : t("expand_row")}
      className="-ms-1.5"
      onClick={onToggle}
      size="icon-sm"
      variant="ghost"
    >
      <ChevronRightIcon
        aria-hidden="true"
        className={cn(
          "transition-transform duration-200 ease-out motion-reduce:transition-none",
          expanded ? "rotate-90" : "rtl:rotate-180",
        )}
      />
    </Button>
  );
}

export function ExpandedRowDataTable({
  children,
  colSpan,
  id,
}: {
  children: React.ReactNode;
  colSpan: number;
  id: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const collapsed = shouldReduceMotion
    ? { opacity: 0 }
    : { height: 0, opacity: 0 };

  return (
    <TableRow className="bg-muted/30 hover:bg-muted/30">
      <TableCell className="p-0! whitespace-normal" colSpan={colSpan}>
        <MotionFeatures>
          <m.div
            animate={{ height: "auto", opacity: 1 }}
            className="sticky start-0 w-[100cqi] overflow-hidden"
            data-testid="table-expanded-row"
            exit={collapsed}
            id={id}
            initial={collapsed}
            transition={{
              height: { type: "spring", duration: 0.3, bounce: 0 },
              opacity: { duration: 0.2, ease: "easeOut" },
            }}
          >
            <div className="px-4 py-4 sm:px-6">{children}</div>
          </m.div>
        </MotionFeatures>
      </TableCell>
    </TableRow>
  );
}
