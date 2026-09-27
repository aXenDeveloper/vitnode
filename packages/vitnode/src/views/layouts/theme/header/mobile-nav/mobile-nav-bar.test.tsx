import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HeaderNavChildItem, HeaderNavItem } from "../header-nav";

import { MobileNavBar } from "./mobile-nav-bar";

const items: HeaderNavChildItem[] = [
  { href: "/", icon: "emoji:🏠", id: "1", label: "Home" },
  { href: "/blog", id: "2", label: "Blog" },
];

const rest: HeaderNavItem[] = [
  {
    href: "/community",
    id: "3",
    items: [{ href: "/community/rules", id: "31", label: "Rules" }],
    label: "Community",
  },
  { href: "/docs", id: "4", label: "Docs" },
];

const mount = async ({
  menu = rest,
  path = "/",
  shown = items,
}: {
  menu?: HeaderNavItem[];
  path?: string;
  shown?: HeaderNavChildItem[];
} = {}) => {
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
    routeTree: createRootRoute({
      component: () => <MobileNavBar items={shown} menuNavigation={menu} />,
    }),
  });

  await act(async () => {
    await router.load();
  });
  render(<RouterProvider router={router} />);
};

const menuTab = async () =>
  await screen.findByRole("button", { name: "core.global.mobile_nav.menu" });

describe("the mobile tab bar", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect() {}
        observe() {}
      },
    );
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks the tab of the current section", async () => {
    await mount({ path: "/blog/first-post" });

    expect(
      (await screen.findByRole("link", { name: "Blog" })).getAttribute(
        "aria-current",
      ),
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: /Home/ }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("matches the home tab only on the home page", async () => {
    await mount({ path: "/" });

    expect(
      (await screen.findByRole("link", { name: /Home/ })).getAttribute(
        "aria-current",
      ),
    ).toBe("page");
  });

  it("ends with a Menu tab that opens the rest of the header menu", async () => {
    await mount();

    fireEvent.click(await menuTab());
    const drawer = await screen.findByRole("dialog");

    expect(within(drawer).getByRole("link", { name: "Docs" })).toBeTruthy();
    expect(within(drawer).getByRole("link", { name: "Rules" })).toBeTruthy();
    expect(within(drawer).queryByRole("link", { name: "Blog" })).toBeNull();
  });

  it("closes the menu once a link in it is followed", async () => {
    await mount();

    fireEvent.click(await menuTab());
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("link", {
        name: "Docs",
      }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("lights the Menu tab on a page that lives in the menu", async () => {
    await mount({ path: "/docs" });

    expect((await menuTab()).getAttribute("data-current")).toBe("true");
  });

  it("drops the Menu tab when nothing is left for it", async () => {
    await mount({ menu: [] });

    await screen.findByRole("link", { name: "Blog" });

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders nothing without items", async () => {
    await mount({ shown: [] });

    expect(screen.queryByRole("navigation")).toBeNull();
  });
});
