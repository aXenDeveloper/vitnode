import type {
  AdminDashboardWidgetRows,
  AdminDashboardWidgetSpan,
} from "../widgets/types";

export const spanClasses: Record<AdminDashboardWidgetSpan, string> = {
  1: "md:col-span-1",
  2: "md:col-span-2",
  3: "md:col-span-2 xl:col-span-3",
};

export const rowsClasses: Record<AdminDashboardWidgetRows, string> = {
  1: "min-h-56",
  2: "min-h-80",
  3: "min-h-112",
};

export const gridClasses =
  "grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3";
