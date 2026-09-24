import type {
  AdminDashboardWidgetRows,
  AdminDashboardWidgetSpan,
} from "../widgets/types";

export const WIDGET_SPANS = [
  1, 2, 3,
] as const satisfies readonly AdminDashboardWidgetSpan[];

export const WIDGET_ROWS = [
  1, 2, 3,
] as const satisfies readonly AdminDashboardWidgetRows[];

export interface WidgetSize {
  rows: AdminDashboardWidgetRows;
  span: AdminDashboardWidgetSpan;
}

export interface GridMetrics {
  columns: number;
  gap: number;
  rowHeights: Readonly<Record<AdminDashboardWidgetRows, number>>;
  track: number;
}

const spanWidth = (span: number, { gap, track }: GridMetrics): number =>
  span * track + (span - 1) * gap;

const closest = <T extends number>(
  options: readonly T[],
  distance: (option: T) => number,
): T =>
  options.reduce((best, option) =>
    distance(option) < distance(best) ? option : best,
  );

export const resizeTarget = ({
  dx,
  dy,
  metrics,
  minSpan,
  start,
}: {
  dx: number;
  dy: number;
  metrics: GridMetrics;
  minSpan: AdminDashboardWidgetSpan;
  start: WidgetSize;
}): WidgetSize => {
  const widest = Math.min(WIDGET_SPANS.length, metrics.columns);
  const spans = WIDGET_SPANS.filter(span => span >= minSpan && span <= widest);
  const shown = Math.min(start.span, widest) as AdminDashboardWidgetSpan;
  const width = spanWidth(shown, metrics) + dx;
  const picked =
    spans.length === 0
      ? shown
      : closest(spans, span => Math.abs(spanWidth(span, metrics) - width));
  const height = metrics.rowHeights[start.rows] + dy;

  return {
    rows: closest(WIDGET_ROWS, rows =>
      Math.abs(metrics.rowHeights[rows] - height),
    ),
    span: picked === shown ? start.span : picked,
  };
};

const clampSpan = (
  span: number,
  minSpan: AdminDashboardWidgetSpan,
): AdminDashboardWidgetSpan =>
  Math.min(
    WIDGET_SPANS.length,
    Math.max(minSpan, span),
  ) as AdminDashboardWidgetSpan;

const clampRows = (rows: number): AdminDashboardWidgetRows =>
  Math.min(WIDGET_ROWS.length, Math.max(1, rows)) as AdminDashboardWidgetRows;

export const stepSize = ({
  key,
  minSpan,
  rtl,
  size,
}: {
  key: string;
  minSpan: AdminDashboardWidgetSpan;
  rtl: boolean;
  size: WidgetSize;
}): null | WidgetSize => {
  const wider = rtl ? "ArrowLeft" : "ArrowRight";
  const narrower = rtl ? "ArrowRight" : "ArrowLeft";

  switch (key) {
    case "ArrowDown":
      return { ...size, rows: clampRows(size.rows + 1) };
    case "ArrowUp":
      return { ...size, rows: clampRows(size.rows - 1) };
    case narrower:
      return { ...size, span: clampSpan(size.span - 1, minSpan) };
    case wider:
      return { ...size, span: clampSpan(size.span + 1, minSpan) };
    default:
      return null;
  }
};
