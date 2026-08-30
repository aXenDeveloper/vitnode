// @vitest-environment node
import { describe, expect, it } from "vitest";

import { contentListQueryOptions } from "@/views/admin/views/content/table/list-query";
import { adminStaffQueryOptions } from "@/views/admin/views/core/staff/staff-query";
import { adminUsersQueryOptions } from "@/views/admin/views/core/users/list/users-query";
import { myFilesQueryOptions } from "@/views/files/my-files-query";
import { searchFeedQueryOptions } from "@/views/search/search-feed-query";

/**
 * The five reads that can be given up on, and the one property that decides it.
 *
 * TanStack Query marks a query cancellable **only when its `queryFn` actually
 * reads the `signal` getter off the context**. Not when the option is set, not
 * when the fetcher would accept one - when the function reads it. Before Stage
 * 14 no query function in VitNode did: every one was written `async () => await
 * fetch…` with the context argument dropped, so a superseded sort, a re-typed
 * search term or an abandoned page press left its request running to completion
 * and landing late on top of the answer somebody was reading.
 *
 * These are the paged and searched reads where that is worth something. The
 * session reads are deliberately not among them - a guard blocks navigation
 * while it runs, and there is nothing to supersede it with.
 *
 * ## What this asserts, and what it deliberately does not
 *
 * It calls each `queryFn` with a fake context carrying a signal of our own and
 * checks the fetcher was handed *that* signal. That is the whole seam: it is
 * pure - no React, no router, no HTTP - and it is exactly the link that was
 * missing, because everything below it (`fetcherClient` → `coreFetcher` →
 * `rawApiFetch` → `fetch`) already threaded `options` through untouched.
 *
 * `lib/fetcher/raw.test.ts` owns the other end - that `options.signal` reaches
 * the real `fetch` - and `./cancellation-degrades.test.ts` owns the rule that
 * decides whether any of this is safe: an abort must reject, never resolve.
 */

/**
 * Runs a query definition's own function with a context we control.
 *
 * The single deliberate cast in this file, and it is confined here: each
 * factory's `queryFn` is typed against its own literal key tuple, so calling
 * seven of them through one helper needs the context widened once rather than at
 * every call. What is being followed is the *signal*, and nothing about that
 * depends on the key's type.
 */
const runQueryFn = async (
  options: { queryFn?: unknown },
  context: { pageParam?: unknown; signal: AbortSignal },
): Promise<unknown> => {
  const queryFn = options.queryFn as (context: {
    pageParam?: unknown;
    signal: AbortSignal;
  }) => Promise<unknown>;

  return await queryFn(context);
};

const TARGET = {
  permissionModule: "post",
  pluginId: "@vitnode/blog",
} as const;

/**
 * Each read, reduced to "run its query function and say which signal the fetcher
 * saw". The fetchers are spies rather than the real ones, which is what keeps
 * this a contract test instead of a network one.
 */
