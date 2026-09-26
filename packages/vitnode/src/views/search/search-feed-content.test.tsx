import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SearchFeedListQuery } from "./search-feed-content";
import type { SearchResultItem } from "./types";

vi.mock("use-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    className,
    to,
  }: {
    children: React.ReactNode;
    className?: string;
    to: string;
  }) => (
    <a className={className} href={to}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/date-format", () => ({
  DateFormat: () => <span>date</span>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipWithContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.stubGlobal(
  "IntersectionObserver",
  class {
    disconnect = vi.fn();
    observe = vi.fn();
  },
);

const { SearchFeedList } = await import("./search-feed-content");

const item = (overrides: Partial<SearchResultItem>): SearchResultItem => ({
  author: null,
  authorId: 1,
  containerId: null,
  containerType: null,
  content: "Body.",
  createdAt: "2026-09-01T10:00:00.000Z",
  id: 1,
  isPublic: true,
  itemId: 1,
  itemType: "blog.post",
  languageCode: "en",
  metadata: {},
  pluginId: "@vitnode/blog",
  score: null,
  title: "Published post",
  url: "/en/blog/published-post",
  ...overrides,
});

const queryOf = (
  items: SearchResultItem[],
  overrides: Partial<SearchFeedListQuery> = {},
): SearchFeedListQuery => ({
  data: {
    pages: [
      {
        edges: items,
        pageInfo: {
          count: items.length,
          endCursor: null,
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: null,
          totalCount: items.length,
        },
      },
    ],
  },
  fetchNextPage: vi.fn(async () => Promise.resolve()),
  hasNextPage: false,
  isFetchingNextPage: false,
  isLoading: false,
  ...overrides,
});

const draft = item({
  id: 2,
  isPublic: false,
  itemId: 2,
  title: "Draft post",
  url: null,
});

describe.each(["list", "timeline"] as const)("SearchFeedList (%s)", variant => {
  it("marks a draft and leaves its title unlinked", () => {
    render(<SearchFeedList query={queryOf([draft])} variant={variant} />);

    expect(screen.getByText("draft")).toBeTruthy();
    expect(screen.getByText("Draft post").closest("a")).toBeNull();
  });

  it("links a published item and does not mark it", () => {
    render(<SearchFeedList query={queryOf([item({})])} variant={variant} />);

    expect(screen.queryByText("draft")).toBeNull();
    expect(
      screen.getByText("Published post").closest("a")?.getAttribute("href"),
    ).toBe("/en/blog/published-post");
  });

  it("says so when there is nothing to show", () => {
    render(<SearchFeedList query={queryOf([])} variant={variant} />);

    expect(screen.getByText("empty")).toBeTruthy();
  });

  it("loads the next page on request", () => {
    const fetchNextPage = vi.fn(async () => Promise.resolve());

    render(
      <SearchFeedList
        query={queryOf([item({})], { fetchNextPage, hasNextPage: true })}
        variant={variant}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "loadMore" }));

    expect(fetchNextPage).toHaveBeenCalled();
  });
});
