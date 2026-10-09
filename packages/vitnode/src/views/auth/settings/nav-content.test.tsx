// @vitest-environment jsdom
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SettingsNavContent } from "./nav-content";

const mount = async (pathname: string) => {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <SettingsNavContent pathname={pathname} />
        <Outlet />
      </>
    ),
  });
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [pathname] }),
    routeTree: rootRoute.addChildren([
      settingsRoute.addChildren([
        createRoute({ getParentRoute: () => settingsRoute, path: "/devices" }),
        createRoute({ getParentRoute: () => settingsRoute, path: "/security" }),
      ]),
    ]),
  });

  render(<RouterProvider router={router} />);
  await screen.findByRole("navigation");
};

const currentLinks = () =>
  screen
    .getAllByRole("link")
    .filter(link => link.getAttribute("aria-current") === "page")
    .map(link => link.textContent);

describe("SettingsNavContent", () => {
  it("marks only the sub-panel as the current page, not the settings root", async () => {
    await mount("/settings/devices");

    expect(currentLinks()).toEqual(["core.auth.settings.nav.devices"]);
  });

  it("marks the overview as the current page on the settings root", async () => {
    await mount("/settings");

    expect(currentLinks()).toEqual(["core.auth.settings.nav.overview"]);
  });
});
