"use client";

import { XIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import React from "react";
import { createPortal } from "react-dom";

import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Separator } from "../ui/separator";
import { TableRow } from "../ui/table";
import { TooltipWithContent } from "../ui/tooltip";

export interface SelectionDataTable {
  allSelected: boolean;
  clear: () => void;
  isSelected: (id: number) => boolean;
  selected: number[];
  someSelected: boolean;
  toggle: (id: number) => void;
  toggleAll: (next: boolean) => void;
}

const SelectionContext = React.createContext<null | SelectionDataTable>(null);

/** `body` never changes, so there is nothing to subscribe to. */
const subscribeToNothing = () => () => undefined;
const getPortalContainer = () => document.body;
/** No DOM to portal into on the server, and the bar starts empty anyway. */
const getNoPortalContainer = () => null;

/**
 * The rows a bulk action is about.
 *
 * Only usable inside a `DataTable` given `bulkActions`: the bar that renders
 * those actions sits inside this provider, so an action component reads the
 * ticked ids straight from here instead of the table having to thread them
 * through a node it was handed.
 */
export const useDataTableSelection = (): SelectionDataTable => {
  const value = React.use(SelectionContext);

  if (!value) {
    throw new Error(
      "useDataTableSelection must be rendered inside a DataTable with `bulkActions`.",
    );
  }

  return value;
};

export function SelectionProviderDataTable({
  children,
  rowIds,
}: {
  children: React.ReactNode;
  rowIds: number[];
}) {
  const [selected, setSelected] = React.useState<number[]>([]);
  const pageKey = rowIds.join(",");
  const [prevPageKey, setPrevPageKey] = React.useState(pageKey);

  if (pageKey !== prevPageKey) {
    setPrevPageKey(pageKey);
    setSelected(current => {
      const next = current.filter(id => rowIds.includes(id));

      return next.length === current.length ? current : next;
    });
  }

  const value = React.useMemo<SelectionDataTable>(() => {
    const selectedSet = new Set(selected);

    return {
      allSelected: rowIds.length > 0 && selectedSet.size === rowIds.length,
      clear: () => setSelected([]),
      isSelected: id => selectedSet.has(id),
      selected,
      someSelected: selectedSet.size > 0 && selectedSet.size < rowIds.length,
      toggle: id =>
        setSelected(current =>
          current.includes(id)
            ? current.filter(item => item !== id)
            : [...current, id],
        ),
      toggleAll: next => setSelected(next ? [...rowIds] : []),
    };
  }, [rowIds, selected]);

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

export function SelectAllDataTable() {
  const t = useTranslations("core.global.data_table");
  const { allSelected, someSelected, toggleAll } = useDataTableSelection();

  return (
    <Checkbox
      aria-label={t("select_all")}
      checked={allSelected}
      indeterminate={someSelected}
      onCheckedChange={checked => toggleAll(checked)}
    />
  );
}

export function SelectRowDataTable({ id }: { id: number }) {
  const t = useTranslations("core.global.data_table");
  const { isSelected, toggle } = useDataTableSelection();

  return (
    <Checkbox
      aria-label={t("select_row")}
      checked={isSelected(id)}
      onCheckedChange={() => toggle(id)}
    />
  );
}

export function RowSelectableDataTable({
  children,
  id,
}: {
  children: React.ReactNode;
  id: number;
}) {
  const { isSelected } = useDataTableSelection();

  return (
    <TableRow data-state={isSelected(id) ? "selected" : undefined}>
      {children}
    </TableRow>
  );
}

export function BulkActionsDataTable({
  actions,
}: {
  actions: React.ReactNode;
}) {
  const t = useTranslations("core.global");
  const { clear, selected } = useDataTableSelection();
  const shouldReduceMotion = useReducedMotion();
  const container = React.useSyncExternalStore(
    subscribeToNothing,
    getPortalContainer,
    getNoPortalContainer,
  );

  if (!container) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {selected.length > 0 && (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          exit={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
          transition={{ type: "spring", duration: 0.3, bounce: 0 }}
        >
          <div className="bg-popover text-popover-foreground pointer-events-auto flex max-w-full items-center gap-1 rounded-lg border p-1.5 shadow-lg">
            <span className="px-2 text-sm font-medium whitespace-nowrap">
              {t("selected_count", { count: selected.length })}
            </span>

            <Separator className="mx-0.5 h-6" orientation="vertical" />

            {actions}

            <Separator className="mx-0.5 h-6" orientation="vertical" />

            <TooltipWithContent text={t("data_table.clear_selection")}>
              <Button
                aria-label={t("data_table.clear_selection")}
                onClick={clear}
                size="icon-sm"
                variant="ghost"
              >
                <XIcon />
              </Button>
            </TooltipWithContent>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    container,
  );
}
