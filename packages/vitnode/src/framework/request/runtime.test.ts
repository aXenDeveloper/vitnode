import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RequestAdapter, RequestCookieStore } from "./types";

import {
  awaitRequest,
  forwardApiRequestHeaders,
  getRequestAdapter,
  hasRequestAdapter,
  requestCookies,
  requestHeaders,
  resetRequestAdapter,
  setDefaultRequestAdapter,
  setRequestAdapter,
} from "./runtime";

/**
 * The registry, the verbs, and what a server-side API call inherits from the
 * visitor's own request.
 *
 * The forwarding assertions are privilege and attribution questions rather than
 * formatting ones: drop the cookie and the API answers anonymously, drop the
 * address and every visitor shares one rate-limit bucket. The fallbacks are
 * pinned too, because they are what the API records when a header is missing,
 * and changing them silently changes what gets logged.
 */

const cookieStore = (serialised = ""): RequestCookieStore => ({
  delete: () => undefined,
  get: () => undefined,
  getAll: () => [],
  has: () => false,
  set: () => undefined,
  toString: () => serialised,
});

const fakeAdapter = ({
  cookies = "",
  headers = {},
  name = "test",
}: {
  cookies?: string;
  headers?: Record<string, string>;
  name?: string;
} = {}): RequestAdapter => ({
  name,
  awaitRequest: vi.fn(async () => await Promise.resolve()),
  getCookies: vi.fn(async () => await Promise.resolve(cookieStore(cookies))),
  getHeaders: vi.fn(async () => await Promise.resolve(new Headers(headers))),
});

beforeEach(() => {
  resetRequestAdapter();
});

describe("request adapter registry", () => {
  it("holds nothing until one is offered", () => {
    expect(hasRequestAdapter()).toBe(false);
  });

  it("names both ways out in the error when nothing is installed", async () => {
    // A missing adapter surfaces as a failed render three layers away, so the
    // message has to carry the fix rather than the symptom.
    expect(() => getRequestAdapter()).toThrow(/no vitnode request adapter/i);
    expect(() => getRequestAdapter()).toThrow(
      /@vitnode\/core\/framework\/request/,
    );
    expect(() => getRequestAdapter()).toThrow(/setRequestAdapter/);

    await expect(requestHeaders()).rejects.toThrow(/request adapter/i);
    await expect(requestCookies()).rejects.toThrow(/request adapter/i);
    await expect(awaitRequest()).rejects.toThrow(/request adapter/i);
    await expect(forwardApiRequestHeaders()).rejects.toThrow(
      /request adapter/i,
    );
  });

  it("uses the default when nothing was installed explicitly", () => {
    setDefaultRequestAdapter(fakeAdapter({ name: "default" }));

    expect(hasRequestAdapter()).toBe(true);
    expect(getRequestAdapter().name).toBe("default");
  });

  it("prefers an installed adapter over the default, whichever came first", () => {
    // The barrel installs the default as an import side effect, and an
    // application cannot control whether its own `setRequestAdapter()` runs
    // before or after that import.
    setDefaultRequestAdapter(fakeAdapter({ name: "default" }));
    setRequestAdapter(fakeAdapter({ name: "host" }));
    expect(getRequestAdapter().name).toBe("host");

    resetRequestAdapter();

    setRequestAdapter(fakeAdapter({ name: "host" }));
    setDefaultRequestAdapter(fakeAdapter({ name: "default" }));
    expect(getRequestAdapter().name).toBe("host");
  });
});

describe("request verbs", () => {
  it("delegates each read to the adapter", async () => {
    const adapter = fakeAdapter({ cookies: "a=1", headers: { "x-p": "yes" } });
    setRequestAdapter(adapter);

    await expect(
      requestHeaders().then(headers => headers.get("x-p")),
    ).resolves.toBe("yes");
    await expect(
      requestCookies().then(store => store.toString()),
    ).resolves.toBe("a=1");
    await awaitRequest();

    expect(adapter.getHeaders).toHaveBeenCalledTimes(1);
    expect(adapter.getCookies).toHaveBeenCalledTimes(1);
    expect(adapter.awaitRequest).toHaveBeenCalledTimes(1);
  });

  it("resolves the adapter per call, not once at import", async () => {
    // Core code imports these helpers at module load. If one captured the
    // adapter then, installing a different one later would have no effect.
    setRequestAdapter(fakeAdapter({ headers: { "x-p": "first" } }));
    await expect(
      requestHeaders().then(headers => headers.get("x-p")),
    ).resolves.toBe("first");

    setRequestAdapter(fakeAdapter({ headers: { "x-p": "second" } }));
    await expect(
      requestHeaders().then(headers => headers.get("x-p")),
    ).resolves.toBe("second");
  });
});

describe("forwardApiRequestHeaders", () => {
  it("forwards the session, the agent and the client address", async () => {
    setRequestAdapter(
      fakeAdapter({
        cookies: "vitnode-session=abc; theme=dark",
        headers: {
          "user-agent": "Mozilla/5.0",
          "x-forwarded-for": "203.0.113.7, 70.41.3.18",
        },
      }),
    );

    await expect(forwardApiRequestHeaders()).resolves.toEqual({
      Cookie: "vitnode-session=abc; theme=dark",
      "user-agent": "Mozilla/5.0",
      "x-forwarded-for": "203.0.113.7, 70.41.3.18",
    });
  });

  it("falls back to the historical values when a header is absent", async () => {
    setRequestAdapter(fakeAdapter());

    await expect(forwardApiRequestHeaders()).resolves.toEqual({
      Cookie: "",
      "user-agent": "node",
      "x-forwarded-for": "0.0.0.0",
    });
  });

  it("forwards nothing else", async () => {
    setRequestAdapter(
      fakeAdapter({
        cookies: "a=1",
        headers: {
          authorization: "Bearer other-service",
          host: "example.com",
        },
      }),
    );

    // The API trusts what it is handed, so anything forwarded beyond these
    // three has to be a deliberate decision. The key set is asserted exactly.
    await expect(
      forwardApiRequestHeaders().then(headers =>
        Object.keys(headers).toSorted(),
      ),
    ).resolves.toEqual(["Cookie", "user-agent", "x-forwarded-for"]);
  });

  it("returns a fresh mutable object per call", async () => {
    setRequestAdapter(fakeAdapter({ cookies: "a=1" }));

    const first = await forwardApiRequestHeaders();
    first["x-vitnode-captcha-token"] = "token";
    const second = await forwardApiRequestHeaders();

    // `fetcher` adds the captcha token to what this returns. A shared or frozen
    // object would either leak one request's token into the next or throw on
    // assignment.
    expect(second).not.toBe(first);
    expect(second["x-vitnode-captcha-token"]).toBeUndefined();
  });

  it("reads the cookies and the headers concurrently", async () => {
    // Both are awaited on every server-rendered API call, so they are
    // deliberately started together rather than in sequence.
    const started: string[] = [];
    setRequestAdapter({
      name: "test",
      awaitRequest: async () => await Promise.resolve(),
      getCookies: async () => {
        started.push("cookies");

        return await Promise.resolve(cookieStore("a=1"));
      },
      getHeaders: async () => {
        started.push("headers");

        return await Promise.resolve(new Headers());
      },
    });

    const pending = forwardApiRequestHeaders();
    expect(started).toEqual(["headers", "cookies"]);
    await pending;
  });
});
