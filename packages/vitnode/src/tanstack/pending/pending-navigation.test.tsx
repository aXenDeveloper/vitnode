import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RoutePendingSpinner } from "./route-pending-skeleton";
import { TablePendingSkeleton } from "./shapes";

/** What both routers declare. Asserted against their source at the bottom. */
const PENDING_MS = 150;
const PENDING_MIN_MS = 300;

/** A threshold big enough to observe, for the assertions about the mechanism. */
const THRESHOLD = 150;

const deferred = () => {
  let settle = (): void => undefined;
  const promise = new Promise<void>(resolveWith => {
    settle = () => resolveWith();
  });

  return { promise, settle };
};

const routerFor = (
  load: () => Promise<void>,
  {
    minMs = PENDING_MIN_MS,
    ms = THRESHOLD,
    ownShape,
  }: {
    minMs?: number;
    ms?: number;
    ownShape?: () => React.ReactNode;
  } = {},
) => {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });

  const discoverRoute = createRoute({
    component: () => <p>discover feed</p>,
    getParentRoute: () => rootRoute,
    path: "/",
  });

  const searchRoute = createRoute({
    component: () => <p>search results</p>,
    getParentRoute: () => rootRoute,
    loader: async () => await load(),
    path: "/search",
    ...(ownShape === undefined ? {} : { pendingComponent: ownShape }),
  });

  return createRouter({
    defaultPendingComponent: RoutePendingSpinner,
    defaultPendingMinMs: minMs,
    defaultPendingMs: ms,
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: rootRoute.addChildren([discoverRoute, searchRoute]),
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

const isDisplayed = (node: HTMLElement | null): boolean => {
  for (let element = node; element !== null; element = element.parentElement) {
    if (element.style.display === "none") return false;
  }

  return node !== null;
};

const showsPending = () => isDisplayed(screen.queryByRole("status"));
const showsOldPage = () => isDisplayed(screen.queryByText("discover feed"));
const showsNewPage = () => isDisplayed(screen.queryByText("search results"));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the pending window", () => {
  it("keeps the page the visitor is on until the threshold, then swaps in the loader, then the destination", async () => {
    const { promise, settle } = deferred();
    const router = routerFor(async () => await promise);
    await mount(router);

    expect(showsOldPage()).toBe(true);

    void router.navigate({ to: "/search" });
    await tick(THRESHOLD - 50);

    expect(showsPending()).toBe(false);
    expect(showsOldPage()).toBe(true);

    await tick(60);

    expect(showsPending()).toBe(true);
    expect(showsOldPage()).toBe(false);
    expect(showsNewPage()).toBe(false);

    settle();
    await tick(PENDING_MIN_MS + 50);

    expect(showsNewPage()).toBe(true);
    expect(showsPending()).toBe(false);
  });

  it("shows nothing at all when the loader beats the threshold", async () => {
    const router = routerFor(async () => await Promise.resolve());
    await mount(router);

    await act(async () => {
      await router.navigate({ to: "/search" });
    });

    expect(showsNewPage()).toBe(true);
    expect(showsPending()).toBe(false);

    await tick(THRESHOLD + PENDING_MIN_MS);

    expect(showsPending()).toBe(false);
  });

  it("leaves a resolved page alone while work it kicked off carries on in the background", async () => {
    const background = deferred();
    const router = routerFor(async () => {
      void background.promise;
      await Promise.resolve();
    });
    await mount(router);

    await act(async () => {
      await router.navigate({ to: "/search" });
    });
    await tick(THRESHOLD + PENDING_MIN_MS + 100);

    expect(showsNewPage()).toBe(true);
    expect(showsPending()).toBe(false);
  });

  it("stays up for the minimum once shown, so a loader that lands just after the threshold cannot flash it", async () => {
    const { promise, settle } = deferred();
    const router = routerFor(async () => await promise);
    await mount(router);

    void router.navigate({ to: "/search" });
    await tick(THRESHOLD + 10);

    expect(showsPending()).toBe(true);

    settle();
    await tick(50);

    expect(showsPending()).toBe(true);
    expect(showsNewPage()).toBe(false);

    await tick(PENDING_MIN_MS);

    expect(showsNewPage()).toBe(true);
  });
});

/**
 * What the configured `defaultPendingMs: 150` actually buys, measured rather
 * than assumed - because a zero threshold is the obvious-looking setting and it
 * is the wrong one.
 *
 * At zero, every navigation opens a pending window, so `defaultPendingMinMs`
 * applies to all of them: a loader that resolves in a microtask - a cached
 * TanStack Query read, which is most of them - is still held behind a skeleton
 * for the full minimum. A page that could have been instant is made slow in
 * order to look busy. The threshold is what lets that navigation go straight
 * through.
 */
describe(`the configured threshold of ${PENDING_MS}ms`, () => {
  it("lets a navigation that beats it through with no skeleton at all", async () => {
    const router = routerFor(async () => await Promise.resolve(), {
      ms: PENDING_MS,
    });
    await mount(router);

    void router.navigate({ to: "/search" });
    await tick(PENDING_MS - 50);

    expect(showsPending()).toBe(false);
    expect(showsNewPage()).toBe(true);
  });

  it("opens the pending window for one that does not", async () => {
    const { promise, settle } = deferred();
    const router = routerFor(async () => await promise, { ms: PENDING_MS });
    await mount(router);

    void router.navigate({ to: "/search" });
    await tick(PENDING_MS - 50);

    expect(showsPending()).toBe(false);
    expect(showsOldPage()).toBe(true);

    await tick(100);

    expect(showsPending()).toBe(true);

    settle();
    await tick(PENDING_MIN_MS + 50);

    expect(showsNewPage()).toBe(true);
    expect(showsPending()).toBe(false);
  });
});

