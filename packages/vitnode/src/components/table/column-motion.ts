import type React from "react";

import { useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef } from "react";

const GLIDE_MS = 250;
const GLIDE_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

const cellsOf = (row: Element) =>
  Array.from(row.querySelectorAll<HTMLElement>(":scope > th, :scope > td"));

export const columnLeftsOf = (table: HTMLTableElement): number[] => {
  const headRow = table.querySelector(":scope > thead > tr");

  return headRow ? cellsOf(headRow).map(cell => cell.offsetLeft) : [];
};

export const glideColumnsDataTable = (
  table: HTMLTableElement,
  previous: readonly number[],
  next: readonly number[],
): Animation[] => {
  if (previous.length === 0 || previous.length !== next.length) return [];

  const animations: Animation[] = [];
  for (const row of table.querySelectorAll(":scope > * > tr")) {
    const cells = cellsOf(row);
    if (cells.length !== next.length) continue;
    for (const [index, cell] of cells.entries()) {
      const delta = previous[index] - next[index];
      if (Math.abs(delta) < 1) continue;
      animations.push(
        cell.animate(
          [
            { transform: `translateX(${delta}px)` },
            { transform: "translateX(0)" },
          ],
          { duration: GLIDE_MS, easing: GLIDE_EASING },
        ),
      );
    }
  }

  return animations;
};

export const useColumnGlideDataTable = (
  tableRef: React.RefObject<HTMLTableElement | null>,
  contentKey: unknown,
) => {
  const shouldReduceMotion = useReducedMotion();
  const leftsRef = useRef<number[]>([]);
  const animationsRef = useRef<Animation[]>([]);

  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const next = columnLeftsOf(table);
    const previous = leftsRef.current;
    leftsRef.current = next;
    for (const animation of animationsRef.current) animation.cancel();
    animationsRef.current = shouldReduceMotion
      ? []
      : glideColumnsDataTable(table, previous, next);
  }, [contentKey, shouldReduceMotion, tableRef]);

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const observer = new ResizeObserver(() => {
      leftsRef.current = columnLeftsOf(table);
    });
    observer.observe(table);

    return () => {
      observer.disconnect();
      for (const animation of animationsRef.current) animation.cancel();
    };
  }, [tableRef]);
};
