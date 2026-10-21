import type { RouterState } from "@tanstack/react-router";

import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/**
 * Whether the router is moving to another URL. A load of the URL already on
 * screen (`router.invalidate()`, a stale reload) and the first client load
 * after hydration are not navigations, and preloads never touch this state.
 * Stays `true` across redirects and superseding navigations, and turns `false`
 * once the router commits the destination, its error or its not-found screen.
 */
export const isRouteNavigating = (
  state: Pick<RouterState, "location" | "resolvedLocation" | "status">,
): boolean =>
  state.status === "pending" &&
  state.resolvedLocation !== undefined &&
  state.location.href !== state.resolvedLocation.href;

/** {@link isRouteNavigating} for the current router. Universal; `false` during SSR. */
export const useIsRouteNavigating = (): boolean =>
  useRouterState({ select: isRouteNavigating });

/**
 * `true` once a navigation has been pending for `delay` ms - the moment the
 * router swaps in a pending component. A non-finite `delay` (the router keeps
 * the current page) never reports pending.
 */
export const useRouteNavigationPending = (delay: number): boolean => {
  const isNavigating = useIsRouteNavigating();
  const waits = Number.isFinite(delay);
  const [waitedOutDelay, setWaitedOutDelay] = useState(false);
  const [navigationShown, setNavigationShown] = useState(isNavigating);

  if (navigationShown !== isNavigating) {
    setNavigationShown(isNavigating);
    setWaitedOutDelay(false);
  }

  useEffect(() => {
    if (!isNavigating || !waits || delay <= 0) return;

    const timer = setTimeout(() => setWaitedOutDelay(true), delay);

    return () => clearTimeout(timer);
  }, [delay, isNavigating, waits]);

  return waits && isNavigating && (delay <= 0 || waitedOutDelay);
};
