import React from "react";

interface UseIntersectionObserverOptions {
  freezeOnceVisible?: boolean;
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
}

/**
 * The latest `IntersectionObserverEntry` for `target`, e.g. to load more items
 * when a sentinel scrolls into view. `undefined` until the first observation.
 *
 * @param options.freezeOnceVisible Stop observing after the first intersection.
 */
export function useIntersectionObserver(
  target: Element | null,
  {
    threshold = 0,
    root = null,
    rootMargin = "0%",
    freezeOnceVisible = false,
  }: UseIntersectionObserverOptions = {},
): IntersectionObserverEntry | undefined {
  const [entry, setEntry] = React.useState<IntersectionObserverEntry>();
  const isFrozen = freezeOnceVisible && !!entry?.isIntersecting;
  const thresholdKey = Array.isArray(threshold)
    ? threshold.join(",")
    : String(threshold);

  React.useEffect(() => {
    if (!target || isFrozen || typeof IntersectionObserver === "undefined")
      return;

    const observer = new IntersectionObserver(
      ([nextEntry]) => {
        setEntry(nextEntry);
      },
      { root, rootMargin, threshold: thresholdKey.split(",").map(Number) },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [target, isFrozen, root, rootMargin, thresholdKey]);

  return entry;
}
