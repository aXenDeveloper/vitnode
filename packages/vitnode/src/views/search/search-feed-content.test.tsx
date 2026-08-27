import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { IntlProvider } from "use-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  SearchFeedLinkProps,
  SearchFeedParams,
} from "./search-feed-content";
import type { SearchFeedPage, SearchResultItem } from "./types";

/**
 * The one boundary a render test cannot cross: the feed talks to the search API.
 *
 * `clientModule` is mocked alongside it because the real one is imported at
 * module scope, before any test has run.
 */
const fetcherClient = vi.fn();

vi.mock("@/lib/fetcher-client", () => ({
  clientModule: (pluginId: string) => ({ pluginId }),
  fetcherClient: (...args: unknown[]) => fetcherClient(...args),
}));

const { searchFeedQueryKey, SearchFeedContent } =
  await import("./search-feed-content");

const messages = {
  core: {
    search: {
      empty: "Nothing found yet.",
      loadMore: "Load more",
      loading: "Loading…",
      types: { blog_post: "Post", unknown: "Content" },
    },
  },
};

const plMessages = {
  core: {
    search: {
      empty: "Nic nie znaleziono.",
      loadMore: "Załaduj więcej",
      loading: "Ładowanie…",
      types: { blog_post: "Wpis", unknown: "Treść" },
    },
  },
};

/**
 * The link the shared feed is handed, standing in for a framework's own.
 *
 * It records what it was asked to render, which is how the tests below tell an
 * internal href (delegated here, and so client-side navigable) from an external
 * one (a bare `<a>`).
 */
const routedHrefs: string[] = [];

const TestLink = ({ children, className, href }: SearchFeedLinkProps) => {
  routedHrefs.push(href);

  return (
    <a className={className} data-routed="true" href={href}>
      {children}
    </a>
  );
};

const item = (overrides: Partial<SearchResultItem> = {}): SearchResultItem => ({
  author: {
    avatarColor: "ff0000",
    id: 1,
    name: "Ada",
    nameCode: "ada",
  },
  authorId: 1,
  containerId: null,
  containerType: null,
  content: "A short body.",
  createdAt: "2026-08-01T10:00:00.000Z",
  id: 1,
  itemId: 1,
  itemType: "blog_post",
  languageCode: "en",
  metadata: {},
  pluginId: "@vitnode/core",
  score: null,
  title: "First post",
  url: "/blog/first-post",
  ...overrides,
});

const page = (
  edges: SearchResultItem[],
  pageInfo: Partial<SearchFeedPage["pageInfo"]> = {},
): SearchFeedPage => ({
  edges,
  pageInfo: {
    count: edges.length,
    endCursor: null,
    hasNextPage: false,
    hasPreviousPage: false,
    startCursor: null,
    totalCount: edges.length,
    ...pageInfo,
  },
});

let lastQueryClient: QueryClient;

const renderFeed = ({
  initialData,
  locale = "en",
  params = { sort: "newest" },
  variant,
}: {
  initialData?: SearchFeedPage;
  locale?: string;
  params?: SearchFeedParams;
  variant?: "list" | "timeline";
} = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  lastQueryClient = queryClient;

  return render(
    <QueryClientProvider client={queryClient}>
      <IntlProvider
        locale={locale}
        messages={locale === "pl" ? plMessages : messages}
        timeZone="UTC"
      >
        <SearchFeedContent
          initialData={initialData}
          LinkComponent={TestLink}
          locale={locale}
          params={params}
          variant={variant}
        />
      </IntlProvider>
    </QueryClientProvider>,
  );
};

/** The `args.query` the feed sent on the nth call to the API. */
const queryOfCall = (index: number): Record<string, string> =>
  (
    fetcherClient.mock.calls[index]?.[1] as {
      args: { query: Record<string, string> };
    }
  ).args.query;

/** Every `args.query` the feed has sent, oldest first. */
const queriesSent = (): Record<string, string>[] =>
  fetcherClient.mock.calls.map((_, index) => queryOfCall(index));

