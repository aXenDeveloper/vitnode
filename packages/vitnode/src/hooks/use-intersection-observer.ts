import React from "react";

interface UseIntersectionObserverOptions {
  freezeOnceVisible?: boolean;
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
}

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
    if (!target || isFrozen || !("IntersectionObserver" in window)) return;

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
