import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HeaderNavItem } from "./header-nav";

import { HeaderNavMenu } from "./header-nav-menu";

const ITEM_WIDTH = 100;

const navigation: HeaderNavItem[] = [
  { href: "/search", id: "1", label: "Search" },
  { href: "/browse", id: "2", label: "Browse" },
  {
    href: "/community",
    id: "3",
    items: [{ href: "/community/blog", id: "31", label: "Blog" }],
    label: "Community",
  },
];

const mount = async (containerWidth: number) => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
    containerWidth,
  );

  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: createRootRoute({
      component: () => (
        <HeaderNavMenu moreLabel="More" navigation={navigation} />
      ),
    }),
  });

  await act(async () => {
    await router.load();
  });
  render(<RouterProvider router={router} />);
};

describe("the header navigation overflow", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(onResize: (entries: ResizeObserverEntry[]) => void) {
          this.onResize = onResize;
        }
        readonly onResize: (entries: ResizeObserverEntry[]) => void;
        disconnect() {}
        observe() {
          this.onResize([]);
        }
      },
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, ITEM_WIDTH, 36),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows every item and no More when they all fit", async () => {
    await mount(ITEM_WIDTH * navigation.length);

    expect(await screen.findByRole("link", { name: "Search" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Community/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /More/ })).toBeNull();
  });

  it("moves the items that do not fit into More", async () => {
    await mount(ITEM_WIDTH * 2);

    expect(await screen.findByRole("link", { name: "Search" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Browse" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /More/ }));

    expect(await screen.findByRole("link", { name: "Browse" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Community" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Blog" })).toBeTruthy();
  });
});
