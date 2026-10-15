import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HrefLink, useHrefNavigate } from "./href-link";

const NavigateButton = ({ href }: { href: string }) => {
  const navigate = useHrefNavigate();

  return (
    <button onClick={() => void navigate(href)} type="button">
      Go
    </button>
  );
};

const mount = async (ui: React.ReactNode, pathname = "/") => {
  const root = createRootRoute({
    component: () => (
      <>
        {ui}
        <Outlet />
      </>
    ),
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [pathname] }),
    routeTree: root.addChildren([
      createRoute({ getParentRoute: () => root, path: "/" }),
      createRoute({ getParentRoute: () => root, path: "/forum" }),
      createRoute({ getParentRoute: () => root, path: "/forum/$slug" }),
      createRoute({ getParentRoute: () => root, path: "/forum/create/topic" }),
    ]),
  });

  render(<RouterProvider router={router} />);
  await router.load();

  return router;
};

describe("HrefLink", () => {
  it.each([
    "/forum/news?cursor=abc#comment-7",
    "/forum/create/topic?forum=123",
    "/forum/news?created=true",
  ])("renders the internal href %s as written", async href => {
    await mount(<HrefLink href={href}>Link</HrefLink>);

    expect(
      (await screen.findByRole("link", { name: "Link" })).getAttribute("href"),
    ).toBe(href);
  });

  it.each(["https://example.com/forum?a=1", "//cdn.example.com/forum"])(
    "renders the external href %s as a plain anchor",
    async href => {
      await mount(<HrefLink href={href}>Link</HrefLink>);

      expect(
        (await screen.findByRole("link", { name: "Link" })).getAttribute(
          "href",
        ),
      ).toBe(href);
    },
  );

  it("navigates client-side, with the search parsed by the router", async () => {
    const router = await mount(
      <HrefLink href="/forum/news?cursor=abc&page=2#top">Next</HrefLink>,
    );

    const link = await screen.findByRole("link", { name: "Next" });

    expect(fireEvent.click(link)).toBe(false);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/forum/news");
    });
    expect(router.state.location.search).toEqual({ cursor: "abc", page: 2 });
    expect(router.state.location.hash).toBe("top");
  });

  it("marks only a link to exactly this URL as the current page", async () => {
    await mount(
      <>
        <HrefLink href="/forum">Forums</HrefLink>
        <HrefLink href="/forum/news">News</HrefLink>
      </>,
      "/forum/news",
    );

    expect(
      (await screen.findByRole("link", { name: "News" })).getAttribute(
        "aria-current",
      ),
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: "Forums" }).getAttribute("aria-current"),
    ).toBeNull();
  });
});

describe("useHrefNavigate", () => {
  it("navigates to an internal href with its query and hash", async () => {
    const router = await mount(
      <NavigateButton href="/forum/create/topic?forum=123#form" />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Go" }));

    await waitFor(() => {
      expect(router.state.location.href).toBe(
        "/forum/create/topic?forum=123#form",
      );
    });
    expect(router.state.location.search).toEqual({ forum: 123 });
  });
});
