// @vitest-environment jsdom
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { navigationViewTransition, PAGE_VIEW_TRANSITION_TYPE } from ".";

type ViewTransitionParams = (() => unknown) | { update: () => unknown };

const startViewTransition = vi.fn((params: ViewTransitionParams) => {
  const update = typeof params === "function" ? params : params.update;

  return { updateCallbackDone: Promise.resolve(update()) };
});

const stubReducedMotion = (reduce: boolean) => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query.includes("reduce"),
    })),
  );
};

const routerWith = async (enabled?: boolean) => {
  const rootRoute = createRootRoute();
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: "/" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/docs" }),
  ]);
  const router = createRouter({
    defaultViewTransition: navigationViewTransition(enabled),
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree,
  });

  await router.load();
  startViewTransition.mockClear();

  return router;
};

describe("navigationViewTransition", () => {
  beforeEach(() => {
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });
    vi.stubGlobal("CSS", { supports: () => true });
    stubReducedMotion(false);
  });

  afterEach(() => {
    Reflect.deleteProperty(document, "startViewTransition");
    vi.unstubAllGlobals();
    startViewTransition.mockClear();
  });

  it("animates a navigation to another page", async () => {
    const router = await routerWith();

    await router.navigate({ to: "/docs" });

    expect(startViewTransition).toHaveBeenCalledOnce();
    expect(startViewTransition.mock.calls[0]?.[0]).toMatchObject({
      types: [PAGE_VIEW_TRANSITION_TYPE],
    });
    expect(router.state.location.pathname).toBe("/docs");
  });

  it("skips a change that only touches the search params", async () => {
    const router = await routerWith();

    await router.navigate({ search: { page: 2 }, to: "/" });

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(router.state.location.search).toEqual({ page: 2 });
  });

  it("skips every navigation when the user prefers reduced motion", async () => {
    stubReducedMotion(true);
    const router = await routerWith();

    await router.navigate({ to: "/docs" });

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/docs");
  });

  it("skips every navigation when view transitions are turned off", async () => {
    const router = await routerWith(false);

    await router.navigate({ to: "/docs" });

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/docs");
  });
});
