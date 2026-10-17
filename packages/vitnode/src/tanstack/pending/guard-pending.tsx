import type { AnyRoute, AnyRouter } from "@tanstack/react-router";

import {
  Outlet,
  useMatch,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import {
  createContext,
  createElement,
  use,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

type PendingComponent = NonNullable<AnyRoute["options"]["pendingComponent"]>;

interface DestinationPending {
  Component: PendingComponent;
  delay: number;
  ownerRouteId: null | string;
}

interface GuardPendingOutlets {
  pending: null | Pick<DestinationPending, "Component" | "ownerRouteId">;
  register: (routeId: string) => () => void;
}

const GuardPendingOutletsContext = createContext<GuardPendingOutlets | null>(
  null,
);

const matchedBranch = (router: AnyRouter): readonly AnyRoute[] => {
  try {
    return router.getMatchedRoutes(router.state.location.pathname)[0] ?? [];
  } catch {
    return [];
  }
};

const keptLayoutIndex = (
  branch: readonly AnyRoute[],
  outlets: ReadonlySet<string>,
): number => {
  for (let index = branch.length - 2; index >= 0; index--) {
    const id: string | undefined = branch[index]?.id;

    if (id !== undefined && outlets.has(id)) return index;
  }

  return -1;
};

const pendingAt = (
  branch: readonly AnyRoute[],
  index: number,
): PendingComponent | undefined => branch[index]?.options.pendingComponent;

const destinationPending = (
  router: AnyRouter,
  outlets: ReadonlySet<string>,
  shellRouteId: string | undefined,
): DestinationPending | null => {
  const branch = matchedBranch(router);
  const delay =
    branch.at(-1)?.options.pendingMs ?? router.options.defaultPendingMs ?? 0;
  const ownerIndex = keptLayoutIndex(branch, outlets);
  const ownerRouteId: null | string = branch[ownerIndex]?.id ?? null;
  const shellIndex = branch.findIndex(route => route.id === shellRouteId);
  const firstMounting = Math.max(ownerIndex, shellIndex) + 1;

  for (let index = firstMounting; index < branch.length; index++) {
    const Component = pendingAt(branch, index);

    if (Component) return { Component, delay, ownerRouteId };
  }

  if (ownerIndex < 0) {
    for (let index = firstMounting - 1; index >= 0; index--) {
      const Component = pendingAt(branch, index);

      if (Component) return { Component, delay, ownerRouteId };
    }
  }

  const fallback = router.options.defaultPendingComponent;

  return fallback ? { Component: fallback, delay, ownerRouteId } : null;
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
  const shellRouteId: string | undefined = useMatch({
    select: match => match.routeId,
    strict: false,
  });
  const [showing, setShowing] = useState(false);
  const [outlets, setOutlets] = useState<ReadonlySet<string>>(() => new Set());
  const destination =
    isGuarding || showing
      ? destinationPending(router, outlets, shellRouteId)
      : null;
  const delay = destination?.delay ?? 0;

  if (showing && !isNavigating) setShowing(false);
  else if (!showing && isGuarding && delay <= 0) setShowing(true);

  useEffect(() => {
    if (!isGuarding || delay <= 0) return;

    const timer = setTimeout(() => setShowing(true), delay);

    return () => clearTimeout(timer);
  }, [delay, isGuarding]);

  const [register] = useState(() => (routeId: string) => {
    setOutlets(current => new Set(current).add(routeId));

    return () => {
      setOutlets(current => {
        const next = new Set(current);
        next.delete(routeId);

        return next;
      });
    };
  });

  const shown = showing ? destination : null;
  const pendingComponent = shown?.Component;
  const pendingOwnerRouteId = shown?.ownerRouteId ?? null;
  const value = useMemo<GuardPendingOutlets>(
    () => ({
      pending:
        pendingComponent && pendingOwnerRouteId !== null
          ? { Component: pendingComponent, ownerRouteId: pendingOwnerRouteId }
          : null,
      register,
    }),
    [pendingComponent, pendingOwnerRouteId, register],
  );

  if (shown && shown.ownerRouteId === null) {
    const ShownPending = shown.Component;

    return <ShownPending />;
  }

  return (
    <GuardPendingOutletsContext value={value}>
      {children}
    </GuardPendingOutletsContext>
  );
};

export const PendingOutlet = (): React.ReactNode => {
  const outlets = use(GuardPendingOutletsContext);
  const routeId: string | undefined = useMatch({
    select: match => match.routeId,
    strict: false,
  });
  const register = outlets?.register;
  const pending = outlets?.pending;

  useLayoutEffect(() => {
    if (register && routeId !== undefined) return register(routeId);
  }, [register, routeId]);

  if (routeId !== undefined && pending?.ownerRouteId === routeId) {
    return createElement(pending.Component);
  }

  return <Outlet />;
};

export const GuardedOutlet = () => (
  <RouteGuardPending>
    <Outlet />
  </RouteGuardPending>
);
