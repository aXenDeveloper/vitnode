import type { LucideIcon } from "lucide-react";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

export const THEME_OPTIONS = [
  { Icon: SunIcon, value: "light" },
  { Icon: MoonIcon, value: "dark" },
  { Icon: MonitorIcon, value: "system" },
] as const satisfies readonly { Icon: LucideIcon; value: string }[];

export const themeActiveIndex = (theme: string | undefined): number =>
  THEME_OPTIONS.findIndex(option => option.value === theme);

export const themeSegmentsClassName =
  "bg-muted relative grid grid-cols-3 gap-1 rounded-lg p-1";

export const themeIndicatorClassName =
  "bg-background dark:border-input dark:bg-input/30 pointer-events-none absolute top-0 left-0 rounded-md border border-transparent opacity-0 shadow-sm";

export const themeSegmentClassName =
  "text-muted-foreground relative flex h-12 min-w-0 cursor-default touch-manipulation flex-col items-center justify-center gap-1 rounded-md px-1 text-xs font-medium outline-none transition-colors duration-150 select-none [&_svg]:size-4 [&_svg]:shrink-0";

export const themeSegmentPressedClassName =
  "aria-pressed:text-foreground focus-visible:ring-ring/50 cursor-pointer focus-visible:ring-2";

export const themeSegmentCheckedClassName =
  "data-checked:text-foreground data-highlighted:text-foreground focus-visible:ring-ring/50 focus-visible:ring-2";
