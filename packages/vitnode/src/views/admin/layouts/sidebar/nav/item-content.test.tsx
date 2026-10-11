import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarMenu, SidebarProvider } from "@/components/ui/sidebar";

import { ItemNavAdminContent } from "./item-content";

const USERS_ITEMS = [
  { href: "/admin/core/users", title: "User List" },
  { href: "/admin/core/users/roles", title: "Roles" },
];

const mount = async ({
  pathname,
  sidebarOpen,
}: {
  pathname: string;
  sidebarOpen: boolean;
}) => {
  const rootRoute = createRootRoute({
    component: () => (
      <SidebarProvider defaultOpen={sidebarOpen}>
        <SidebarMenu>
          <ItemNavAdminContent
            href="/admin/core/users"
            items={USERS_ITEMS}
            pathname={pathname}
            title="Users"
          />
        </SidebarMenu>
        <Outlet />
      </SidebarProvider>
    ),
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [pathname] }),
    routeTree: rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: "/admin/core" }),
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/admin/core/users",
      }),
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/admin/core/users/roles",
      }),
    ]),
  });

  render(<RouterProvider router={router} />);

  return { router, trigger: await screen.findByRole("button") };
};

describe("ItemNavAdminContent", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        addEventListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens a menu of sub-pages from the icon when the sidebar is collapsed", async () => {
    const { router, trigger } = await mount({
      pathname: "/admin/core",
      sidebarOpen: false,
    });

    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Roles" }));

    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe("/admin/core/users/roles");
    });
  });

  it("marks the current sub-page in the collapsed menu", async () => {
    const { trigger } = await mount({
      pathname: "/admin/core/users/roles",
      sidebarOpen: false,
    });

    fireEvent.click(trigger);

    const roles = await screen.findByRole("menuitem", { name: "Roles" });

    expect(roles.hasAttribute("data-current")).toBe(true);
    expect(
      screen
        .getByRole("menuitem", { name: "User List" })
        .hasAttribute("data-current"),
    ).toBe(false);
  });

  it("keeps the inline sub-links when the sidebar is expanded", async () => {
    await mount({ pathname: "/admin/core/users", sidebarOpen: true });

    expect(screen.queryByRole("menu")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Roles" }).getAttribute("href"),
    ).toBe("/admin/core/users/roles");
  });
});
