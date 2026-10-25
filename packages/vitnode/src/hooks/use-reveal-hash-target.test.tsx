import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRevealHashTarget } from "./use-reveal-hash-target";

const PAGE_SIZE = 10;

const Thread = ({
  loadMore,
  maxLoads,
  total,
}: {
  loadMore: () => void;
  maxLoads?: number;
  total: number;
}) => {
  const [count, setCount] = React.useState(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const { status } = useRevealHashTarget({
    hasMore: count < total,
    isLoadingMore,
    loadMore: async () => {
      loadMore();
      setIsLoadingMore(true);
      await Promise.resolve();
      setCount(value => Math.min(value + PAGE_SIZE, total));
      setIsLoadingMore(false);
    },
    maxLoads,
    prefix: "comment-",
    ready: true,
    renderedCount: count,
  });

  return (
    <main>
      <p data-testid="status">{status}</p>
      <ol>
        {Array.from({ length: count }, (_, index) => (
          <li id={`comment-${index + 1}`} key={index} tabIndex={-1}>
            Comment {index + 1}
          </li>
        ))}
      </ol>
    </main>
  );
};

const mount = async ({
  hash,
  maxLoads,
  total,
}: {
  hash: string;
  maxLoads?: number;
  total: number;
}) => {
  window.location.hash = hash;
  const loadMore = vi.fn();
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: createRootRoute({
      component: () => (
        <Thread loadMore={loadMore} maxLoads={maxLoads} total={total} />
      ),
    }),
  });
  await act(async () => {
    await router.load();
  });
  render(<RouterProvider router={router} />);

  return { loadMore };
};

const settledStatus = async (status: string) =>
  await screen.findByText(status, { selector: "[data-testid=status]" });

describe("useRevealHashTarget", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect() {}
        observe() {}
      },
    );
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.location.hash = "";
  });

  it("loads more pages until the target is rendered, then focuses it", async () => {
    const { loadMore } = await mount({ hash: "#comment-25", total: 40 });

    await settledStatus("found");

    expect(loadMore).toHaveBeenCalledTimes(2);
    expect(document.activeElement?.id).toBe("comment-25");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it.each([
    ["the last page", { hash: "#comment-99", total: 25 }, 2],
    ["maxLoads pages", { hash: "#comment-99", maxLoads: 3, total: 200 }, 3],
  ])(
    "reports the target missing after %s",
    async (_, options, expectedLoads) => {
      const { loadMore } = await mount(options);

      await settledStatus("missing");

      expect(loadMore).toHaveBeenCalledTimes(expectedLoads);
      expect(document.activeElement?.id).not.toBe("comment-99");
    },
  );

  it("stays idle for a hash with another prefix", async () => {
    const { loadMore } = await mount({ hash: "#reply-25", total: 40 });

    await settledStatus("idle");

    expect(loadMore).not.toHaveBeenCalled();
  });
});
