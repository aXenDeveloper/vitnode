import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PageCacheRouteTable } from "@/page-cache/policy";
import type { PageCacheStore } from "@/page-cache/store.server";
import type { VitNodeConfig } from "@/vitnode.config";

import { recordPageCacheApiResponse } from "@/page-cache/render-context.server";
import {
  createMemoryPageCacheStore,
  invalidatePageCacheTags,
  resetPageCacheStore,
} from "@/page-cache/store.server";
import {
  PAGE_CACHE_RENDER_HEADER,
  PAGE_CACHE_STATUS_HEADER,
  PAGE_CACHE_TAGS_HEADER,
} from "@/page-cache/tags";

import { createPageCacheHandler } from "./server";

const CONFIG: VitNodeConfig = {
  i18n: {
    defaultLocale: "en",
    locales: [
      { code: "en", name: "English" },
      { code: "pl", name: "Polski" },
    ],
    routePaths: { pl: { "/blog/:slug": "/wpisy/:slug" } },
  },
  metadata: { title: "Test" },
  plugins: [],
};

const ROUTES: PageCacheRouteTable = [
  { path: "/blog/new" },
  { maxAge: 60, path: "/blog/:slug", staleWhileRevalidate: 30 },
  { maxAge: 60, path: "/docs/:slug" },
];

const TAG = "post:1";

/** What the fake app saw, echoed in the body so a test can read it back. */
interface Seen {
  authorization: null | string;
  cookie: null | string;
  method: string;
  shared: boolean;
  url: string;
}

type Respond = (seen: Seen, count: number) => Response | undefined;

const html = (body: string, init: ResponseInit = {}) =>
  new Response(body, {
    ...init,
    headers: { "content-type": "text/html; charset=utf-8", ...init.headers },
  });

const deferred = () => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>(done => {
    resolve = done;
  });

  return { promise, resolve };
};

const setup = ({
  gate,
  respond,
  tags = [TAG],
}: {
  /** Holds every render until it resolves. */
  gate?: Promise<void>;
  respond?: Respond;
  tags?: string[];
} = {}) => {
  const store: PageCacheStore = createMemoryPageCacheStore();
  const seen: Seen[] = [];
  const background: Promise<unknown>[] = [];

  const render = vi.fn(async (request: Request) => {
    const current: Seen = {
      authorization: request.headers.get("authorization"),
      cookie: request.headers.get("cookie"),
      method: request.method,
      shared: request.headers.get(PAGE_CACHE_RENDER_HEADER) === "1",
      url: request.url,
    };
    seen.push(current);
    const count = seen.length;
    // What the server-side fetcher does for every API response it reads.
    recordPageCacheApiResponse({
      headers: new Headers({ [PAGE_CACHE_TAGS_HEADER]: tags.join(",") }),
    });
    await gate;

    return respond?.(current, count) ?? html(`render #${String(count)}`);
  });

  const fetch = createPageCacheHandler(render, {
    buildId: "test-build",
    config: CONFIG,
    enabled: true,
    routes: ROUTES,
    store,
  });

  const request = async (path: string, init: RequestInit = {}) => {
    const incoming = Object.assign(
      new Request(new URL(path, "https://example.com"), init),
      {
        waitUntil: (promise: Promise<unknown>) => {
          background.push(promise);
        },
      },
    );
    const response = await fetch(incoming);

    return {
      body: await response.text(),
      cacheControl: response.headers.get("cache-control"),
      response,
      status: response.headers.get(PAGE_CACHE_STATUS_HEADER),
    };
  };

  /** Lets a background refresh (stale-while-revalidate) finish. */
  const settle = async () => {
    while (background.length > 0) await background.shift();
  };

  return { render, request, seen, settle, store };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  resetPageCacheStore();
});

