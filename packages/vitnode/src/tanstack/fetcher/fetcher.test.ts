// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { offenders, stripComments } from "@/tests/import-graph";

const requestHeaders = new Headers();
let requestUrl = "https://preview.example.com/discover";

vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeaders: () => requestHeaders,
  getRequestIP: () => "203.0.113.9",
  getRequestUrl: () => new URL(requestUrl),
  setCookie: vi.fn(),
}));

const { createIsomorphicFn } = await import("@tanstack/react-start");
const { fetcherClient, rawFetcherClient } =
  await import("@/lib/fetcher-client");
const { fetcher, rawFetcher } = await import("./index");

const apiFetch = vi.fn<(url: string | URL, init?: RequestInit) => Response>();

const callAt = (index: number) => {
  const [url, init] = apiFetch.mock.calls[index] ?? [];

  return {
    headers: new Headers(init?.headers),
    init,
    url: new URL(String(url)),
  };
};

const lastCall = () => callAt(apiFetch.mock.calls.length - 1);

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockReturnValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", apiFetch);
  vi.stubEnv("VITNODE_API_URL", undefined);
  requestUrl = "https://preview.example.com/discover";
  requestHeaders.set("cookie", "vitnode_auth=abc");
  requestHeaders.set("user-agent", "Mozilla/5.0");
  requestHeaders.set("x-forwarded-for", "198.51.100.7, 10.0.0.1");
});

describe("which branch runs", () => {
  it("resolves to the server branch wherever the Start compiler has not run", () => {
    // Node, and therefore this suite. `createIsomorphicFn` keeps the server
    // implementation as the callable and the compiler swaps in the client one
    // per environment - so a server assertion below is a real assertion, and a
    // browser one has to be made against the client transport itself.
    const probe = createIsomorphicFn()
      .server(() => "server")
      .client(() => "client");

    expect(probe()).toBe("server");
  });
});