/**
 * Why both routers declare `defaultStaleReloadMode: "blocking"`, stated as the
 * thing that breaks without it.
 *
 * Router core's default is `"background"`, and it decides on one question: was
 * this match already a success? A hover under `defaultPreload: "intent"` makes
 * it one - the loader runs and settles - so the click that follows is
 * classified as a *background* reload, and a background reload never opens a
 * pending window.
 *
 * It still waits, though. A route's component chunk is awaited before the
 * navigation commits whether the reload is background or not, so the ordinary
 * desktop path - rest on a link, click it, chunk still coming down - took the
 * one branch that renders nothing at all: previous page on screen, URL already
 * changed, no skeleton, for as long as the chunk took.
 *
 * `"blocking"` costs nothing to buy back. A VitNode loader does not block on a
 * warm cache - `ensureQueryData` with `revalidateIfStale` returns the cached
 * entry and refreshes behind it - so what the mode changes is not how long the
 * navigation takes, only whether the router is willing to say it is happening.
 */
describe("a link that was preloaded on hover, then clicked", () => {
  const chunkGatedRouter = (
    mode: "background" | "blocking",
    openChunk: Promise<void>,
  ) => {
    const rootRoute = createRootRoute({ component: () => <Outlet /> });

    const discoverRoute = createRoute({
      component: () => <p>discover feed</p>,
      getParentRoute: () => rootRoute,
      path: "/",
    });

    let chunkLoads = 0;
    const searchRoute = createRoute({
      getParentRoute: () => rootRoute,
      loader: async () => await Promise.resolve(),
      path: "/search",
      pendingComponent: RoutePendingSpinner,
    });

    searchRoute.update({
      component: lazyRouteComponent(async () => {
        chunkLoads += 1;
        if (chunkLoads === 1) await openChunk;

        return { default: () => <p>search results</p> };
      }),
    });

    return createRouter({
      defaultPendingComponent: RoutePendingSpinner,
      defaultPendingMinMs: PENDING_MIN_MS,
      defaultPendingMs: PENDING_MS,
      defaultPreload: "intent",
      defaultPreloadStaleTime: 0,
      defaultStaleReloadMode: mode,
      history: createMemoryHistory({ initialEntries: ["/"] }),
      routeTree: rootRoute.addChildren([discoverRoute, searchRoute]),
    });
  };

  const hoverThenClick = async (mode: "background" | "blocking") => {
    const { promise, settle } = deferred();
    const router = chunkGatedRouter(mode, promise);
    await mount(router);

    void router.preloadRoute({ to: "/search" });
    await tick(50);

    void router.navigate({ to: "/search" });
    await tick(PENDING_MS + 50);

    return { settle, shownWhileChunkLoads: showsPending() };
  };

  it("shows its shape while the component chunk is still downloading", async () => {
    const { settle, shownWhileChunkLoads } = await hoverThenClick("blocking");

    expect(shownWhileChunkLoads).toBe(true);

    settle();
    await tick(PENDING_MIN_MS + 50);

    expect(showsNewPage()).toBe(true);
    expect(showsPending()).toBe(false);
  });

  it("shows nothing for that whole download under the router-core default", async () => {
    const { settle, shownWhileChunkLoads } = await hoverThenClick("background");

    expect(shownWhileChunkLoads).toBe(false);
    expect(showsOldPage()).toBe(true);

    settle();
    await tick(PENDING_MIN_MS + 50);

    expect(showsNewPage()).toBe(true);
  });
});

describe("a route that declares a shape of its own", () => {
  it("shows that shape rather than the router's default", async () => {
    const { promise, settle } = deferred();
    const router = routerFor(async () => await promise, {
      ownShape: () => <TablePendingSkeleton label="Loading the table" />,
    });
    await mount(router);

    void router.navigate({ to: "/search" });
    await tick(THRESHOLD + 10);

    expect(screen.queryByText("Loading the table")).not.toBeNull();

    settle();
    await tick(PENDING_MIN_MS + 50);

    expect(showsNewPage()).toBe(true);
    expect(screen.queryByText("Loading the table")).toBeNull();
  });
});

describe("the routers that ship with VitNode", () => {
  const workspace = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../..",
  );

  const routers = [
    ["apps/web", join(workspace, "apps", "web", "src", "router.tsx")],
    [
      "create-vitnode-app",
      join(
        workspace,
        "packages",
        "create-vitnode-app",
        "copy-of-vitnode-app",
        "root",
        "src",
        "router.tsx",
      ),
    ],
  ] as const;

  it.each(routers)(
    "%s declares the default pending component and both of its timings",
    (_name, file) => {
      if (!existsSync(dirname(file))) return;

      const source = readFileSync(file, "utf8");

      expect(source).toMatch(
        /import \{ RoutePendingSpinner \} from ['"]@vitnode\/core\/tanstack\/pending['"]/,
      );
      expect(source).toContain("defaultPendingComponent: RoutePendingSpinner");
      expect(source).toContain(`defaultPendingMs: ${PENDING_MS}`);
      expect(source).toContain(`defaultPendingMinMs: ${PENDING_MIN_MS}`);
      expect(source).toMatch(/defaultStaleReloadMode: ['"]blocking['"]/);
    },
  );
});
