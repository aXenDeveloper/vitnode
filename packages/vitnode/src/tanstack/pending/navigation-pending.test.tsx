import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isRouteNavigating, useIsRouteNavigating } from "./navigation-pending";

const deferred = () => {
  let settle = (): void => undefined;
  const promise = new Promise<void>(resolveWith => {
    settle = () => resolveWith();
  });

  return { promise, settle };
};

type Gate = ReturnType<typeof deferred>;

let seen: boolean[] = [];
const gates: { other?: Gate; slow?: Gate } = {};

const Probe = () => {
  const isNavigating = useIsRouteNavigating();

  useEffect(() => {
    seen.push(isNavigating);
  }, [isNavigating]);

  return <output data-navigating={String(isNavigating)} />;
};

const routerFor = (initialEntry = "/") => {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <Probe />
        <Outlet />
      </>
    ),
  });

  const homeRoute = createRoute({
    component: () => <p>home</p>,
    getParentRoute: () => rootRoute,
    path: "/",
  });

  const slowRoute = createRoute({
    component: () => <p>slow</p>,
    getParentRoute: () => rootRoute,
    loader: async () => await gates.slow?.promise,
    path: "/slow",
  });

  const otherRoute = createRoute({
    component: () => <p>other</p>,
    getParentRoute: () => rootRoute,
    loader: async () => await gates.other?.promise,
    path: "/other",
  });

  const brokenRoute = createRoute({
    component: () => <p>broken</p>,
    errorComponent: () => <p>broken error</p>,
    getParentRoute: () => rootRoute,
    loader: async () => {
      await gates.slow?.promise;
      throw new Error("Loader failed");
    },
    path: "/broken",
  });

  const guardedRoute = createRoute({
    beforeLoad: () => {
      throw redirect({ to: "/slow" });
    },
    component: () => <p>guarded</p>,
    getParentRoute: () => rootRoute,
    path: "/guarded",
  });

  return createRouter({
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
    routeTree: rootRoute.addChildren([
      homeRoute,
      slowRoute,
      otherRoute,
      brokenRoute,
      guardedRoute,
    ]),
  });
};

type TestRouter = ReturnType<typeof routerFor>;

const mount = async (router: TestRouter) => {
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

const isNavigating = () =>
  document.querySelector("output")?.getAttribute("data-navigating") === "true";

const start = (navigation: () => Promise<void>) => {
  act(() => {
    void navigation();
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  seen = [];
  delete gates.slow;
  delete gates.other;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useIsRouteNavigating", () => {
  it("is false through the first load and after it", async () => {
    gates.slow = deferred();
    const router = routerFor("/slow");
    render(<RouterProvider router={router} />);
    await tick(2_000);

    expect(router.state.status).toBe("pending");
    expect(isRouteNavigating(router.state)).toBe(false);

    gates.slow.settle();
    await tick(100);

    expect(screen.queryByText("slow")).not.toBeNull();
    expect(seen).toEqual([false]);
  });

  it.each<{
    ends: string;
    name: string;
    run: (router: TestRouter) => Promise<void>;
  }>([
    {
      ends: "slow",
      name: "a loader settles",
      run: async router => {
        gates.slow = deferred();
        start(() => router.navigate({ to: "/slow" }));
        await tick(2_000);

        expect(isNavigating()).toBe(true);

        gates.slow.settle();
      },
    },
    {
      ends: "broken error",
      name: "a loader throws",
      run: async router => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        gates.slow = deferred();
        start(() => router.navigate({ to: "/broken" }));
        await tick(2_000);

        expect(isNavigating()).toBe(true);

        gates.slow.settle();
      },
    },
    {
      ends: "slow",
      name: "a guard redirects to a route whose loader is pending",
      run: async router => {
        gates.slow = deferred();
        start(() => router.navigate({ to: "/guarded" }));
        await tick(2_000);

        expect(isNavigating()).toBe(true);
        expect(router.state.location.pathname).toBe("/slow");

        gates.slow.settle();
      },
    },
    {
      ends: "other",
      name: "a second navigation supersedes the first",
      run: async router => {
        gates.slow = deferred();
        gates.other = deferred();
        start(() => router.navigate({ to: "/slow" }));
        await tick(500);
        start(() => router.navigate({ to: "/other" }));
        gates.slow.settle();
        await tick(2_000);

        expect(isNavigating()).toBe(true);

        gates.other.settle();
      },
    },
    {
      ends: "home",
      name: "the user goes back to the URL already on screen",
      run: async router => {
        gates.slow = deferred();
        start(() => router.navigate({ to: "/slow" }));
        await tick(500);

        expect(isNavigating()).toBe(true);

        start(() => router.navigate({ to: "/" }));
      },
    },
  ])("is true until the navigation ends when $name", async ({ ends, run }) => {
    const router = routerFor();
    await mount(router);

    await run(router);
    await tick(2_000);

    expect(isNavigating()).toBe(false);
    expect(screen.queryByText(ends)).not.toBeNull();
    expect(seen).toEqual([false, true, false]);

    gates.slow?.settle();
    gates.other?.settle();
  });

  it.each<{
    initialEntry: string;
    name: string;
    run: (router: TestRouter) => Promise<unknown>;
    status: string;
  }>([
    {
      initialEntry: "/slow",
      name: "the current route reloads",
      run: async router => await router.invalidate({ forcePending: true }),
      status: "pending",
    },
    {
      initialEntry: "/",
      name: "another route is preloaded",
      run: async router => await router.preloadRoute({ to: "/slow" }),
      status: "idle",
    },
  ])(
    "stays false when $name with a slow loader",
    async ({ initialEntry, run, status }) => {
      const router = routerFor(initialEntry);
      await mount(router);

      gates.slow = deferred();
      start(async () => {
        await run(router);
      });
      await tick(2_000);

      expect(router.state.status).toBe(status);
      expect(isNavigating()).toBe(false);

      gates.slow.settle();
      await tick(2_000);

      expect(seen).toEqual([false]);
    },
  );
});
