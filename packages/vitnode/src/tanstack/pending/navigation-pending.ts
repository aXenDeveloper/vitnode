"use client";

import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const useRouteNavigationPending = (delay: number): boolean => {
  const isNavigating = useRouterState({
    select: state => state.status === "pending",
  });
  const [waitedOutDelay, setWaitedOutDelay] = useState(false);
  const [navigationShown, setNavigationShown] = useState(isNavigating);

  if (navigationShown !== isNavigating) {
    setNavigationShown(isNavigating);
    setWaitedOutDelay(false);
  }

  useEffect(() => {
    if (!isNavigating || delay <= 0) return;

    const timer = setTimeout(() => setWaitedOutDelay(true), delay);

    return () => clearTimeout(timer);
  }, [delay, isNavigating]);

  return isNavigating && (delay <= 0 || waitedOutDelay);
};
