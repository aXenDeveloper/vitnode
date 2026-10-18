import { XIcon } from "lucide-react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import React from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "use-intl";

import type { DataTableRowId } from "./data-table-content";

import { MotionFeatures } from "../motion-features";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Separator } from "../ui/separator";
import { SlidingNumber } from "../ui/sliding-number";
import { TableRow } from "../ui/table";
import { TooltipWithContent } from "../ui/tooltip";

/**
 * Row selection on the current page, from {@link useDataTableSelection}.
 * Selection never spans pages: ids that leave the page are dropped.
 */
export interface SelectionDataTable {
  /** Every row on the page is selected (and there is at least one). */
  allSelected: boolean;
  clear: () => void;
  isSelected: (id: DataTableRowId) => boolean;
  /** The selected row ids. */
  selected: DataTableRowId[];
  /** Some, but not all, rows are selected. */
  someSelected: boolean;
  toggle: (id: DataTableRowId) => void;
  /** Selects every row on the page (`true`) or none (`false`). */
  toggleAll: (next: boolean) => void;
}

const SelectionContext = React.createContext<null | SelectionDataTable>(null);

/** `body` never changes, so there is nothing to subscribe to. */
const subscribeToNothing = () => () => undefined;
const getPortalContainer = () => document.body;
/** No DOM to portal into on the server, and the bar starts empty anyway. */
const getNoPortalContainer = () => null;

/**
 * The table's row selection, for the buttons passed as `ContentDataTable`'s
 * `bulkActions` - e.g. a delete action reading `selected`.
 *
 * @throws Outside a `ContentDataTable` that has `bulkActions`.
 *
 * @example
 * ```tsx
 * import { useDataTableSelection } from "@vitnode/core/components/table/selection";
 * import { Button } from "@vitnode/core/components/ui/button";
 *
 * const DeleteSelected = ({ onDelete }: { onDelete: (ids: number[]) => void }) => {
 *   const { clear, selected } = useDataTableSelection();
 *
 *   return (
 *     <Button
 *       onClick={() => {
 *         onDelete(selected.filter(id => typeof id === "number"));
 *         clear();
 *       }}
 *     >
 *       Delete
 *     </Button>
 *   );
 * };
 * ```
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

/** Holds the selection for one page of rows. `ContentDataTable` mounts it for `bulkActions`. */
export function SelectionProviderDataTable({
  children,
  rowIds,
}: {
  children: React.ReactNode;
  rowIds: DataTableRowId[];
}) {
  const [selected, setSelected] = React.useState<DataTableRowId[]>([]);
  const pageKey = rowIds.join(",");
  const [prevPageKey, setPrevPageKey] = React.useState(pageKey);

  if (pageKey !== prevPageKey) {
    setPrevPageKey(pageKey);
    const visibleIds = new Set(rowIds);
    setSelected(current => {
      const next = current.filter(id => visibleIds.has(id));

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

/** The header checkbox: selects every row on the page, indeterminate when only some are. */
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
export function SelectRowDataTable({ id }: { id: DataTableRowId }) {
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

/** A row marked `data-state="selected"` while it is selected. */
export function RowSelectableDataTable({
  children,
  id,
}: {
  children: React.ReactNode;
  id: DataTableRowId;
}) {
  const { isSelected } = useDataTableSelection();

  return (
    <TableRow data-state={isSelected(id) ? "selected" : undefined}>
      {children}
    </TableRow>
  );
}

/**
 * The floating bar at the bottom of the viewport while rows are selected: the
 * count, `actions`, and a button that clears the selection. Rendered into
 * `document.body`, and only in the browser.
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
    <MotionFeatures>
      <AnimatePresence>
        {selected.length > 0 && (
          <m.div
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            exit={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
          >
            <div className="bg-popover text-popover-foreground pointer-events-auto flex max-w-full items-center gap-1 rounded-xl border p-1.5 shadow-lg">
              <span className="px-2 text-sm font-medium whitespace-nowrap">
                {t.rich("selected_count", {
                  count: selected.length,
                  number: () => <SlidingNumber value={selected.length} />,
                })}
              </span>

              <Separator
                className="mx-0.5 data-[orientation=vertical]:h-6"
                orientation="vertical"
              />

              {actions}

              <Separator
                className="mx-0.5 data-[orientation=vertical]:h-6"
                orientation="vertical"
              />

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
          </m.div>
        )}
      </AnimatePresence>
    </MotionFeatures>,
    container,
  );
}
