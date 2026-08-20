// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

interface CookieCall {
  args: unknown[];
  fn: string;
}

const state = vi.hoisted(() => ({
  calls: [] as CookieCall[],
  connections: 0,
  headers: new Headers(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => {
  const record =
    (fn: string) =>
    (...args: unknown[]) => {
      state.calls.push({ args, fn });

      return undefined;
    };

  return {
    cookies: async () =>
      await Promise.resolve({
        delete: record("delete"),
        get: (name: string) => {
          state.calls.push({ args: [name], fn: "get" });

          return { name, value: `${name}-value` };
        },
        getAll: () => {
          state.calls.push({ args: [], fn: "getAll" });

          return [{ name: "a", value: "1" }];
        },
        has: (name: string) => {
          state.calls.push({ args: [name], fn: "has" });

          return true;
        },
        set: record("set"),
        toString: () => "a=1; b=2",
      }),
    headers: async () => await Promise.resolve(state.headers),
  };
});

vi.mock("next/server", () => ({
  connection: async () => {
    state.connections += 1;

    return await Promise.resolve();
  },
}));

const { nextRequestAdapter } = await import("./next");

/**
 * The adapter is the only place the mapping onto `next/headers` and
 * `next/server` lives, so this is where the mapping is pinned - against the
 * real module rather than a stub of it.
 *
 * The cookie assertions matter most. `handleSetCookiesFetcher` replays the
 * API's `Set-Cookie` headers through this store, so a dropped attribute is not
 * a cosmetic bug: a session cookie that loses `httpOnly` becomes readable from
 * JavaScript, and one that loses `expires` becomes a session cookie that dies
 * with the tab.
 */
beforeEach(() => {
  state.calls.length = 0;
  state.connections = 0;
  state.headers = new Headers();
});

describe("nextRequestAdapter", () => {
  it("identifies itself", () => {
    expect(nextRequestAdapter.name).toBe("next");
  });

  it("hands out Next's own headers rather than a copy", async () => {
    state.headers = new Headers({ "user-agent": "probe" });

    const headers = await nextRequestAdapter.getHeaders();

    // Same object: a snapshot could drift from the request, and Next's
    // `ReadonlyHeaders` already satisfies the contract unchanged.
    expect(headers).toBe(state.headers);
    expect(headers.get("user-agent")).toBe("probe");
  });

  it("serialises the cookie jar as a Cookie header value", async () => {
    const store = await nextRequestAdapter.getCookies();

    expect(store.toString()).toBe("a=1; b=2");
  });

  it("writes every attribute through to Next", async () => {
    const store = await nextRequestAdapter.getCookies();
    const expires = new Date("2030-01-01T00:00:00.000Z");

    store.set("vitnode-session", "abc", {
      domain: "example.com",
      expires,
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    });

    expect(state.calls).toEqual([
      {
        fn: "set",
        args: [
          "vitnode-session",
          "abc",
          {
            domain: "example.com",
            expires,
            httpOnly: true,
            path: "/",
            sameSite: "lax",
            secure: true,
          },
        ],
      },
    ]);
  });

  it("passes the reads straight through", async () => {
    const store = await nextRequestAdapter.getCookies();

    expect(store.get("session")).toEqual({
      name: "session",
      value: "session-value",
    });
    expect(store.getAll()).toEqual([{ name: "a", value: "1" }]);
    expect(store.has("session")).toBe(true);
    store.delete("session");

    expect(state.calls.map(call => call.fn)).toEqual([
      "get",
      "getAll",
      "has",
      "delete",
    ]);
  });

  it("does not leak Next-only members of the store", async () => {
    const store = await nextRequestAdapter.getCookies();

    // The wrapper exists so nothing downstream can reach past the contract and
    // quietly re-couple itself to Next.
    expect(Object.keys(store).toSorted()).toEqual([
      "delete",
      "get",
      "getAll",
      "has",
      "set",
      "toString",
    ]);
    expect("size" in store).toBe(false);
  });

  it("waits for a request through connection()", async () => {
    await nextRequestAdapter.awaitRequest();

    expect(state.connections).toBe(1);
  });
});
