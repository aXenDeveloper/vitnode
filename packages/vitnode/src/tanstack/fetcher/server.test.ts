// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usersModule } from "@/api/modules/users/users.module";

const requestHeaders = new Headers();
const setCookie = vi.fn();
let requestUrl: null | string = "https://preview.example.com/login";

vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeaders: () => requestHeaders,
  getRequestIP: () => "203.0.113.9",
  getRequestUrl: () => {
    if (requestUrl === null) throw new Error("outside a request");

    return new URL(requestUrl);
  },
  setCookie,
}));

const { fetcher, rawFetcher } = await import("./server");

const apiFetch = vi.fn<(url: string | URL, init?: RequestInit) => Response>();

const lastCall = () => {
  const [url, init] = apiFetch.mock.calls.at(-1) ?? [];

  return {
    headers: new Headers(init?.headers),
    init,
    url: new URL(String(url)),
  };
};

beforeEach(() => {
  apiFetch.mockReset();
  setCookie.mockReset();
  // The default topology: the app serves its own API, so nothing names one.
  vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
  requestUrl = "https://preview.example.com/login";
  requestHeaders.set("cookie", "vitnode_auth=abc");
  requestHeaders.set("user-agent", "Mozilla/5.0");
  requestHeaders.set("x-forwarded-for", "198.51.100.7, 10.0.0.1");
  vi.stubGlobal("fetch", apiFetch);
  apiFetch.mockReturnValue(new Response("{}", { status: 200 }));
});

describe("the request the visitor made is the request the API sees", () => {
  it("forwards the cookie, user agent and forwarded-for chain", async () => {
    await fetcher(usersModule, {
      method: "get",
      module: "users",
      path: "/session",
    });

    const { headers } = lastCall();

    expect(headers.get("Cookie")).toBe("vitnode_auth=abc");
    expect(headers.get("user-agent")).toBe("Mozilla/5.0");
    // The chain verbatim - re-deriving it would log this server's hop as the IP.
    expect(headers.get("x-forwarded-for")).toBe("198.51.100.7, 10.0.0.1");
  });

  it("falls back to the connection IP when no proxy wrote a chain", async () => {
    requestHeaders.delete("x-forwarded-for");

    await fetcher(usersModule, {
      method: "get",
      module: "users",
      path: "/session",
    });

    expect(lastCall().headers.get("x-forwarded-for")).toBe("203.0.113.9");
  });

  it("calls the origin this request arrived on", async () => {
    await fetcher(usersModule, {
      method: "get",
      module: "users",
      path: "/session",
    });

    expect(lastCall().url.origin).toBe("https://preview.example.com");
    expect(lastCall().url.pathname).toBe("/api/@vitnode/core/users/session");
  });

  it("calls a configured separate API server instead of itself", async () => {
    // `create-vitnode` scaffolds `apps/web` on `:3000` and `apps/api` on
    // `:8000`, so this request's own origin has no `/api/*` to answer.
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000");

    await fetcher(usersModule, {
      method: "get",
      module: "users",
      path: "/session",
    });

    expect(lastCall().url.origin).toBe("http://localhost:8000");
    expect(lastCall().url.pathname).toBe("/api/@vitnode/core/users/session");
  });

  it("lets an explicit origin win", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000");

    await fetcher(usersModule, {
      method: "get",
      module: "users",
      origin: "https://api.example.com",
      path: "/session",
    });

    expect(lastCall().url.origin).toBe("https://api.example.com");
  });
});

describe("the route's arguments reach the wire", () => {
  it("sends a body as JSON", async () => {
    await fetcher(usersModule, {
      args: { body: { email: "a@b.c", password: "secret" } },
      method: "post",
      module: "users",
      path: "/sign_in",
    });

    const { init, url } = lastCall();

    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(
      JSON.stringify({ email: "a@b.c", password: "secret" }),
    );
    expect(url.pathname).toBe("/api/@vitnode/core/users/sign_in");
  });

  it("substitutes path parameters", async () => {
    await fetcher(usersModule, {
      args: { params: { publicId: "device-7" } },
      method: "delete",
      module: "users",
      path: "/devices/{publicId}",
    });

    expect(lastCall().url.pathname).toBe(
      "/api/@vitnode/core/users/devices/device-7",
    );
  });
});

describe("captchaToken", () => {
  it("is sent as the header the middleware reads", async () => {
    await fetcher(usersModule, {
      args: { body: { email: "a@b.c" } },
      captchaToken: "solved",
      method: "post",
      module: "users",
      path: "/reset-password",
    });

    expect(lastCall().headers.get("x-vitnode-captcha-token")).toBe("solved");
  });

  it("sends no header at all when the deployment has no captcha", async () => {
    // An empty token is a *present* header with no token, which a configured
    // deployment rejects as `400`. The absence is the meaningful part.
    await fetcher(usersModule, {
      args: { body: { email: "a@b.c" } },
      captchaToken: "",
      method: "post",
      module: "users",
      path: "/reset-password",
    });

    expect(lastCall().headers.has("x-vitnode-captcha-token")).toBe(false);
  });
});

describe("allowSaveCookies", () => {
  const withSetCookie = (status: number) =>
    new Response("{}", {
      headers: { "set-cookie": "vitnode_auth=new; Path=/; HttpOnly" },
      status,
    });

  it("copies the API's cookies onto this response", async () => {
    apiFetch.mockReturnValue(withSetCookie(201));

    await fetcher(usersModule, {
      allowSaveCookies: true,
      args: { body: { email: "a@b.c", password: "secret" } },
      method: "post",
      module: "users",
      path: "/sign_in",
    });

    expect(setCookie).toHaveBeenCalledWith(
      "vitnode_auth",
      "new",
      expect.objectContaining({ httpOnly: true, path: "/" }),
    );
  });

  it("ignores a refusal's cookies", async () => {
    apiFetch.mockReturnValue(withSetCookie(403));

    await fetcher(usersModule, {
      allowSaveCookies: true,
      args: { body: { email: "a@b.c", password: "wrong" } },
      method: "post",
      module: "users",
      path: "/sign_in",
    });

    expect(setCookie).not.toHaveBeenCalled();
  });

  it("writes nothing unless it was asked to", async () => {
    apiFetch.mockReturnValue(withSetCookie(201));

    await fetcher(usersModule, {
      args: { body: { email: "a@b.c", password: "secret" } },
      method: "post",
      module: "users",
      path: "/sign_in",
    });

    expect(setCookie).not.toHaveBeenCalled();
  });
});

describe("rawFetcher", () => {
  it("carries the same request context to a generated content module", async () => {
    await rawFetcher({
      method: "get",
      module: "content/articles",
      path: "/",
      pluginId: "@vitnode/blog",
      prefixPath: "/admin",
    });

    const { headers, url } = lastCall();

    expect(url.origin).toBe("https://preview.example.com");
    expect(url.pathname).toBe("/api/@vitnode/blog/admin/content/articles");
    expect(headers.get("Cookie")).toBe("vitnode_auth=abc");
  });
});

describe("outside a request", () => {
  it("falls back to the configured API origin", async () => {
    requestUrl = null;

    await fetcher(usersModule, {
      method: "get",
      module: "users",
      path: "/session",
    });

    expect(lastCall().url.origin).not.toBe("https://preview.example.com");
  });

  it("uses a configured API server", async () => {
    requestUrl = null;
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");

    await fetcher(usersModule, {
      method: "get",
      module: "users",
      path: "/session",
    });

    expect(lastCall().url.origin).toBe("https://api.example.com");
  });
});