const READS = {
  "admin staff list": async (signal: AbortSignal) => {
    let seen: AbortSignal | undefined;
    const options = adminStaffQueryOptions({
      adminUserId: 1,
      fetchPage: async (_type, _params, o) => {
        seen = o?.signal;

        return await Promise.resolve({ edges: [], pageInfo: {} } as never);
      },
      params: { first: "10" },
      type: "admin",
    });

    await runQueryFn(options, { signal });

    return seen;
  },
  "admin users list": async (signal: AbortSignal) => {
    let seen: AbortSignal | undefined;
    const options = adminUsersQueryOptions({
      adminUserId: 1,
      fetchPage: async (_params, o) => {
        seen = o?.signal;

        return await Promise.resolve({ edges: [], pageInfo: {} } as never);
      },
      params: { first: "10" },
    });

    await runQueryFn(options, { signal });

    return seen;
  },
  "content list": async (signal: AbortSignal) => {
    let seen: AbortSignal | undefined;
    const options = contentListQueryOptions({
      fetchPage: async (_request, o) => {
        seen = o?.signal;

        return await Promise.resolve({ edges: [], pageInfo: {} } as never);
      },
      request: {
        contentTypeId: "blog.post",
        query: { first: "25" },
        target: TARGET,
      },
    });

    await runQueryFn(options, { signal });

    return seen;
  },
  "my files": async (signal: AbortSignal) => {
    let seen: AbortSignal | undefined;
    const options = myFilesQueryOptions({
      fetchPage: async (_params, o) => {
        seen = o?.signal;

        return await Promise.resolve({ edges: [], pageInfo: {} } as never);
      },
      params: { first: "10" },
      userId: 3,
    });

    await runQueryFn(options, { signal });

    return seen;
  },
  "search feed": async (signal: AbortSignal) => {
    let seen: AbortSignal | undefined;
    const options = searchFeedQueryOptions({
      fetchPage: async (_args, o) => {
        seen = o?.signal;

        return await Promise.resolve({ edges: [], pageInfo: {} } as never);
      },
      locale: "en",
      params: {},
    });

    await runQueryFn(options, { pageParam: null, signal });

    return seen;
  },
} as const;

describe("a cancellable read hands its signal to its fetcher", () => {
  it.each(Object.entries(READS))("%s", async (_name, run) => {
    const controller = new AbortController();

    expect(await run(controller.signal)).toBe(controller.signal);
  });

  /**
   * Identity rather than presence, and the distinction matters: a fetcher handed
   * *a* signal that is not the query's own would look cancellable and never
   * cancel. `toBe` above already pins it; this states the negative directly.
   */
  it.each(Object.entries(READS))(
    "%s does not substitute a signal of its own",
    async (_name, run) => {
      const mine = new AbortController();
      const other = new AbortController();

      expect(await run(mine.signal)).not.toBe(other.signal);
    },
  );

  /**
   * And the abort actually reaches the fetcher, rather than a copy that stays
   * open. `AbortSignal` has no clone that preserves state, so this is really an
   * assertion that the same object crossed the seam - which is what makes
   * `fetch` see the abort.
   */
  it.each(Object.entries(READS))(
    "%s forwards a signal that is already aborted",
    async (_name, run) => {
      const controller = new AbortController();
      controller.abort();

      const seen = await run(controller.signal);

      expect(seen?.aborted).toBe(true);
    },
  );
});

/**
 * The SSR half of the same contract.
 *
 * Each fetcher's signal argument is **optional**, which is what lets the server
 * branch of a `createIsomorphicFn` pair - written with one parameter, and handed
 * no signal deliberately - satisfy the same type. A route loader's
 * `ensureQueryData` must not pass the router's own abort signal: the router
 * cancels preloads aggressively, and a shared cache entry cancelled by an
 * abandoned hover would leave the next reader with no data and no error.
 */
describe("the signal argument is optional", () => {
  it.each([
    [
      "admin users",
      () =>
        adminUsersQueryOptions({
          adminUserId: 1,
          fetchPage: async params => {
            expect(params).toBeDefined();

            return await Promise.resolve({ edges: [], pageInfo: {} } as never);
          },
          params: { first: "10" },
        }),
    ],
    [
      "content list",
      () =>
        contentListQueryOptions({
          fetchPage: async request => {
            expect(request).toBeDefined();

            return await Promise.resolve({ edges: [], pageInfo: {} } as never);
          },
          request: {
            contentTypeId: "blog.post",
            query: {},
            target: TARGET,
          },
        }),
    ],
    [
      "my files",
      () =>
        myFilesQueryOptions({
          fetchPage: async params => {
            expect(params).toBeDefined();

            return await Promise.resolve({ edges: [], pageInfo: {} } as never);
          },
          params: {},
          userId: 3,
        }),
    ],
  ])("%s accepts a one-parameter fetcher", async (_name, build) => {
    const controller = new AbortController();

    await expect(
      runQueryFn(build(), { signal: controller.signal }),
    ).resolves.toBeDefined();
  });
});
