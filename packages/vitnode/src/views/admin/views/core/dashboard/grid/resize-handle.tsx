import { cn } from "cn";
import React from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "use-intl";

import type {
  AdminDashboardWidgetSpan,
  DashboardWidgetView,
} from "../widgets/types";
import type { GridMetrics, WidgetSize } from "./resize";

import { resizeTarget, stepSize } from "./resize";
import { rowsHeightRem } from "./span-classes";

export const SPAN_LABELS = {
  1: "size.small",
  2: "size.medium",
  3: "size.large",
} as const satisfies Record<AdminDashboardWidgetSpan, string>;

const measureGrid = (grid: HTMLElement): GridMetrics => {
  const style = getComputedStyle(grid);
  const tracks = style.gridTemplateColumns.split(" ").filter(Boolean);
  const rem = Number.parseFloat(
    getComputedStyle(document.documentElement).fontSize,
  );

  return {
    columns: tracks.length,
    gap: Number.parseFloat(style.columnGap) || 0,
    rowHeights: {
      1: rowsHeightRem[1] * rem,
      2: rowsHeightRem[2] * rem,
      3: rowsHeightRem[3] * rem,
    },
    track: Number.parseFloat(tracks[0] ?? "0"),
  };
};

export const ResizeHandle = ({
  onResize,
  onResizingChange,
  widget,
}: {
  onResize: (size: WidgetSize) => void;
  onResizingChange: (resizing: boolean) => void;
  widget: DashboardWidgetView;
}) => {
  const t = useTranslations("admin.dashboard.widgets");
  const hintId = React.useId();
  const outlineRef = React.useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = React.useState(false);
  const [announcing, setAnnouncing] = React.useState(false);

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0) return;

    event.stopPropagation();

    const handle = event.currentTarget;
    const card = handle.closest<HTMLElement>("[data-dashboard-widget]");
    const grid = card?.parentElement;
    if (!card || !grid) return;

    event.preventDefault();
    handle.setPointerCapture(event.pointerId);

    const metrics = measureGrid(grid);
    const rtl = getComputedStyle(card).direction === "rtl";
    const origin = { x: event.clientX, y: event.clientY };
    const start: WidgetSize = { rows: widget.rows, span: widget.span };
    let current = start;
    let pointer = origin;
    let frame = 0;

    const drawOutline = () => {
      frame = 0;

      const outline = outlineRef.current;
      if (!outline) return;

      const rect = card.getBoundingClientRect();
      const width = Math.max(
        rtl ? rect.right - pointer.x : pointer.x - rect.left,
        metrics.track,
      );
      const height = Math.max(pointer.y - rect.top, metrics.rowHeights[1]);

      outline.style.transform = `translate(${rtl ? rect.right - width : rect.left}px, ${rect.top}px)`;
      outline.style.width = `${width}px`;
      outline.style.height = `${height}px`;
    };

    const onMove = (move: PointerEvent) => {
      pointer = { x: move.clientX, y: move.clientY };
      if (frame === 0) frame = requestAnimationFrame(drawOutline);

      const next = resizeTarget({
        dx: (move.clientX - origin.x) * (rtl ? -1 : 1),
        dy: move.clientY - origin.y,
        metrics,
        minSpan: widget.minSpan,
        start,
      });
      if (next.span === current.span && next.rows === current.rows) return;

      current = next;
      onResize(next);
    };

    const onEnd = () => {
      cancelAnimationFrame(frame);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onEnd);
      handle.removeEventListener("pointercancel", onEnd);
      setResizing(false);
      onResizingChange(false);
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onEnd);
    handle.addEventListener("pointercancel", onEnd);
    setResizing(true);
    onResizingChange(true);
    frame = requestAnimationFrame(drawOutline);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const next = stepSize({
      key: event.key,
      minSpan: widget.minSpan,
      rtl: getComputedStyle(event.currentTarget).direction === "rtl",
      size: { rows: widget.rows, span: widget.span },
    });
    if (next === null) return;

    event.preventDefault();
    event.stopPropagation();
    setAnnouncing(true);

    if (next.span !== widget.span || next.rows !== widget.rows) onResize(next);
  };

  return (
    <>
      <button
        aria-describedby={hintId}
        aria-label={t("resize.handle", { title: widget.title })}
        className="group/resize focus-visible:ring-ring absolute end-1 bottom-1 z-10 flex size-7 cursor-nwse-resize touch-none items-end justify-end rounded-ee-xl p-1.5 outline-none before:absolute before:-inset-1.5 focus-visible:ring-2 rtl:cursor-nesw-resize"
        data-resizing={resizing ? "" : undefined}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        type="button"
      >
        <span
          aria-hidden="true"
          className={cn(
            "size-3 rounded-ee-md border-e-2 border-b-2 transition-[border-color,scale] duration-150 ease-out motion-reduce:transition-none",
            resizing
              ? "border-primary scale-125"
              : "border-muted-foreground/50 group-hover/resize:border-primary group-focus-visible/resize:border-primary group-hover/resize:scale-110",
          )}
        />
      </button>

      <span className="sr-only" id={hintId}>
        {t("resize.hint")}
      </span>

      <span aria-live="polite" className="sr-only">
        {announcing
          ? t("resize.size", {
              rows: widget.rows,
              width: t(SPAN_LABELS[widget.span]),
            })
          : null}
      </span>

      {resizing
        ? createPortal(
            <div
              aria-hidden="true"
              className="border-primary/50 pointer-events-none fixed top-0 left-0 z-50 rounded-xl border-2 border-dashed"
              ref={outlineRef}
            />,
            document.body,
          )
        : null}
    </>
  );
};
