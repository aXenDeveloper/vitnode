const KB = 1000;
const MB = KB * 1000;
const GB = MB * 1000;

/**
 * Bytes as a developer reads them in a build report.
 *
 * Decimal units, like Vite, Rollup and every browser's network panel, so the
 * numbers here match the numbers anywhere else the same file shows up. A value
 * that would round up to the next unit is printed in it - `999_999` is
 * `1.0 MB`, never `1000.0 kB`.
 */
export const formatBytes = (bytes: number): string => {
  const abs = Math.abs(bytes);
  const sign = bytes < 0 ? "-" : "";

  if (abs < KB) return `${sign}${String(Math.round(abs))} B`;
  if (Math.round((abs / KB) * 10) / 10 < 1000) {
    return `${sign}${(abs / KB).toFixed(1)} kB`;
  }
  if (Math.round((abs / MB) * 10) / 10 < 1000) {
    return `${sign}${(abs / MB).toFixed(1)} MB`;
  }

  return `${sign}${(abs / GB).toFixed(1)} GB`;
};

/** A size change, always signed: `+4.2 kB`, `-12.8 kB`, `0 B`. */
export const formatByteDelta = (bytes: number): string =>
  bytes > 0 ? `+${formatBytes(bytes)}` : formatBytes(bytes);

/** A ratio change, always signed: `+2.3%`. */
export const formatPercentDelta = (ratio: number): string => {
  const percent = (ratio * 100).toFixed(1);

  return ratio > 0 ? `+${percent}%` : `${percent}%`;
};

export const formatPercent = (ratio: number): string =>
  `${(ratio * 100).toFixed(1)}%`;

/** `840ms`, `6.8s`, `1m 12s`. */
export const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${String(Math.round(ms))}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;

  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);

  return `${String(minutes)}m ${String(seconds)}s`;
};

/** `1 plugin`, `3 plugins`. */
export const plural = (count: number, singular: string, many?: string) =>
  `${String(count)} ${count === 1 ? singular : (many ?? `${singular}s`)}`;

/** A path for display: forward slashes on every platform. */
export const toDisplayPath = (path: string): string =>
  path.replaceAll("\\", "/");
