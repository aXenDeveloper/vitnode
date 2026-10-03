import { cn } from "cn";

import type { AlignDataTable } from "./data-table-content";

/**
 * ALIGNMENT WITHOUT LEAVING TABLE LAYOUT. This was `flex`, which takes a cell
 * out of the row: two adjacent aligned columns were then wrapped in one
 * anonymous cell and rendered one above the other. Measured at 1440 with
 * Matched beside Checked on `/app/narrations`; the styleguide sample aligns a
 * single column, which is why it had never shown.
 */
export const alignClassName = (align?: AlignDataTable) =>
  cn({
    "text-center": align === "center",
    "text-right": align === "right",
  });
