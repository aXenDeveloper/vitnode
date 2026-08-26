// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` throws on import outside a server component, and `next/headers`
// needs a request Next is not handling here. Both are mocked so the forwarding
// itself can be exercised; the cookie store below is Next's own serializer, not
// a stand-in, so what these assert is what a browser would receive.
vi.mock("server-only", () => ({}));

const written = vi.hoisted(() => ({ headers: new Headers() }));

vi.mock("next/headers", async () => {
  const { ResponseCookies } =
    await import("next/dist/server/web/spec-extension/cookies");

  return {
    cookies: async () =>
      await Promise.resolve(new ResponseCookies(written.headers)),
  };
});

const { handleSetCookiesFetcher } = await import("./helpers-server");

/** A response from the API carrying the `Set-Cookie` headers it just minted. */
const apiResponse = (...setCookies: string[]): Response => {
  const headers = new Headers();
  for (const value of setCookies) headers.append("set-cookie", value);

  return new Response(null, { headers });
};

/** What Next would put on the page response once the forwarding has run. */
const forwarded = async (...setCookies: string[]): Promise<string[]> => {
  await handleSetCookiesFetcher(apiResponse(...setCookies));

  return written.headers.getSetCookie();
};

describe("handleSetCookiesFetcher", () => {
  beforeEach(() => {
    written.headers = new Headers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("copies a persistent cookie onto the page response", async () => {
    // Next derives an `Expires` of its own from `Max-Age`, so the clock has to
    // stand still for the header to be assertable in full.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T00:00:00Z"));

    await expect(
      forwarded(
        "vitnode_device=d3v1c3; Path=/; Domain=localhost; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax",
      ),
    ).resolves.toStrictEqual([
      "vitnode_device=d3v1c3; Path=/; Expires=Thu, 26 Aug 2027 00:00:00 GMT; Max-Age=31536000; Domain=localhost; Secure; HttpOnly; SameSite=lax",
    ]);
  });

  it("keeps a session cookie a session cookie", async () => {
    // No `Expires` and no `Max-Age` in, neither out: inventing either would
    // outlive the browser session the API meant the cookie to last for.
    await expect(
      forwarded("vitnode_auth=token; Path=/; HttpOnly"),
    ).resolves.toStrictEqual(["vitnode_auth=token; Path=/; HttpOnly"]);
  });

  it("copies every cookie of a response, not just the last", async () => {
    await expect(
      forwarded(
        "vitnode_auth=token; Path=/; HttpOnly",
        "vitnode_device=device; Path=/; HttpOnly",
      ),
    ).resolves.toStrictEqual([
      "vitnode_auth=token; Path=/; HttpOnly",
      "vitnode_device=device; Path=/; HttpOnly",
    ]);
  });

  it("forwards a sign-out as a deletion the browser acts on", async () => {
    // The header `hono/cookie`'s `deleteCookie()` sends. With `Max-Age` dropped
    // in the parse this arrives as a valueless *session* cookie instead, and the
    // visitor keeps a `vitnode_auth` until they close the browser.
    await expect(
      forwarded("vitnode_auth=; Max-Age=0; Path=/"),
    ).resolves.toStrictEqual(["vitnode_auth=; Path=/; Max-Age=0"]);
  });

  it("forwards a deletion written as an expiry in the past", async () => {
    await expect(
      forwarded("vitnode_auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT"),
    ).resolves.toStrictEqual([
      "vitnode_auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ]);
  });

  it("writes nothing for a response that set no cookies", async () => {
    await expect(forwarded()).resolves.toStrictEqual([]);
  });
});
