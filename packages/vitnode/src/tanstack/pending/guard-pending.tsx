"use client";

import type { AnyRoute, AnyRouter } from "@tanstack/react-router";

import {
  Outlet,
  useMatch,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { createElement, useEffect, useState } from "react";

interface DestinationPending {
  Component: NonNullable<AnyRoute["options"]["pendingComponent"]>;
  delay: number;
}

const matchedBranch = (router: AnyRouter): readonly AnyRoute[] => {
  try {
    return router.getMatchedRoutes(router.state.location.pathname)[0] ?? [];
  } catch {
    return [];
  }
};

const destinationPending = (router: AnyRouter): DestinationPending | null => {
  const branch = matchedBranch(router);
  const delay =
    branch.at(-1)?.options.pendingMs ?? router.options.defaultPendingMs ?? 0;

  for (let index = branch.length - 1; index >= 0; index--) {
    const Component = branch[index]?.options.pendingComponent;

    if (Component) return { Component, delay };
  }

  const fallback = router.options.defaultPendingComponent;

  return fallback ? { Component: fallback, delay } : null;
};

export const RouteGuardPending = ({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode => {
  const router = useRouter();
  const isNavigating = useRouterState({
    select: state => state.status === "pending",
  });
  const isGuarding = useMatch({
    select: match => match.isFetching === "beforeLoad",
    strict: false,
  });
  const [showing, setShowing] = useState(false);
  const destination = isGuarding || showing ? destinationPending(router) : null;
  const delay = destination?.delay ?? 0;

  if (showing && !isNavigating) setShowing(false);
  else if (!showing && isGuarding && delay <= 0) setShowing(true);

  useEffect(() => {
    if (!isGuarding || delay <= 0) return;

    const timer = setTimeout(() => setShowing(true), delay);

    return () => clearTimeout(timer);
  }, [delay, isGuarding]);

  if (!showing || destination === null) return children;

  return createElement(destination.Component);
};

export const GuardedOutlet = () => (
  <RouteGuardPending>
    <Outlet />
  </RouteGuardPending>
);
