// @vitest-environment jsdom
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useSearch,
} from "@tanstack/react-router";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ContentListSearch } from "./list-page";

import {
  ContentCard,
  ContentListEmpty,
  ContentListFilter,
  contentListPageNumbers,
  ContentListPagination,
  ContentListSearchForm,
} from "./list";
import { contentListSearch } from "./list-page";

const validate = contentListSearch({
  delivery: {
    list: {
      enabled: true,
      filters: [{ kind: "boolean", name: "vegetarian", values: null }],
      pageSize: 12,
      path: "/recipes",
      searchable: true,
    },
  },
});

const mount = async (
  url: string,
  Screen: (props: { search: ContentListSearch }) => React.ReactNode,
) => {
  const ListScreen = () => {
    const search = useSearch({ strict: false });

    return <Screen search={validate(search)} />;
  };

  const rootRoute = createRootRoute({ component: Outlet });
  const listRoute = createRoute({
    component: ListScreen,
    getParentRoute: () => rootRoute,
    path: "/recipes",
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [url] }),
    routeTree: rootRoute.addChildren([listRoute]),
  });

  await act(async () => {
    await router.load();
  });
  render(<RouterProvider router={router} />);

  return router;
};

const currentSearch = (router: Awaited<ReturnType<typeof mount>>) =>
  validate(router.state.location.search);

describe("ContentCard", () => {
  it("links the title to the record and keeps the image out of the tab order", async () => {
    await mount("/recipes", () => (
      <ContentCard
        description="Eggs poached in a spicy tomato sauce."
        href="/recipes/shakshuka"
        image={{ alt: "A pan of shakshuka", src: "/shakshuka.webp" }}
        meta="30 minutes"
        title="Shakshuka"
      />
    ));

    const title = await screen.findByRole("link", { name: "Shakshuka" });
    expect(title.getAttribute("href")).toBe("/recipes/shakshuka");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "Shakshuka",
    );
    expect(screen.getByText("30 minutes")).toBeTruthy();
    expect(
      screen.getByText("Eggs poached in a spicy tomato sauce."),
    ).toBeTruthy();

    const image = screen.getByAltText("A pan of shakshuka");
    const imageLink = image.closest("a");
    expect(imageLink?.getAttribute("tabindex")).toBe("-1");
    expect(imageLink?.getAttribute("aria-hidden")).toBe("true");
    // The image link is hidden, so assistive technology meets one link.
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});

describe("ContentListEmpty", () => {
  it("announces an empty list with the default text", async () => {
    await mount("/recipes", () => <ContentListEmpty />);

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("core.global.no_results.title");
  });
});

describe("contentListPageNumbers", () => {
  it("shows every page of a short list", () => {
    expect(contentListPageNumbers(2, 3)).toStrictEqual([1, 2, 3]);
  });

  it("keeps the ends and the neighbours of the current page", () => {
    expect(contentListPageNumbers(5, 10)).toStrictEqual([
      1,
      null,
      4,
      5,
      6,
      null,
      10,
    ]);
  });
});

describe("ContentListPagination", () => {
  it("renders nothing when one page holds everything", async () => {
    await mount("/recipes", ({ search }) => (
      <ContentListPagination page={1} search={search} totalPages={1} />
    ));

    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("links every page and keeps the term and the filters", async () => {
    await mount("/recipes?page=2&q=soup&vegetarian=true", ({ search }) => (
      <ContentListPagination
        page={search.page ?? 1}
        search={search}
        totalPages={3}
      />
    ));

    const current = await screen.findByRole("link", { current: "page" });
    expect(current.textContent).toBe("2");

    const first = screen.getByRole("link", { name: "1" });
    expect(first.getAttribute("href")).toBe("/recipes?q=soup&vegetarian=true");

    const next = screen.getByRole("link", { name: "core.global.next_page" });
    expect(next.getAttribute("href")).toBe(
      "/recipes?page=3&q=soup&vegetarian=true",
    );
    expect(next.getAttribute("rel")).toBe("next");
    expect(
      screen.getByRole("link", { name: "core.global.previous_page" }),
    ).toBeTruthy();
  });

  it("has no previous link on the first page and no next link on the last", async () => {
    await mount("/recipes", ({ search }) => (
      <ContentListPagination page={1} search={search} totalPages={2} />
    ));

    await screen.findByRole("navigation");
    expect(
      screen.queryByRole("link", { name: "core.global.previous_page" }),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "core.global.next_page" }),
    ).toBeTruthy();
  });
});

describe("ContentListFilter", () => {
  const options = [
    { label: "Vegetarian", value: true },
    { label: "With meat", value: false },
  ];

  it("marks All as current until a value is chosen", async () => {
    const router = await mount("/recipes?page=2", ({ search }) => (
      <ContentListFilter
        label="Diet"
        name="vegetarian"
        options={options}
        search={search}
      />
    ));

    expect(
      (await screen.findByRole("navigation", { name: "Diet" })).tagName,
    ).toBe("NAV");
    expect(screen.getByRole("link", { current: "page" }).textContent).toBe(
      "core.global.all",
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("link", { name: "Vegetarian" }));
    });

    // Back to the first page: page 2 of all recipes is not page 2 of these.
    expect(currentSearch(router)).toStrictEqual({ vegetarian: true });
    expect(screen.getByRole("link", { current: "page" }).textContent).toBe(
      "Vegetarian",
    );
  });

  it("clears the filter from the All link", async () => {
    const router = await mount(
      "/recipes?vegetarian=false&q=soup",
      ({ search }) => (
        <ContentListFilter
          label="Diet"
          name="vegetarian"
          options={options}
          search={search}
        />
      ),
    );

    await act(async () => {
      fireEvent.click(
        await screen.findByRole("link", { name: "core.global.all" }),
      );
    });

    expect(currentSearch(router)).toStrictEqual({ q: "soup" });
  });
});

describe("ContentListSearchForm", () => {
  it("searches from the first page and keeps the active filters", async () => {
    const router = await mount(
      "/recipes?page=3&vegetarian=true",
      ({ search }) => <ContentListSearchForm search={search} />,
    );

    const field = await screen.findByRole("searchbox", {
      name: "core.global.search",
    });
    expect(
      document.querySelector('input[type="hidden"][name="vegetarian"]'),
    ).toBeTruthy();

    fireEvent.change(field, { target: { value: "  risotto " } });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "core.global.search" }),
      );
    });

    expect(currentSearch(router)).toStrictEqual({
      q: "risotto",
      vegetarian: true,
    });
  });

  it("removes the term when the field is cleared", async () => {
    const router = await mount("/recipes?q=soup", ({ search }) => (
      <ContentListSearchForm search={search} />
    ));

    const field = await screen.findByRole("searchbox");
    expect((field as HTMLInputElement).value).toBe("soup");

    fireEvent.change(field, { target: { value: "" } });
    await act(async () => {
      fireEvent.submit(screen.getByRole("search"));
    });

    expect(currentSearch(router)).toStrictEqual({});
  });
});
