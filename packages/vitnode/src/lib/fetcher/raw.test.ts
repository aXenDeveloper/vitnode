// @vitest-environment node
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONFIG } from "../config";
import { buildApiUrl, rawApiFetch } from "./raw";
import { buildForwardedHeaders } from "./request-context";

const PLUGIN_ID = "@vitnode/core";
const ORIGIN = "http://localhost:3000";

/**
 * The API mounted the way every VitNode runtime mounts it: `basePath("/api")`
 * with the plugin's router underneath. `apps/api` does it in its entry file,
 * and the TanStack Start app does it behind its `/api/*` server route - so the
 * paths the fetcher builds have to resolve here either way.
 */
const mountedApi = () => {
  const seen: Request[] = [];
  const plugin = new Hono();

  plugin.use("*", async (c, next) => {
    seen.push(c.req.raw.clone());

    return next();
  });
  plugin.get("/middleware", c => c.json({ ok: true }));
  plugin.get("/users/:id", c => c.json({ id: c.req.param("id") }));
  plugin.get("/guarded", c => c.json({ error: "Unauthorized" }, 401));
  plugin.get("/broken", () => {
    throw new Error("boom");
  });

  const app = new Hono().basePath("/api");
  app.route(`/${PLUGIN_ID}`, plugin);

  return { app, seen };
};

describe("buildApiUrl", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", ORIGIN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("namespaces the path under the plugin id", () => {
    expect(
      buildApiUrl({
        module: "middleware",
        path: "/",
        pluginId: PLUGIN_ID,
      }).toString(),
    ).toBe(`${ORIGIN}/api/${PLUGIN_ID}/middleware`);
  });

  it("substitutes path params", () => {
    expect(
      buildApiUrl({
        module: "users",
        params: { id: 42 },
        path: "/{id}",
        pluginId: PLUGIN_ID,
      }).pathname,
    ).toBe(`/api/${PLUGIN_ID}/users/42`);
  });

  it("stays on the web origin when the API is mounted same-origin", () => {
    // The whole point of the mount: with the two origins equal, an SSR call
    // never leaves the process that is rendering the page.
    vi.stubEnv("NEXT_PUBLIC_WEB_URL", ORIGIN);

    expect(
      buildApiUrl({ module: "middleware", path: "/", pluginId: PLUGIN_ID })
        .origin,
    ).toBe(CONFIG.web.origin);
  });

  it("leaves the web origin when the API is configured elsewhere", () => {
    // Pins the env contract rather than an implementation: point
    // `NEXT_PUBLIC_API_URL` at a second server and the same call becomes a
    // cross-origin one, cookies and CORS included.
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");

    expect(
      buildApiUrl({ module: "middleware", path: "/", pluginId: PLUGIN_ID })
        .origin,
    ).toBe("https://api.example.com");
  });

  it("adds the pagination defaults only when asked", () => {
    const url = buildApiUrl({
      module: "users",
      path: "/",
      pluginId: PLUGIN_ID,
      query: {},
      withPagination: true,
    });

    expect(url.searchParams.get("first")).toBe("10");
    expect(url.searchParams.get("search")).toBe("");
  });
});

describe("rawApiFetch against the mounted API", () => {
  let api: ReturnType<typeof mountedApi>;

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", ORIGIN);
    api = mountedApi();
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) =>
        api.app.fetch(new Request(input, init)),
    );
    // The fetcher logs every >= 400 response. The tests below make those on
    // purpose, so keep the report readable.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("reaches the route the URL builder addressed", async () => {
    const response = await rawApiFetch({
      method: "get",
      module: "middleware",
      path: "/",
      pluginId: PLUGIN_ID,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("forwards the caller's cookie, user-agent and IP", async () => {
    // The three headers the API reads to identify the user, fingerprint the
    // device and key the rate limiter.
    await rawApiFetch({
      additionalHeaders: buildForwardedHeaders({
        cookie: "vitnode_session=s3cr3t",
        forwardedFor: "203.0.113.7",
        userAgent: "Mozilla/5.0 (SSR test)",
      }),
      method: "get",
      module: "middleware",
      path: "/",
      pluginId: PLUGIN_ID,
    });

    const headers = api.seen.at(0)?.headers;
    expect(headers?.get("cookie")).toBe("vitnode_session=s3cr3t");
    expect(headers?.get("user-agent")).toBe("Mozilla/5.0 (SSR test)");
    expect(headers?.get("x-forwarded-for")).toBe("203.0.113.7");
  });

  it("hands back a non-2xx response instead of throwing", async () => {
    // A 401 is data the caller renders (a sign-in prompt), not a crash.
    const response = await rawApiFetch({
      method: "get",
      module: "guarded",
      path: "/",
      pluginId: PLUGIN_ID,
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("hands back the API's 404 for an unknown route", async () => {
    const response = await rawApiFetch({
      method: "get",
      module: "does-not-exist",
      path: "/",
      pluginId: PLUGIN_ID,
    });

    expect(response.status).toBe(404);
  });

  it("throws on a 500 with the URL and the body", async () => {
    await expect(
      rawApiFetch({
        method: "get",
        module: "broken",
        path: "/",
        pluginId: PLUGIN_ID,
      }),
    ).rejects.toThrow(`/api/${PLUGIN_ID}/broken`);
  });
});
