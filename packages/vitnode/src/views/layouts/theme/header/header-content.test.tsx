import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HeaderLayoutContent } from "./header-content";

const mount = async ({
  isNavigationPending,
}: {
  isNavigationPending: boolean;
}) => {
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: createRootRoute({
      component: () => (
        <HeaderLayoutContent
          isNavigationPending={isNavigationPending}
          logo="VitNode"
          moreNavigationLabel="More"
          navigation={[{ href: "/search", id: "1", label: "Search" }]}
          navigationLoadingLabel="Loading navigation"
        />
      ),
    }),
  });

  await act(async () => {
    await router.load();
  });
  render(<RouterProvider router={router} />);
};

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect() {}
      observe() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the header while its navigation loads", () => {
  it("holds the navigation's place with an announced placeholder", async () => {
    await mount({ isNavigationPending: true });

    expect(screen.getByRole("status").textContent).toBe("Loading navigation");
    expect(screen.queryByRole("link", { name: "Search" })).toBeNull();
  });

  it("shows the links once they are known", async () => {
    await mount({ isNavigationPending: false });

    expect(screen.getByRole("link", { name: "Search" })).toBeDefined();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
