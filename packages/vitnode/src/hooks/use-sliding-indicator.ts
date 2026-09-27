import React from "react";

export const SLIDING_INDICATOR_ITEM = "data-sliding-indicator-item";

export const slidingIndicatorTransitionClassName =
  "transition-[transform,width,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

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
