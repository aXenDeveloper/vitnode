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
  /** Every row on the page is ticked - what the header checkbox shows. */
  allSelected: boolean;
  clear: () => void;
  isSelected: (id: number) => boolean;
  /** The ticked ids, in the order they were ticked. */
  selected: number[];
  /** Some but not all of them: the header checkbox's indeterminate state. */
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

/**
 * Holds which rows are ticked, for one page of one table.
 *
 * `rowIds` is the page as the server just rendered it, and the selection is
 * pruned to it on every change.
 */
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
    // Pruned, not cleared. Paging or searching replaces the ids outright, so
    // the selection empties on its own - but a bulk action that only partly
    // went through leaves exactly the rows it could not do still on screen and
    // still ticked, which is the answer the person needs.
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

/** The header checkbox: ticks or unticks the whole page. */
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

/** One row's checkbox. */
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

/** A `TableRow` that shades itself while its row is ticked. */
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

/**
 * The bar that floats at the bottom of the viewport while rows are ticked.
 *
 * Rendered into `body` rather than in place: `position: fixed` is measured
 * against the nearest ancestor with a transform or a filter, and a table can
 * easily sit inside one (the AdminCP shell animates its sidebar), which would
 * pin the bar to the middle of the page instead of the screen.
 */
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
          // Below the `z-50` overlays, so a confirmation opened from the bar
          // covers it rather than fighting it.
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
