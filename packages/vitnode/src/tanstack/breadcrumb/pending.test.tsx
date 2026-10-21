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

import { MainBreadcrumb } from "./main-breadcrumb";

const PENDING_MS = 150;

const deferred = () => {
  let settle = (): void => undefined;
  const promise = new Promise<void>(resolveWith => {
    settle = () => resolveWith();
  });

  return { promise, settle };
};

const routerFor = ({
  hereHasCrumb,
  load,
  pendingMs = PENDING_MS,
}: {
  hereHasCrumb: boolean;
  load: () => Promise<void>;
  pendingMs?: number;
}) => {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <nav aria-label="Breadcrumb">
          <MainBreadcrumb />
        </nav>
        <Outlet />
      </>
    ),
  });

  const hereRoute = createRoute({
    component: () => <p>here</p>,
    getParentRoute: () => rootRoute,
    path: "/",
    ...(hereHasCrumb
      ? { staticData: { breadcrumb: <span>Here</span> } }
      : { staticData: {} }),
  });

  const thereRoute = createRoute({
    component: () => <p>there</p>,
    getParentRoute: () => rootRoute,
    loader: async () => await load(),
    path: "/there",
    staticData: { breadcrumb: <span>There</span> },
  });

  return createRouter({
    defaultPendingMinMs: 300,
    defaultPendingMs: pendingMs,
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: rootRoute.addChildren([hereRoute, thereRoute]),
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

const showsShape = () =>
  document.querySelector('[data-slot="breadcrumb-pending"]') !== null;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the breadcrumb area during a navigation", () => {
  it("holds a shape rather than the trail of the page being left", async () => {
    const { promise, settle } = deferred();
    const router = routerFor({
      hereHasCrumb: true,
      load: async () => await promise,
    });
    await mount(router);

    expect(screen.queryByText("Here")).not.toBeNull();

    act(() => {
      void router.navigate({ to: "/there" });
    });
    await tick(PENDING_MS + 50);

    expect(showsShape()).toBe(true);
    expect(screen.queryByText("Here")).toBeNull();
    expect(screen.queryByText("There")).toBeNull();

    settle();
    await tick(500);

    expect(screen.queryByText("There")).not.toBeNull();
    expect(showsShape()).toBe(false);
  });

  it("shows nothing for a navigation that beats the router's threshold", async () => {
    const router = routerFor({
      hereHasCrumb: true,
      load: async () => await Promise.resolve(),
    });
    await mount(router);

    act(() => {
      void router.navigate({ to: "/there" });
    });
    await tick(PENDING_MS - 50);

    expect(showsShape()).toBe(false);
  });

  it("keeps the current trail when the router never shows a pending screen", async () => {
    const { promise, settle } = deferred();
    const router = routerFor({
      hereHasCrumb: true,
      load: async () => await promise,
      pendingMs: Number.POSITIVE_INFINITY,
    });
    await mount(router);

    act(() => {
      void router.navigate({ to: "/there" });
    });
    await tick(2_000);

    expect(showsShape()).toBe(false);
    expect(screen.queryByText("Here")).not.toBeNull();

    settle();
    await tick(500);

    expect(screen.queryByText("There")).not.toBeNull();
  });

  it("invents no trail for a shell that had none", async () => {
    const { promise, settle } = deferred();
    const router = routerFor({
      hereHasCrumb: false,
      load: async () => await promise,
    });
    await mount(router);

    act(() => {
      void router.navigate({ to: "/there" });
    });
    await tick(PENDING_MS + 50);

    expect(showsShape()).toBe(false);

    settle();
    await tick(500);

    expect(screen.queryByText("There")).not.toBeNull();
  });
});