describe("reusing a page", () => {
  it("renders once and serves the stored HTML afterwards", async () => {
    const { render, request } = setup();

    const first = await request("/blog/hello");
    const second = await request("/blog/hello");

    expect([first.status, second.status]).toEqual(["MISS", "HIT"]);
    expect(second.body).toBe("render #1");
    expect(second.cacheControl).toBe("no-cache");
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("renders once for concurrent misses", async () => {
    const gate = deferred();
    const { render, request } = setup({ gate: gate.promise });

    const pending = Array.from(
      { length: 5 },
      async () => await request("/blog/hello"),
    );
    await vi.advanceTimersByTimeAsync(10);
    gate.resolve();
    const responses = await Promise.all(pending);

    expect(render).toHaveBeenCalledTimes(1);
    expect(new Set(responses.map(response => response.body))).toEqual(
      new Set(["render #1"]),
    );
  });

  it("keeps GET and HEAD as separate entries", async () => {
    const { request, seen } = setup();

    await request("/blog/hello");
    const head = await request("/blog/hello", { method: "HEAD" });
    const again = await request("/blog/hello", { method: "HEAD" });

    expect(seen.map(entry => entry.method)).toEqual(["GET", "HEAD"]);
    expect([head.status, again.status]).toEqual(["MISS", "HIT"]);
  });

  it("answers a matching If-None-Match with 304", async () => {
    const { request } = setup();
    const { response } = await request("/blog/hello");
    const etag = response.headers.get("etag") ?? "";

    const revalidated = await request("/blog/hello", {
      headers: { "if-none-match": etag },
    });

    expect(etag).not.toBe("");
    expect(revalidated.response.status).toBe(304);
    expect(revalidated.body).toBe("");
    expect(revalidated.cacheControl).toBe("no-cache");
  });
});

describe("sessions never leak into shared HTML", () => {
  it("renders without the visitor's credentials and serves that to everyone", async () => {
    const { request, seen } = setup({
      respond: current => html(JSON.stringify(current)),
    });

    const alice = await request("/blog/hello", {
      headers: { authorization: "Bearer alice", cookie: "session=alice" },
    });
    const bob = await request("/blog/hello", {
      headers: { cookie: "session=bob" },
    });

    expect(seen).toEqual([
      expect.objectContaining({
        authorization: null,
        cookie: null,
        shared: true,
      }),
    ]);
    expect(bob.status).toBe("HIT");
    expect(bob.body).toBe(alice.body);
  });

  it("strips a shared-render marker a visitor sends on an uncached page", async () => {
    const { request, seen } = setup();

    await request("/login", { headers: { [PAGE_CACHE_RENDER_HEADER]: "1" } });

    expect(seen[0].shared).toBe(false);
  });

  it.each<[string, Respond]>([
    [
      "sets a cookie",
      (_, count) =>
        html(`render #${String(count)}`, {
          headers: { "set-cookie": "csrf=abc" },
        }),
    ],
    [
      "says it is private",
      (_, count) =>
        html(`render #${String(count)}`, {
          headers: { "cache-control": "private, no-store" },
        }),
    ],
    [
      "read private API data",
      (_, count) => {
        recordPageCacheApiResponse({
          headers: new Headers({ "cache-control": "private, no-store" }),
        });

        return html(`render #${String(count)}`);
      },
    ],
    ["is not HTML", (_, count) => Response.json({ count })],
  ])("never stores a render that %s", async (_, respond) => {
    const { render, request } = setup({ respond });

    await request("/blog/hello");
    const second = await request("/blog/hello");

    expect(second.status).toBe("BYPASS");
    expect(render).toHaveBeenCalledTimes(2);
  });
});

describe("what shares an entry", () => {
  it("keeps hosts apart", async () => {
    const { render, request } = setup();

    await request("https://a.example/blog/hello");
    await request("https://b.example/blog/hello");
    const again = await request("https://a.example/blog/hello");

    expect(render).toHaveBeenCalledTimes(2);
    expect(again.body).toBe("render #1");
  });

  it("caches a translated path as its own entry", async () => {
    const { request, seen } = setup();

    await request("/blog/hello");
    const polish = await request("/pl/wpisy/hello");
    const polishAgain = await request("/pl/wpisy/hello");
    const english = await request("/blog/hello");

    expect(seen.map(entry => new URL(entry.url).pathname)).toEqual([
      "/blog/hello",
      "/pl/wpisy/hello",
    ]);
    expect([polish.status, polishAgain.status, english.status]).toEqual([
      "MISS",
      "HIT",
      "HIT",
    ]);
    expect(polishAgain.body).toBe("render #2");
  });

  it("serves tracking parameters from the plain URL's entry", async () => {
    const { render, request, seen } = setup();

    await request("/blog/hello?utm_source=newsletter&fbclid=1");
    const plain = await request("/blog/hello");

    expect(new URL(seen[0].url).search).toBe("");
    expect(plain.status).toBe("HIT");
    expect(render).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a preview token", "/blog/hello?preview=token"],
    ["any other query parameter", "/blog/hello?page=2"],
  ])("bypasses the cache for %s", async (_, path) => {
    const { render, request, seen } = setup();

    const first = await request(path);
    await request(path);

    expect(first.status).toBe("BYPASS");
    expect(seen[0].url).toBe(`https://example.com${path}`);
    expect(seen[0].shared).toBe(false);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["an uncached route beside a cached pattern", "/blog/new"],
    ["a route with no policy", "/login"],
    ["a locale redirect", "/en/blog/hello"],
    ["a non-GET request", "/blog/hello"],
  ])("leaves %s alone", async (name, path) => {
    const { render, request } = setup();
    const init = name === "a non-GET request" ? { method: "POST" } : {};

    await request(path, init);
    const second = await request(path, init);

    expect(second.status).toBeNull();
    expect(render).toHaveBeenCalledTimes(2);
  });
});

describe("how long a page lives", () => {
  it("serves one stale copy inside the SWR window while it refreshes", async () => {
    const { render, request, settle } = setup();
    await request("/blog/hello");

    await vi.advanceTimersByTimeAsync(59_000);
    expect((await request("/blog/hello")).status).toBe("HIT");

    await vi.advanceTimersByTimeAsync(2_000);
    const stale = await request("/blog/hello");
    await settle();
    const fresh = await request("/blog/hello");

    expect(stale).toMatchObject({ body: "render #1", status: "STALE" });
    expect(fresh).toMatchObject({ body: "render #2", status: "HIT" });
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("waits for a fresh render once the SWR window has passed too", async () => {
    const { request } = setup();
    await request("/blog/hello");

    await vi.advanceTimersByTimeAsync(91_000);
    const late = await request("/blog/hello");

    expect(late.body).toBe("render #2");
    expect(late.status).not.toBe("STALE");
  });

  it("never serves stale HTML for a policy without SWR", async () => {
    const { request } = setup();
    await request("/docs/intro");

    await vi.advanceTimersByTimeAsync(61_000);
    const late = await request("/docs/intro");

    expect(late.body).toBe("render #2");
    expect(late.status).not.toBe("STALE");
  });
});

describe("invalidation", () => {
  it("stops serving a page as soon as a hard invalidation names its tag", async () => {
    const { request } = setup();
    await request("/blog/hello");
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(
      invalidatePageCacheTags([TAG], { mode: "hard" }),
    ).resolves.toEqual({ status: "done" });
    const after = await request("/blog/hello");

    expect(after.body).toBe("render #2");
  });

  it("leaves pages with other tags alone", async () => {
    const { request } = setup();
    await request("/blog/hello");

    await invalidatePageCacheTags(["post:2"], { mode: "hard" });

    expect((await request("/blog/hello")).status).toBe("HIT");
  });

  it("never stores a render that was in progress during a hard invalidation", async () => {
    const gate = deferred();
    const { render, request } = setup({ gate: gate.promise });

    const slow = request("/blog/hello");
    await vi.advanceTimersByTimeAsync(5_000);
    await invalidatePageCacheTags([TAG], { mode: "hard" });
    gate.resolve();
    await slow;

    await request("/blog/hello");
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("stores again once the clock-skew margin has passed", async () => {
    const { request } = setup();
    await invalidatePageCacheTags([TAG], { mode: "hard" });

    await request("/blog/hello");
    const withinMargin = await request("/blog/hello");
    await vi.advanceTimersByTimeAsync(3_000);
    await request("/blog/hello");
    const later = await request("/blog/hello");

    expect(withinMargin.body).toBe("render #2");
    expect(later).toMatchObject({ body: "render #3", status: "HIT" });
  });

  it("serves exactly one stale copy after a soft invalidation", async () => {
    const { render, request, settle } = setup();
    await request("/blog/hello");
    await vi.advanceTimersByTimeAsync(1_000);

    await invalidatePageCacheTags([TAG], { mode: "soft" });
    const stale = await request("/blog/hello");
    await settle();
    const fresh = await request("/blog/hello");

    expect(stale).toMatchObject({ body: "render #1", status: "STALE" });
    expect(fresh).toMatchObject({ body: "render #2", status: "HIT" });
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("stops serving cached pages from this process when the store cannot be written", async () => {
    const { request, store } = setup();
    await request("/blog/hello");
    vi.spyOn(store.tags, "set").mockRejectedValue(new Error("store down"));

    const result = await invalidatePageCacheTags([TAG], { mode: "hard" });
    const after = await request("/blog/hello");

    expect(result.status).toBe("failed");
    expect(after).toMatchObject({ body: "render #2", status: "BYPASS" });
  });
});

describe("a page the public render cannot show", () => {
  const respond: Respond = (current, count) =>
    current.cookie === null
      ? html("not found", { status: 404 })
      : html(`staff view #${String(count)}`);

  it("gives an anonymous visitor the public 404", async () => {
    const { request } = setup({ respond });

    const { body, response, status } = await request("/blog/hidden");

    expect(response.status).toBe(404);
    expect(body).toBe("not found");
    expect(status).toBe("BYPASS");
  });

  it("re-renders a visitor's own request when they sent cookies", async () => {
    const { request, seen } = setup({ respond });

    const { body, response, status } = await request("/blog/hidden", {
      headers: { cookie: "session=staff" },
    });

    expect(response.status).toBe(200);
    expect(body).toBe("staff view #2");
    expect(status).toBe("BYPASS");
    expect(seen[1]).toMatchObject({ cookie: "session=staff", shared: false });
  });
});
