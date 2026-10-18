import React from "react";

/** The attribute that marks each item the indicator can slide to, in order. */
export const SLIDING_INDICATOR_ITEM = "data-sliding-indicator-item";

/** Tailwind classes that animate the indicator's move; none under reduced motion. */
export const slidingIndicatorTransitionClassName =
  "transition-[transform,width,height] duration-300 ease-fluid motion-reduce:transition-none";

/**
 * Moves a highlight element under the active item of a tab-like row. Put
 * `containerRef` on the row, mark each item with the
 * {@link SLIDING_INDICATOR_ITEM} attribute, and put `indicatorRef` on the
 * indicator element. It is sized and positioned under the `activeIndex`-th
 * marked item, follows container resizes, and is hidden (`opacity: 0`) when
 * that item does not exist. `isReady` turns `true` after the first frame -
 * add the transition classes only then, so the first placement doesn't
 * animate. Browser-only work runs in effects, so it is safe to render on the
 * server.
 */
export const useSlidingIndicator = <Container extends HTMLElement>(
  activeIndex: number,
) => {
  const containerRef = React.useRef<Container>(null);
  const indicatorRef = React.useRef<HTMLSpanElement>(null);
  const [isReady, setIsReady] = React.useState(false);

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    const indicator = indicatorRef.current;
    if (!container || !indicator) return;

    const place = () => {
      const target = container.querySelectorAll(`[${SLIDING_INDICATOR_ITEM}]`)[
        activeIndex
      ];
      if (!(target instanceof HTMLElement)) {
        indicator.style.opacity = "0";

        return;
      }

      indicator.style.opacity = "1";
      indicator.style.width = `${target.offsetWidth}px`;
      indicator.style.height = `${target.offsetHeight}px`;
      indicator.style.transform = `translate(${target.offsetLeft}px, ${target.offsetTop}px)`;
    };

    place();
    const observer = new ResizeObserver(place);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [activeIndex]);

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setIsReady(true);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  return { containerRef, indicatorRef, isReady };
};
