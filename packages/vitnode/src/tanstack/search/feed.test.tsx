import {
  QueryClient,
  QueryClientProvider,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SearchFeedPage, SearchResultItem } from "@/views/search/types";

const requestHeaders = new Headers();

vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeaders: () => requestHeaders,
  getRequestIP: () => "203.0.113.9",
  getRequestUrl: () => new URL("https://preview.example.com/discover"),
  setCookie: vi.fn(),
}));

const { feedQueryOptions } = await import("./feed");
const { searchFeedQueryKey, searchFeedQueryOptions } =
  await import("@/views/search/search-feed-query");

const item = (id: number): SearchResultItem => ({
  author: { avatarColor: "ff0000", id: 1, name: "Ada", nameCode: "ada" },
  authorId: 1,
  containerId: null,
  containerType: null,
  content: "A short body.",
  createdAt: "2026-08-01T10:00:00.000Z",
  id,
  itemId: id,
  itemType: "blog_post",
  languageCode: "en",
  metadata: {},
  pluginId: "@vitnode/core",
  score: null,
  title: `Post ${id}`,
  url: `/blog/post-${id}`,
});

const page = (id: number, endCursor: null | number): SearchFeedPage => ({
  edges: [item(id)],
  pageInfo: {
    count: 1,
    endCursor,
    hasNextPage: endCursor !== null,
    hasPreviousPage: false,
    startCursor: id,
    totalCount: 2,
  },
});

const apiFetch = vi.fn<(url: string | URL, init?: RequestInit) => Response>();

const cursorsAsked = (): (null | string)[] =>
  apiFetch.mock.calls.map(
    ([url]) => new URL(String(url)).searchParams.get("cursor") ?? null,
  );

const locale = "en";
const params = { sort: "newest" } as const;

let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockImplementation(url => {
    const cursor = new URL(String(url)).searchParams.get("cursor");

    return new Response(
      JSON.stringify(cursor === null ? page(1, 1) : page(2, null)),
      { headers: { "content-type": "application/json" }, status: 200 },
    );
  });
  vi.stubGlobal("fetch", apiFetch);
  vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
  requestHeaders.set("cookie", "vitnode_auth=abc");
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

describe("an SSR-warmed feed is the feed the browser reads back", () => {
  it("fills the cache entry the client's own definition names", async () => {
    await queryClient.ensureInfiniteQueryData(
      feedQueryOptions({ locale, params }),
    );

    // The route's `feedQueryOptions` and a framework-neutral component's
    // `searchFeedQueryOptions` must name one entry, or the loader warms
    // something the component never looks at.
    expect(feedQueryOptions({ locale, params }).queryKey).toEqual(
      searchFeedQueryKey({ locale, params }),
    );
    expect(searchFeedQueryOptions({ locale, params }).queryKey).toEqual(
      searchFeedQueryKey({ locale, params }),
    );

    const cached = queryClient.getQueryData<{
      pageParams: unknown[];
      pages: SearchFeedPage[];
    }>(searchFeedQueryKey({ locale, params }));

    expect(cached?.pages).toHaveLength(1);
    expect(cached?.pageParams).toEqual([null]);
  });

  it("fetched that page over the request-aware transport", async () => {
    await queryClient.ensureInfiniteQueryData(
      feedQueryOptions({ locale, params }),
    );

    const [url, init] = apiFetch.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);

    expect(new URL(String(url)).pathname).toBe("/api/@vitnode/core/search");
    expect(headers.get("Cookie")).toBe("vitnode_auth=abc");
  });

  it("renders from that entry without asking again, then appends page two", async () => {
    await queryClient.ensureInfiniteQueryData(
      feedQueryOptions({ locale, params }),
    );

    expect(apiFetch).toHaveBeenCalledTimes(1);

    const { result } = renderHook(
      () => useInfiniteQuery(feedQueryOptions({ locale, params })),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The hydrated page is fresh, so mounting the feed costs no round trip.
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(result.current.data?.pages).toHaveLength(1);

    await result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));

    // Page one is not asked for a second time: the second request carries the
    // cursor the first page ended on.
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(cursorsAsked()).toEqual([null, "1"]);
    expect(result.current.data?.pages.flatMap(one => one.edges)).toHaveLength(
      2,
    );
    expect(result.current.hasNextPage).toBe(false);
  });
});
