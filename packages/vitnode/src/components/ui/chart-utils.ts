import type {
  ChartColorOptions,
  ChartMotionSpringTransition,
} from "@tanstack/charts";

import type { ChartConfig } from "./chart";

export const chartColorKeys = (config: ChartConfig) =>
  Object.entries(config)
    .filter(([, item]) => item.theme ?? item.color)
    .map(([key]) => key);

export const chartColor = (config: ChartConfig): ChartColorOptions => {
  const domain = chartColorKeys(config);

  return { domain, range: domain.map(key => `var(--color-${key})`) };
};

export const chartTooltipMotion = {
  damping: 40,
  mass: 1,
  stiffness: 400,
  type: "spring",
} as const satisfies ChartMotionSpringTransition;
