import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteGuardPending } from "./guard-pending";
import { RoutePendingSpinner } from "./route-pending-skeleton";
import { TablePendingSkeleton } from "./shapes";

const PENDING_MS = 150;
const PENDING_MIN_MS = 300;

const deferred = () => {
  let settle = (): void => undefined;
  const promise = new Promise<void>(resolveWith => {
    settle = () => resolveWith();
  });

  return { promise, settle };
};

const routerFor = ({
  guard,
  load = async () => await Promise.resolve(),
  shapelessDestination = false,
  wrapOutlet,
}: {
  guard: () => Promise<void>;
  load?: () => Promise<void>;
  shapelessDestination?: boolean;
  wrapOutlet: boolean;
}) => {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });

  let entries = 0;
  const shellRoute = createRoute({
    beforeLoad: async () => {
      entries += 1;
      if (entries > 1) await guard();

      return {};
    },
    component: () =>
      wrapOutlet ? (
        <RouteGuardPending>
          <Outlet />
        </RouteGuardPending>
      ) : (
        <Outlet />
      ),
    getParentRoute: () => rootRoute,
    id: "shell",
    pendingComponent: () => (
      <TablePendingSkeleton label="Loading the section" />
    ),
  });

  const dashboardRoute = createRoute({
    component: () => <p>dashboard</p>,
    getParentRoute: () => shellRoute,
    path: "/",
  });

  const usersRoute = createRoute({
    component: () => <p>users table</p>,
    getParentRoute: () => shellRoute,
    loader: async () => await load(),
    path: "/users",
    ...(shapelessDestination
      ? {}
      : {
          pendingComponent: () => (
            <TablePendingSkeleton label="Loading the table" />
          ),
        }),
  });

  return createRouter({
    defaultPendingComponent: RoutePendingSpinner,
    defaultPendingMinMs: PENDING_MIN_MS,
    defaultPendingMs: PENDING_MS,
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: rootRoute.addChildren([
      shellRoute.addChildren([dashboardRoute, usersRoute]),
    ]),
  });
};

const mount = async (router: ReturnType<typeof routerFor>) => {
  await act(async () => {
    await router.load();
  });
  render(<RouterProvider router={router} />);
};

const tick = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const showsTableShape = () => screen.queryByText("Loading the table") !== null;
const showsPreviousScreen = () => screen.queryByText("dashboard") !== null;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("a shell whose guard blocks the navigation", () => {
  it("shows nothing at all without the wrapper, however long the guard takes", async () => {
    const guard = deferred();
    const router = routerFor({
      guard: async () => await guard.promise,
      wrapOutlet: false,
    });
    await mount(router);

    void router.navigate({ to: "/users" });
    await tick(2_000);

    expect(showsTableShape()).toBe(false);
    expect(showsPreviousScreen()).toBe(true);

    guard.settle();
    await tick(PENDING_MIN_MS + 100);

    expect(screen.queryByText("users table")).not.toBeNull();
  });

  it("shows the destination's own shape while the guard runs", async () => {
    const guard = deferred();
    const router = routerFor({
      guard: async () => await guard.promise,
      wrapOutlet: true,
    });
    await mount(router);

    void router.navigate({ to: "/users" });
    await tick(2_000);

    expect(showsTableShape()).toBe(true);
    expect(showsPreviousScreen()).toBe(false);

    guard.settle();
    await tick(PENDING_MIN_MS + 100);

    expect(screen.queryByText("users table")).not.toBeNull();
    expect(showsTableShape()).toBe(false);
  });

  it("honours the router's own threshold, so a fast guard flashes nothing", async () => {
    const guard = deferred();
    const router = routerFor({
      guard: async () => await guard.promise,
      wrapOutlet: true,
    });
    await mount(router);

    void router.navigate({ to: "/users" });
    await tick(PENDING_MS - 50);

    expect(showsTableShape()).toBe(false);
    expect(showsPreviousScreen()).toBe(true);

    guard.settle();
    await tick(PENDING_MIN_MS + 100);

    expect(screen.queryByText("users table")).not.toBeNull();
  });

  it("uses the nearest ancestor's shape when the destination declares none", async () => {
    const guard = deferred();
    const router = routerFor({
      guard: async () => await guard.promise,
      shapelessDestination: true,
      wrapOutlet: true,
    });
    await mount(router);

    void router.navigate({ to: "/users" });
    await tick(PENDING_MS + 50);

    expect(screen.queryByText("Loading the section")).not.toBeNull();
    expect(showsPreviousScreen()).toBe(false);

    guard.settle();
    await tick(PENDING_MIN_MS + 100);

    expect(screen.queryByText("users table")).not.toBeNull();
  });

  it("hands over to the router without changing what is on screen", async () => {
    const guard = deferred();
    const load = deferred();
    const router = routerFor({
      guard: async () => await guard.promise,
      load: async () => await load.promise,
      wrapOutlet: true,
    });
    await mount(router);

    void router.navigate({ to: "/users" });
    await tick(PENDING_MS + 50);

    expect(showsTableShape()).toBe(true);

    guard.settle();

    for (const step of [0, 1, 16, 100, 400]) {
      await tick(step);

      expect(showsTableShape()).toBe(true);
      expect(showsPreviousScreen()).toBe(false);
    }

    load.settle();
    await tick(PENDING_MIN_MS + 100);

    expect(screen.queryByText("users table")).not.toBeNull();
    expect(showsTableShape()).toBe(false);
  });
});