describe("the server branch is the request-aware transport", () => {
  it("forwards the visitor's cookie, user agent and forwarded-for chain", async () => {
    await fetcher({
      plugin: "@vitnode/core",
      method: "get",
      module: "users",
      path: "/session",
    });

    const { headers } = lastCall();

    expect(headers.get("Cookie")).toBe("vitnode_auth=abc");
    expect(headers.get("user-agent")).toBe("Mozilla/5.0");
    expect(headers.get("x-forwarded-for")).toBe("198.51.100.7, 10.0.0.1");
  });

  it("resolves the API origin from the request it is serving", async () => {
    await fetcher({
      plugin: "@vitnode/core",
      method: "get",
      module: "users",
      path: "/session",
    });

    expect(lastCall().url.origin).toBe("https://preview.example.com");
    expect(lastCall().url.pathname).toBe("/api/@vitnode/core/users/session");
  });

  it("calls a separately configured API server instead of itself", async () => {
    vi.stubEnv("VITNODE_API_URL", "http://localhost:8000");

    await fetcher({
      plugin: "@vitnode/core",
      method: "get",
      module: "users",
      path: "/session",
    });

    expect(lastCall().url.origin).toBe("http://localhost:8000");
  });

  it("mints no cookie of its own, because the universal call cannot ask for one", async () => {
    const { setCookie } = await import("@tanstack/react-start/server");

    await fetcher({
      plugin: "@vitnode/core",
      args: { body: { email: "a@b.c", password: "secret" } },
      method: "post",
      module: "users",
      path: "/sign_in",
    });

    expect(setCookie).not.toHaveBeenCalled();
  });

  it("carries the same request context for an untyped content call", async () => {
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

describe("the browser branch talks to the Hono API directly", () => {
  beforeEach(() => {
    vi.stubEnv("VITNODE_API_URL", "http://localhost:8000");
  });

  it("makes one request, to /api/*, with the browser's own cookies", async () => {
    await fetcherClient({
      plugin: "@vitnode/core",
      method: "get",
      module: "users",
      path: "/session",
    });

    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(callAt(0).url.href).toBe(
      "http://localhost:8000/api/@vitnode/core/users/session",
    );
    expect(callAt(0).init?.credentials).toBe("include");
  });

  it("routes nothing through a server-function endpoint", async () => {
    await fetcherClient({
      plugin: "@vitnode/core",
      args: { body: { email: "a@b.c", password: "secret" } },
      method: "post",
      module: "users",
      path: "/sign_in",
    });

    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(callAt(0).url.pathname).toBe("/api/@vitnode/core/users/sign_in");
    expect(callAt(0).url.pathname).not.toContain("_serverFn");
  });

  it("forges none of the headers only a server may send", async () => {
    await fetcherClient({
      plugin: "@vitnode/core",
      method: "get",
      module: "users",
      path: "/session",
    });

    const { headers } = callAt(0);

    expect(headers.has("Cookie")).toBe(false);
    expect(headers.has("x-forwarded-for")).toBe(false);
  });

  it("takes an untyped content call to /api/* too", async () => {
    await rawFetcherClient({
      method: "get",
      module: "content/articles",
      path: "/",
      pluginId: "@vitnode/blog",
      prefixPath: "/admin",
    });

    expect(callAt(0).url.pathname).toBe(
      "/api/@vitnode/blog/admin/content/articles",
    );
    expect(callAt(0).init?.credentials).toBe("include");
  });
});

const here = dirname(fileURLToPath(import.meta.url));
const UNIVERSAL_ENTRY = join(here, "index.ts");
const SERVER_ENTRY = join(here, "server.ts");
const BROWSER_ENTRY = join(here, "../../lib/fetcher-client.ts");
const REGISTRY = join(here, "../../lib/fetcher/registry.ts");

/** What must never reach a browser bundle through this module. */
const SERVER_ONLY = [
  "@tanstack/react-start/server-only",
  "@tanstack/react-start/server",
  "dotenv",
];

/** The API's own runtime, which a server API module drags in behind it. */
const API_RUNTIME = ["drizzle-orm", "hono", "postgres"];

const source = stripComments(readFileSync(UNIVERSAL_ENTRY, "utf8"));

describe("what the Start compiler is given", () => {
  it("writes both chains out directly, so the compiler can see them", () => {
    // A wrapper around `createIsomorphicFn` compiles to nothing: the transform
    // matches the literal `.server(x).client(y)` call and rewrites *that*.
    expect(source).toMatch(
      /export const fetcher = createIsomorphicFn\(\)\s*\.server\(serverFetcher as IsomorphicFetcher\)\s*\.client\(fetcherClient\)/,
    );
    expect(source).toMatch(
      /export const rawFetcher = createIsomorphicFn\(\)\s*\.server\(serverRawFetcher\)\s*\.client\(rawFetcherClient\)/,
    );
    expect(source.match(/createIsomorphicFn\(\)/g)).toHaveLength(2);
  });

  it("leaves the server import unreferenced once the client branch is chosen", () => {
    // The transform, applied by hand: each chain becomes its `.client` argument.
    // Nothing then refers to the server transports, which is the precondition
    // for the dead-code pass to drop `./server` - and with it every specifier
    // `SERVER_ONLY` names.
    const clientOutput = source
      .replace(
        /createIsomorphicFn\(\)\s*\.server\((\w+)(?: as \w+)?\)\s*\.client\((\w+)(?: as \w+)?\)/g,
        "$2",
      )
      .replace(/import\s*\{[\s\S]*?\}\s*from\s*"\.\/server";/, "");

    expect(clientOutput).not.toContain("serverFetcher");
    expect(clientOutput).not.toContain("serverRawFetcher");
    expect(clientOutput).toContain("export const fetcher = fetcherClient");
    expect(clientOutput).toContain(
      "export const rawFetcher = rawFetcherClient",
    );
  });

  it("reaches the server-only specifiers through ./server and nothing else", () => {
    // The control the assertion above needs: without it, "the client output has
    // no server import" would pass on a module that never had one.
    expect(offenders(SERVER_ENTRY, SERVER_ONLY)).not.toEqual([]);

    const chains = offenders(UNIVERSAL_ENTRY, SERVER_ONLY);

    expect(chains).not.toEqual([]);
    for (const chain of chains) {
      expect(chain).toContain("tanstack/fetcher/index.ts -> ");
      expect(chain).toContain("tanstack/fetcher/server.ts");
    }
  });
});

describe("the browser transport is browser-shaped on its own", () => {
  it("reaches nothing that only resolves on a server", () => {
    expect(offenders(BROWSER_ENTRY, SERVER_ONLY)).toEqual([]);
  });

  it("never pulls the API's runtime in behind the plugin registry", () => {
    expect(offenders(BROWSER_ENTRY, API_RUNTIME)).toEqual([]);
    expect(offenders(REGISTRY, [...API_RUNTIME, ...SERVER_ONLY])).toEqual([]);
  });

  it("reaches the core API plugin through the registry as a type and nothing else", () => {
    const registry = stripComments(readFileSync(REGISTRY, "utf8"));

    // The already-reduced contract, not the plugin object: the registry's job
    // is to name an API surface, not to resolve one.
    expect(registry).toMatch(
      /import type \{ VitNodeApiPlugin \} from "@\/api\/plugin";/,
    );
    expect(registry).not.toMatch(/^import \{/m);
  });

  it("registers core and leaves every other plugin to the application", () => {
    const registry = stripComments(readFileSync(REGISTRY, "utf8"));
    const entries = [...registry.matchAll(/^\s*"([^"]+)":/gm)].map(
      match => match[1],
    );

    expect(entries).toEqual(["@vitnode/core"]);
  });
});
