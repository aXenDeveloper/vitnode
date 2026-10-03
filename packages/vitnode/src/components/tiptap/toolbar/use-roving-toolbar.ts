import React from "react";

const TOOLBAR_ITEM_SELECTOR =
  "button:not([disabled]), [role=button]:not([aria-disabled=true]), input:not([disabled])";

const toolbarItemsOf = (toolbar: HTMLElement): HTMLElement[] =>
  [...toolbar.querySelectorAll<HTMLElement>(TOOLBAR_ITEM_SELECTOR)].filter(
    item => item.closest("[role=toolbar]") === toolbar,
  );

export const nextToolbarIndex = ({
  count,
  current,
  isRtl,
  key,
}: {
  count: number;
  current: number;
  isRtl: boolean;
  key: string;
}): null | number => {
  if (count === 0) return null;

  const forward = isRtl ? "ArrowLeft" : "ArrowRight";
  const backward = isRtl ? "ArrowRight" : "ArrowLeft";

  if (key === forward) return (current + 1) % count;
  if (key === backward) return (current - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;

  return null;
};

const makeActive = (items: HTMLElement[], active: HTMLElement | undefined) => {
  for (const item of items) {
    item.tabIndex = item === active ? 0 : -1;
  }
};

export const useRovingToolbar = () => {
  const ref = React.useRef<HTMLDivElement>(null);
  const activeRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const toolbar = ref.current;
    if (!toolbar) return;

    const items = toolbarItemsOf(toolbar);
    const active =
      activeRef.current && items.includes(activeRef.current)
        ? activeRef.current
        : items[0];
    activeRef.current = active ?? null;
    makeActive(items, active);
  });

  const onFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    const items = toolbarItemsOf(event.currentTarget);
    const target = event.target as HTMLElement;
    if (!items.includes(target)) return;

    activeRef.current = target;
    makeActive(items, target);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = toolbarItemsOf(event.currentTarget);
    const current = items.indexOf(event.target as HTMLElement);
    if (current === -1) return;

    const next = nextToolbarIndex({
      count: items.length,
      current,
      isRtl: getComputedStyle(event.currentTarget).direction === "rtl",
      key: event.key,
    });
    if (next === null) return;

    event.preventDefault();
    const target = items[next];
    activeRef.current = target;
    makeActive(items, target);
    target.focus();
  };

  return { onFocus, onKeyDown, ref };
};
