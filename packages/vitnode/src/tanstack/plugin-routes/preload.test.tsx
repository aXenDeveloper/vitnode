import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PluginRouteDeclaration, PluginRouteRequirement } from "@/routing";

import { createVitNodeQueryClient } from "@/lib/query-client";
import { definePluginRoutes, lazy, page } from "@/routing";

import type { SessionApi } from "../auth/session-api";
import type { PluginRoutePageHead, PluginRouteRuntimeContext } from "./mount";

import { LOGIN_PATH } from "../auth/redirects";
import { setSessionData } from "../auth/session-query";
import { withVitNodeRoutes } from "./mount";
import { pluginRouteSpecs } from "./specs";

const PRELOAD_DELAY = 250;

const pageHead: PluginRoutePageHead = () => ({ meta: [] });

const pageWith = (
  path: string,
  load: (args: { context: PluginRouteRuntimeContext }) => unknown,
  options: { preload?: boolean; requires?: PluginRouteRequirement } = {},
) =>
  page(path, {
    ...options,
    component: lazy(async () =>
      Promise.resolve({
        default: ({ loaderData }: { loaderData: unknown }) => (
          <p>{`${path}: ${String(loaderData)}`}</p>
        ),
        route: { load },
      }),
    ),
  });

const mount = async (routes: PluginRouteDeclaration[]) => {
  const queryClient = createVitNodeQueryClient();
  const root = createRootRoute({
    component: () => (
      <>
        <nav>
          {routes.map(route => (
            <Link key={route.path} to={route.path ?? "/"}>
              {route.path}
            </Link>
          ))}
        </nav>
        <Outlet />
      </>
    ),
  });

  root.addChildren([
    createRoute({ getParentRoute: () => root, path: "/" }),
    createRoute({
      component: () => <p>Sign in</p>,
      getParentRoute: () => root,
      path: LOGIN_PATH,
    }),
  ]);

  const router = createRouter({
    context: { locale: "en", queryClient },
    defaultPreload: "intent",
    defaultPreloadDelay: PRELOAD_DELAY,
    defaultPreloadStaleTime: 0,
    defaultStaleReloadMode: "blocking",
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: withVitNodeRoutes(
      root,
      pluginRouteSpecs([
        { pluginId: "plugin", routes: definePluginRoutes(routes) },
      ]),
      { pageHead },
    ),
  });

  await act(async () => {
    await router.load();
  });
  render(<RouterProvider router={router} />);

  return { queryClient, router };
};

const wait = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const linkTo = (path: string) => screen.getByRole("link", { name: path });

describe("preloading a plugin route on intent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["does not run a loader for a hover that leaves before the delay", 249, 0],
    ["runs the loader once for a hover that rests", PRELOAD_DELAY, 1],
  ])("%s", async (_, hoverFor, expectedLoads) => {
    const load = vi.fn(() => "loaded");

    await mount([pageWith("/topics", load)]);

    fireEvent.mouseEnter(linkTo("/topics"));
    await wait(hoverFor);
    fireEvent.mouseLeave(linkTo("/topics"));
    await wait(1000);

    expect(load).toHaveBeenCalledTimes(expectedLoads);
  });

  it("skips the loader of a route declared `preload: false`, until the click", async () => {
    const load = vi.fn(() => "loaded");

    await mount([pageWith("/reports", load, { preload: false })]);

    fireEvent.mouseEnter(linkTo("/reports"));
    await wait(1000);

    expect(load).not.toHaveBeenCalled();

    fireEvent.click(linkTo("/reports"));
    await wait(1000);

    expect(load).toHaveBeenCalledTimes(1);
    expect(screen.getByText("/reports: loaded")).toBeTruthy();
  });

  it("still guards a `preload: false` route on navigation", async () => {
    const load = vi.fn(() => "secret");
    const { queryClient, router } = await mount([
      pageWith("/private", load, { preload: false, requires: "authenticated" }),
    ]);

    setSessionData(queryClient, { user: null } as unknown as SessionApi);

    fireEvent.mouseEnter(linkTo("/private"));
    await wait(1000);
    fireEvent.click(linkTo("/private"));
    await wait(1000);

    expect(router.state.location.pathname).toBe(LOGIN_PATH);
    expect(screen.getByText("Sign in")).toBeTruthy();
    expect(load).not.toHaveBeenCalled();
  });

  it("fetches once across the hover and the click when `load` reads through the query cache", async () => {
    const queryFn = vi.fn(async () => Promise.resolve("topic"));

    await mount([
      pageWith(
        "/topic",
        async ({ context }) =>
          await context.queryClient.query({
            queryFn,
            queryKey: ["topic"],
            staleTime: 30_000,
          }),
      ),
    ]);

    fireEvent.mouseEnter(linkTo("/topic"));
    await wait(PRELOAD_DELAY);
    fireEvent.click(linkTo("/topic"));
    await wait(1000);

    expect(screen.getByText("/topic: topic")).toBeTruthy();
    expect(queryFn).toHaveBeenCalledTimes(1);
  });
});
