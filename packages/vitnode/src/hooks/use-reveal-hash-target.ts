import { useRouter } from "@tanstack/react-router";
import React from "react";

/**
 * - `idle`: the URL has no matching hash.
 * - `searching`: the target is not rendered yet, so more pages are loading.
 * - `found`: the target was scrolled into view and focused.
 * - `missing`: every allowed page is loaded and the target is not among them.
 */
export type RevealHashTargetStatus = "found" | "idle" | "missing" | "searching";

const SETTLE_MS = 1500;
const STOP_EVENTS = ["keydown", "pointerdown", "touchstart", "wheel"];

/**
 * Scrolls `element` to the middle of the screen and keeps it there while the
 * page around it settles - images, avatars and buttons that load late would
 * otherwise push it away. Stops at the reader's first scroll or key press.
 */
const keepInView = (element: HTMLElement): (() => void) => {
  const align = () => {
    element.scrollIntoView({ behavior: "instant", block: "center" });
  };
  align();

  const observer = new ResizeObserver(align);
  observer.observe(document.body);
  const stop = () => {
    observer.disconnect();
    window.clearTimeout(timer);
    for (const event of STOP_EVENTS) window.removeEventListener(event, stop);
  };
  const timer = window.setTimeout(stop, SETTLE_MS);
  for (const event of STOP_EVENTS) {
    window.addEventListener(event, stop, { passive: true });
  }

  return stop;
};

const readHash = () => {
  const hash = window.location.hash.slice(1);
  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
};

/**
 * Brings the element named by the URL hash into view in a paginated list - a
 * notification linking to `#comment-42` on page three of a thread. Until the
 * element is rendered it loads the next page, up to `maxLoads` pages, then
 * scrolls the element to the middle of the screen, keeps it there while late
 * content settles, and focuses it (give it `tabIndex={-1}`). When it never
 * appears the status says `missing`, so the page can tell the reader instead
 * of silently ignoring the link. Browser-only effects; safe to render on the
 * server.
 *
 * @example
 * ```tsx
 * const { status, targetId } = useRevealHashTarget({
 *   prefix: "comment-",
 *   ready: !comments.isPending,
 *   renderedCount: items.length,
 *   hasMore: comments.hasNextPage,
 *   isLoadingMore: comments.isFetchingNextPage,
 *   loadMore: comments.fetchNextPage,
 * });
 * ```
 */
export function useRevealHashTarget({
  hasMore,
  isLoadingMore,
  loadMore,
  maxLoads = 10,
  prefix,
  ready,
  renderedCount,
}: {
  /** Whether another page exists. */
  hasMore: boolean;
  /** Whether a page is loading now; no second load starts meanwhile. */
  isLoadingMore: boolean;
  loadMore: () => Promise<unknown>;
  /** Pages to load while looking, so a stale link cannot load a whole archive. Defaults to 10. */
  maxLoads?: number;
  /** Only hashes starting with this react, such as `"comment-"`. */
  prefix: string;
  /** `false` while the first page is pending. */
  ready: boolean;
  /** How many items are rendered; a change looks again. */
  renderedCount: number;
}): { status: RevealHashTargetStatus; targetId: null | string } {
  const router = useRouter();
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      window.addEventListener("hashchange", onChange);
      const unsubscribe = router.subscribe("onResolved", onChange);

      return () => {
        window.removeEventListener("hashchange", onChange);
        unsubscribe();
      };
    },
    [router],
  );
  // The server never sees a hash, so it is read from the browser after each
  // navigation and on `hashchange`.
  const hash = React.useSyncExternalStore(subscribe, readHash, () => "");
  const targetId = hash.startsWith(prefix) ? hash : null;

  const [revealedId, setRevealedId] = React.useState<null | string>(null);
  const [missingId, setMissingId] = React.useState<null | string>(null);
  const loadsRef = React.useRef<{ count: number; targetId: null | string }>({
    count: 0,
    targetId: null,
  });
  const stopAligningRef = React.useRef<(() => void) | null>(null);
  const loadMoreRef = React.useRef(loadMore);

  React.useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  React.useEffect(
    () => () => {
      stopAligningRef.current?.();
      stopAligningRef.current = null;
    },
    [targetId],
  );

  React.useEffect(() => {
    if (!targetId || !ready || revealedId === targetId) return;

    // After paint, so a page that just arrived is in the DOM.
    const frame = window.requestAnimationFrame(() => {
      if (loadsRef.current.targetId !== targetId) {
        loadsRef.current = { count: 0, targetId };
      }

      const element = document.getElementById(targetId);
      if (element) {
        element.focus({ preventScroll: true });
        stopAligningRef.current = keepInView(element);
        setRevealedId(targetId);

        return;
      }

      if (isLoadingMore) return;
      if (hasMore && loadsRef.current.count < maxLoads) {
        loadsRef.current.count += 1;
        void loadMoreRef.current();

        return;
      }

      setMissingId(targetId);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [
    hasMore,
    isLoadingMore,
    maxLoads,
    ready,
    renderedCount,
    revealedId,
    targetId,
  ]);

  const status: RevealHashTargetStatus = !targetId
    ? "idle"
    : revealedId === targetId
      ? "found"
      : missingId === targetId
        ? "missing"
        : "searching";

  return { status, targetId };
}
