// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rawApiFetch } from "@/lib/fetcher/raw";
import { fetchContentListPageInBrowser } from "@/views/admin/views/content/table/list-query";
import { fetchAdminStaffPageInBrowser } from "@/views/admin/views/core/staff/staff-query";
import { fetchAdminUsersPageInBrowser } from "@/views/admin/views/core/users/list/users-query";
import { fetchMyFilesPageInBrowser } from "@/views/files/my-files-query";
import { fetchSearchFeedPageInBrowser } from "@/views/search/search-feed-query";

/**
 * The rule that decides whether threading a signal is safe at all:
 *
 *     **an abort must reject, and must never become data.**
 *
 * A cancelled read that resolves is worse than one that never cancels. Each of
 * these five reads has a shape it must not be mistaken for, and every one of
 * them is a plausible, silent answer:
 *
 *     search feed      "no results"           — a search that found nothing
 *     my files         an empty table         — an account with nothing uploaded
 *     admin users      an empty table         — an installation with no users
 *     admin staff      an empty table         — nobody is a moderator
 *     content list     no records             — a content type never written to
 *
 * and worse than any of them, a `401` or a `403` read as an answer rather than
 * as a failure: a cancelled navigation would show a visitor as signed out, or an
 * administrator as refused.
 *
 * These are safe by construction rather than by a guard, and that is the finding
 * worth pinning: the abort rejects **inside `fetch`**, before there is a
 * `Response` for any of these functions to inspect, and none of them has a
 * `catch` that could turn a rejection into a value. A fetcher whose failure path
 * *did* return a fallback would have to re-throw the abort before degrading -
 * the middleware config and the dashboard layout are the two in this codebase
 * that would, which is why neither of them was made cancellable.
 *
 * Pure: `fetch` is stubbed to reject the way a real abort does. Nothing here
 * opens a socket.
 */

const ORIGIN = "http://localhost:3000";

/** What the platform throws when a request is aborted. */
const abortError = () => {
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";

  return error;
};

const TARGET = {
  permissionModule: "post",
  pluginId: "@vitnode/blog",
} as const;

/** The five reads that read a `signal`, each asked to cancel. */
const CANCELLABLE = {
  "admin staff list": async (signal: AbortSignal) =>
    await fetchAdminStaffPageInBrowser("admin", { first: "10" }, { signal }),
  "admin users list": async (signal: AbortSignal) =>
    await fetchAdminUsersPageInBrowser({ first: "10" }, { signal }),
  "content list": async (signal: AbortSignal) =>
    await fetchContentListPageInBrowser(
      { contentTypeId: "blog.post", query: { first: "25" }, target: TARGET },
      { signal },
    ),
  "my files": async (signal: AbortSignal) =>
    await fetchMyFilesPageInBrowser({ first: "10" }, { signal }),
  "search feed": async (signal: AbortSignal) =>
    await fetchSearchFeedPageInBrowser(
      { cursor: null, locale: "en", params: {} },
      { signal },
    ),
} as const;

describe("an abort is re-thrown, never converted", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", ORIGIN);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each(Object.entries(CANCELLABLE))("%s rejects", async (_name, read) => {
    vi.stubGlobal("fetch", () => {
      throw abortError();
    });

    const controller = new AbortController();
    controller.abort();

    await expect(read(controller.signal)).rejects.toThrow(
      expect.objectContaining({ name: "AbortError" }),
    );
  });

  /**
   * The negative, stated so it cannot be read out of the assertion above by
   * accident: the promise does not *resolve*. An empty page, a `null` and an
   * `undefined` are all things a caller would render, and all of them are wrong.
   */
  it.each(Object.entries(CANCELLABLE))(
    "%s does not resolve to a value",
    async (_name, read) => {
      vi.stubGlobal("fetch", () => {
        throw abortError();
      });

      const controller = new AbortController();
      controller.abort();

      let resolved = false;
      await read(controller.signal).then(
        () => {
          resolved = true;
        },
        () => undefined,
      );

      expect(resolved).toBe(false);
    },
  );

  /**
   * And the rejection keeps its own identity rather than being re-wrapped as a
   * refusal. `AdminRequestError` and `MyFilesRequestError` carry a `status` and
   * mean "the API answered and said no"; an abort answered nothing, and a caller
   * that reads `status` to decide whether the session ended must not find one.
   */
  it.each(Object.entries(CANCELLABLE))(
    "%s does not disguise the abort as a refusal",
    async (_name, read) => {
      vi.stubGlobal("fetch", () => {
        throw abortError();
      });

      const controller = new AbortController();
      controller.abort();

      const error = await read(controller.signal).catch(
        (thrown: unknown) => thrown,
      );

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).name).toBe("AbortError");
      expect(error).not.toHaveProperty("status");
    },
  );
});

/**
 * The far end of the seam: a signal handed to `rawApiFetch` in `options` reaches
 * the real `fetch` init, unchanged.
 *
 * Everything between - `fetcherClient`, `coreFetcher` - threads `options`
 * through untouched and always has; this is the one hop that spreads it into the
 * request, and it is the hop that would silently drop a signal if the spread
 * were ever reordered.
 */
describe("the transport carries the signal to fetch", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", ORIGIN);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("passes options.signal into the fetch init", async () => {
    let seen: RequestInit | undefined;
    vi.stubGlobal("fetch", async (_url: unknown, init?: RequestInit) => {
      seen = init;

      return await Promise.resolve(new Response("{}", { status: 200 }));
    });

    const controller = new AbortController();

    await rawApiFetch({
      method: "get",
      module: "users/files",
      options: { signal: controller.signal },
      path: "/",
      pluginId: "@vitnode/core",
    });

    expect(seen?.signal).toBe(controller.signal);
  });

  /**
   * `options` must not be able to change what the call was built as.
   *
   * `body`, `headers` and `method` are all omitted from its type now; `method`
   * was not, and the spread came *last*, so a `get` could leave as a `post`.
   * Harmless while nothing passed `options` for anything but `credentials` - and
   * worth closing the moment `signal` started travelling through the same
   * argument, because that is when callers start reaching for it.
   *
   * Asserted at runtime rather than only in the type, because the type alone is
   * a promise about callers and this is a promise about the function: `options`
   * is now spread *before* the three fields `rawApiFetch` computes, so they win
   * whatever a caller reaching past the type supplies.
   */
  it("does not let options override the method", async () => {
    let seen: RequestInit | undefined;
    vi.stubGlobal("fetch", async (_url: unknown, init?: RequestInit) => {
      seen = init;

      return await Promise.resolve(new Response("{}", { status: 200 }));
    });

    await rawApiFetch({
      method: "get",
      module: "users/files",
      // The type forbids it; a caller reaching past the type must still not win.
      options: { method: "post" } as never,
      path: "/",
      pluginId: "@vitnode/core",
    });

    expect(seen?.method).toBe("GET");
  });
});