beforeEach(() => {
  fetcherClient.mockReset();
  routedHrefs.length = 0;
  // jsdom has no IntersectionObserver, and the feed builds one to drive its
  // infinite scroll the moment a next page exists.
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      disconnect = vi.fn();
      observe = vi.fn();
      unobserve = vi.fn();
    },
  );
});

describe("translations", () => {
  it("renders strings from a bare use-intl provider, with no next-intl in the tree", () => {
    renderFeed({ initialData: page([]) });

    expect(screen.getByText("Nothing found yet.")).toBeDefined();
  });

  it("follows the provider's locale", () => {
    renderFeed({ initialData: page([]), locale: "pl" });

    expect(screen.getByText("Nic nie znaleziono.")).toBeDefined();
  });
});

describe("the locale is explicit", () => {
  it("sends the locale it was given as the query's language", async () => {
    fetcherClient.mockResolvedValue({
      json: async () => Promise.resolve(page([item()])),
    });

    renderFeed({ locale: "pl" });

    await screen.findByText("First post");
    expect(queryOfCall(0).lang).toBe("pl");
  });

  it("refetches under a different locale rather than reusing the cache", async () => {
    fetcherClient.mockResolvedValue({
      json: async () => Promise.resolve(page([item()])),
    });

    const { rerender } = renderFeed({ locale: "en" });
    await screen.findByText("First post");

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    rerender(
      <QueryClientProvider client={queryClient}>
        <IntlProvider locale="pl" messages={plMessages} timeZone="UTC">
          <SearchFeedContent
            LinkComponent={TestLink}
            locale="pl"
            params={{ sort: "newest" }}
          />
        </IntlProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(fetcherClient.mock.calls.length).toBe(2);
    });
    expect(queryOfCall(1).lang).toBe("pl");
  });
});

describe("the list variant", () => {
  it("renders one card per hit, with its type label and author", () => {
    renderFeed({
      initialData: page([
        item(),
        item({ id: 2, itemId: 2, title: "Second post" }),
      ]),
      variant: "list",
    });

    expect(screen.getByText("First post")).toBeDefined();
    expect(screen.getByText("Second post")).toBeDefined();
    expect(screen.getAllByText("Post")).toHaveLength(2);
    expect(screen.getAllByText("Ada")).toHaveLength(2);
  });

  it("falls back to the generic renderer for an unknown type", () => {
    renderFeed({
      initialData: page([item({ itemType: "something_new" })]),
      variant: "list",
    });

    expect(screen.getByText("Content")).toBeDefined();
  });

  it("renders a hit with no url as plain text", () => {
    renderFeed({ initialData: page([item({ url: null })]), variant: "list" });

    expect(screen.getByText("First post").closest("a")).toBeNull();
  });
});

describe("the timeline variant", () => {
  it("renders an ordered list, one entry per hit", () => {
    const { container } = renderFeed({
      initialData: page([
        item(),
        item({ id: 2, itemId: 2, title: "Second post" }),
      ]),
      variant: "timeline",
    });

    expect(container.querySelectorAll("ol")).toHaveLength(1);
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });

  it("wraps the whole entry in a link when the hit has a url", () => {
    renderFeed({ initialData: page([item()]), variant: "timeline" });

    const link = screen.getByText("First post").closest("a");

    expect(link?.getAttribute("href")).toBe("/blog/first-post");
    expect(link?.textContent).toContain("A short body.");
  });
});

describe("links", () => {
  it("hands an internal href to the injected component, unchanged", () => {
    renderFeed({
      initialData: page([item({ url: "/blog/first-post?page=2" })]),
      variant: "list",
    });

    expect(routedHrefs).toEqual(["/blog/first-post?page=2"]);
    expect(
      screen.getByText("First post").closest("a")?.getAttribute("href"),
    ).toBe("/blog/first-post?page=2");
  });

  it("renders an external href as a plain anchor, never through the router", () => {
    renderFeed({
      initialData: page([item({ url: "https://example.com/post" })]),
      variant: "list",
    });

    const link = screen.getByText("First post").closest("a");

    expect(link?.getAttribute("href")).toBe("https://example.com/post");
    expect(link?.dataset.routed).toBeUndefined();
    expect(routedHrefs).toEqual([]);
  });

  it.each(["mailto:hi@example.com", "//cdn.example.com/x"])(
    "keeps %s away from the router",
    url => {
      renderFeed({ initialData: page([item({ url })]), variant: "list" });

      expect(routedHrefs).toEqual([]);
      expect(
        screen.getByText("First post").closest("a")?.getAttribute("href"),
      ).toBe(url);
    },
  );
});

