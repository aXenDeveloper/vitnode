import type { FileCategory } from "./output-files";

export type SizeSeverity = "good" | "large" | "normal" | "warning";

/**
 * Upper bounds (inclusive, raw bytes on disk) for `good`, `normal` and
 * `warning`; anything above the last is `large`.
 *
 * Different per category on purpose. Client JavaScript is downloaded, parsed
 * and executed on every device that opens the page, so it is held to the
 * tightest budget - and its `large` line is Vite's own 500 kB chunk warning.
 * A stylesheet blocks rendering, so it is next. A server bundle is read once
 * from a local disk at boot; it gets thresholds an order of magnitude looser,
 * and no warnings at all.
 *
 * These are recommendations. A file over any of them never fails a build.
 */
export const SIZE_THRESHOLDS: Record<
  FileCategory,
  { good: number; normal: number; warning: number }
> = {
  asset: { good: 100_000, normal: 500_000, warning: 1_000_000 },
  "client-js": { good: 100_000, normal: 250_000, warning: 500_000 },
  css: { good: 50_000, normal: 100_000, warning: 250_000 },
  other: { good: 100_000, normal: 500_000, warning: 1_000_000 },
  server: { good: 1_000_000, normal: 5_000_000, warning: 20_000_000 },
};

export const classifySize = (
  category: FileCategory,
  bytes: number,
): SizeSeverity => {
  const limits = SIZE_THRESHOLDS[category];

  if (bytes <= limits.good) return "good";
  if (bytes <= limits.normal) return "normal";
  if (bytes <= limits.warning) return "warning";

  return "large";
};

/** Whether a file of this category and severity deserves a build warning. */
export const needsWarning = (
  category: FileCategory,
  severity: SizeSeverity,
): boolean => {
  if (category === "server") return false;
  if (category === "client-js") {
    return severity === "warning" || severity === "large";
  }

  return severity === "large";
};
