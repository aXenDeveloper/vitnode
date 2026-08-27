import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import {
  NextIntlClientProvider,
  IntlProvider as NextIntlIntlProvider,
} from "next-intl";
import React from "react";
import { IntlProvider } from "use-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SearchFeedPage, SearchResultItem } from "./types";

const fetcherClient = vi.fn();

vi.mock("@/lib/fetcher-client", () => ({
  clientModule: (pluginId: string) => ({ pluginId }),
  fetcherClient: (...args: unknown[]) => fetcherClient(...args),
}));

/**
 * `next-intl`'s `Link` stands in for itself here.
 *
 * `lib/navigation` is built on `next-intl/navigation`, which imports
 * `next/navigation` - a bare CJS file that Next only ever resolves through its
 * own bundler, so loading it under Vite fails outright. Mocking the module keeps
 * this suite about the wrapper's job (resolve the locale, hand the shared feed a
 * link) rather than about Next's router.
 *
 * The stand-in honours the same contract the real one does for an internal
 * href: render an anchor at that path. That `lib/navigation` is what the wrapper
 * actually reaches for is asserted in `feed-boundaries.test.ts`, and the real
 * locale prefixing is covered by the docs app's end-to-end suite.
 */
vi.mock("@/lib/navigation", () => ({
  Link: ({
    children,
    className,
    href,
  }: {
    children: React.ReactNode;
    className?: string;
    href: string;
  }) => (
    <a className={className} data-next-intl-link="true" href={href}>
      {children}
    </a>
  ),
}));

const { SearchFeed } = await import("./search-feed");

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

const hit: SearchResultItem = {
  author: null,
  authorId: null,
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
};

const page = (edges: SearchResultItem[]): SearchFeedPage => ({
  edges,
  pageInfo: {
    count: edges.length,
    endCursor: null,
    hasNextPage: false,
    hasPreviousPage: false,
    startCursor: null,
    totalCount: edges.length,
  },
});

const renderWrapper = (locale: string, initialData?: SearchFeedPage) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {/* Deliberately the *Next* provider, and only it - see the suite above. */}
      <NextIntlClientProvider
        locale={locale}
        messages={messages}
        timeZone="UTC"
      >
        <SearchFeed
          initialData={initialData}
          params={{ sort: "newest" }}
          variant="timeline"
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  fetcherClient.mockReset();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      disconnect = vi.fn();
      observe = vi.fn();
      unobserve = vi.fn();
    },
  );
});

/**
 * The assumption the whole split rests on.
 *
 * `@vitnode/core` now imports `use-intl` directly while the Next.js app still
 * provides through `next-intl`. That only works because the two are the same
 * module - `next-intl` re-exports `use-intl/react`'s provider verbatim - so they
 * share one React context. Should a version bump ever give `@vitnode/core` its
 * own copy of `use-intl`, every core component that translates would throw
 * "No intl context found" in the Next.js app, at runtime rather than at build
 * time. This is the cheap early warning.
 */
describe("core's use-intl is the same instance next-intl provides into", () => {
  it("resolves to one provider component, not two", () => {
    expect(IntlProvider).toBe(NextIntlIntlProvider);
  });
});

describe("the Next wrapper", () => {
  it("renders the shared feed under next-intl's provider alone", () => {
    renderWrapper("en", page([hit]));

    expect(screen.getByText("First post")).toBeDefined();
    expect(screen.getByText("A short body.")).toBeDefined();
  });

  it("translates through the Next provider", () => {
    renderWrapper("en", page([]));

    expect(screen.getByText("Nothing found yet.")).toBeDefined();
  });

  it("passes the locale next-intl resolved into the search query", async () => {
    fetcherClient.mockResolvedValue({
      json: async () => Promise.resolve(page([hit])),
    });

    renderWrapper("pl");

    await screen.findByText("First post");

    const { args } = fetcherClient.mock.calls[0]?.[1] as {
      args: { query: Record<string, string> };
    };

    expect(args.query.lang).toBe("pl");
  });

  it("renders result links through next-intl's locale-aware Link", () => {
    renderWrapper("en", page([hit]));

    const link = screen.getByText("First post").closest("a");

    expect(link?.dataset.nextIntlLink).toBe("true");
    expect(link?.getAttribute("href")).toBe("/blog/first-post");
  });
});