describe("the empty state", () => {
  it("replaces the feed entirely when nothing came back", () => {
    const { container } = renderFeed({ initialData: page([]) });

    expect(screen.getByText("Nothing found yet.")).toBeDefined();
    expect(container.querySelectorAll("ol")).toHaveLength(0);
  });

  it("shows no load-more button", () => {
    renderFeed({ initialData: page([]) });

    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("loading more", () => {
  it("shows no button when the API says there is nothing after this page", () => {
    renderFeed({ initialData: page([item()]) });

    expect(screen.queryByText("Load more")).toBeNull();
  });

  it("offers the button when another page exists", () => {
    renderFeed({
      initialData: page([item()], { endCursor: 1, hasNextPage: true }),
    });

    expect(screen.getByText("Load more")).toBeDefined();
  });

  it("fetches the next page from the cursor and appends it", async () => {
    fetcherClient.mockResolvedValue({
      json: async () =>
        Promise.resolve(
          page([item({ id: 2, itemId: 2, title: "Second post" })]),
        ),
    });

    renderFeed({
      initialData: page([item()], { endCursor: 7, hasNextPage: true }),
    });

    fireEvent.click(screen.getByText("Load more"));

    expect(await screen.findByText("Second post")).toBeDefined();
    expect(screen.getByText("First post")).toBeDefined();
    // Not `calls[0]`: React Query treats `initialData` as already stale and
    // revalidates page one on mount, so the cursor request is not the first.
    expect(queriesSent().map(query => query.cursor)).toContain("7");
    // The button goes away with the page that offered it.
    expect(screen.queryByText("Load more")).toBeNull();
  });

  it("observes a sentinel so scrolling loads the next page too", () => {
    const observe = vi.fn();

    vi.stubGlobal(
      "IntersectionObserver",
      class {
        disconnect = vi.fn();
        observe = observe;
        unobserve = vi.fn();
      },
    );

    renderFeed({
      initialData: page([item()], { endCursor: 1, hasNextPage: true }),
    });

    expect(observe).toHaveBeenCalledTimes(1);
  });
});

describe("the loading state", () => {
  it("renders skeletons until the first page arrives", async () => {
    let resolvePage: (value: {
      json: () => Promise<SearchFeedPage>;
    }) => void = () => undefined;

    fetcherClient.mockReturnValue(
      new Promise(resolve => {
        resolvePage = resolve;
      }),
    );

    const { container } = renderFeed();

    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(0);

    resolvePage({ json: async () => Promise.resolve(page([item()])) });
    expect(await screen.findByText("First post")).toBeDefined();
  });
});

/**
 * The handle a prefetching framework needs.
 *
 * A TanStack Start route loader warms the cache before this component exists, so
 * the key it writes and the key the component reads have to be the same one -
 * otherwise the feed mounts, misses, and fetches page one all over again.
 */
describe("the exported query key", () => {
  it("is the entry the feed actually stores its pages under", () => {
    const params: SearchFeedParams = { sort: "newest" };

    renderFeed({ initialData: page([item()]), locale: "pl", params });

    const cached = lastQueryClient.getQueryData(
      searchFeedQueryKey({ locale: "pl", params }),
    );

    expect(cached).toBeDefined();
  });

  it("separates two locales and two parameter sets", () => {
    const key = (locale: string, params: SearchFeedParams) =>
      JSON.stringify(searchFeedQueryKey({ locale, params }));

    expect(key("en", { sort: "newest" })).not.toBe(
      key("pl", { sort: "newest" }),
    );
    expect(key("en", { sort: "newest" })).not.toBe(
      key("en", { sort: "oldest" }),
    );
    expect(key("en", { sort: "newest" })).toBe(key("en", { sort: "newest" }));
  });
});
