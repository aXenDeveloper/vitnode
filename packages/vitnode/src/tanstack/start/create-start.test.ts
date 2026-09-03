// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { VitNodeConfig } from "@/vitnode.config";

vi.mock("@tanstack/react-start/server-only", () => ({}));

const { createMiddleware } = await import("@tanstack/react-start");
const { createVitNodeStart } = await import("./create-start");
const { runLocaleRequest } = await import("./locale-middleware");
const { localeRoutingFromConfig } = await import("@/lib/i18n/locale-routing");

/** Start marks its CSRF middleware with this outside production builds. */
const csrfSymbol = Symbol.for("tanstack-start:csrf-middleware");

const config = {
  i18n: {
    defaultLocale: "en",
    locales: [
      { code: "en", name: "English" },
      { code: "pl", name: "Polski" },
    ],
  },
  metadata: { shortTitle: "Test", title: "Test" },
  plugins: [],
} satisfies VitNodeConfig;

const localeRouting = localeRoutingFromConfig(config.i18n);

const requestMiddlewareOf = async (
  ...args: Parameters<typeof createVitNodeStart>
) => {
  const options = await createVitNodeStart(...args).getOptions();

  return [...(options.requestMiddleware ?? [])];
};

const isValidatedByCsrf = async (
  csrf: unknown,
  { handlerType, url }: { handlerType: string; url: string },
): Promise<boolean> => {
  const { server } = (
    csrf as { options: { server: (ctx: unknown) => unknown } }
  ).options;
  const passthrough = Symbol("next");
  const result = await server({
    handlerType,
    next: () => passthrough,
    request: new Request(url, { headers: { "sec-fetch-site": "cross-site" } }),
  });

  return result !== passthrough;
};

const isCsrf = (middleware: object): boolean => csrfSymbol in middleware;

describe("every VitNode app is CSRF-protected", () => {
  it("installs the CSRF middleware with no configuration at all", async () => {
    const middleware = await requestMiddlewareOf({ config });

    expect(middleware.filter(isCsrf)).toHaveLength(1);
  });

  it("runs it first", async () => {
    const middleware = await requestMiddlewareOf({ config });

    expect(isCsrf(middleware[0])).toBe(true);
  });

  it("keeps it first when the app adds its own middleware", async () => {
    const appMiddleware = createMiddleware().server(
      async ({ next }) => await next(),
    );
    const middleware = await requestMiddlewareOf({
      config,
      requestMiddleware: [appMiddleware],
    });

    expect(isCsrf(middleware[0])).toBe(true);
    // App middleware is appended, never spliced in: locale handling ends the
    // request on a redirect, so anything in front of it would run twice for
    // every visitor arriving at a non-canonical URL.
    expect(middleware.indexOf(appMiddleware)).toBe(middleware.length - 1);
    expect(middleware.indexOf(appMiddleware)).toBeGreaterThan(1);
  });

  it("keeps the app's middleware in the order it declared them", async () => {
    const first = createMiddleware().server(async ({ next }) => await next());
    const second = createMiddleware().server(async ({ next }) => await next());
    const middleware = await requestMiddlewareOf({
      config,
      requestMiddleware: [first, second],
    });

    expect(middleware.slice(-2)).toEqual([first, second]);
  });

  it.each([
    { handlerType: "router", url: "https://a.test/", validated: false },
    {
      handlerType: "serverFn",
      url: "https://a.test/_serverFn/x",
      validated: true,
    },
  ])(
    "validates a $handlerType request: $validated",
    async ({ handlerType, url, validated }) => {
      // A page navigation is not same-origin RPC. Validating `Sec-Fetch-Site` on
      // a top-level cross-site link would reject ordinary inbound traffic.
      const [csrf] = await requestMiddlewareOf({ config });

      expect(await isValidatedByCsrf(csrf, { handlerType, url })).toBe(
        validated,
      );
    },
  );
});

describe("the locale rule only ever touches a page request", () => {
  const next = (response = new Response("ok")) =>
    vi.fn(async () => await Promise.resolve({ response }));

  it("never redirects a server function", async () => {
    // Server function calls arrive with `handlerType: "serverFn"`. Redirecting
    // an RPC to a canonical URL breaks it rather than tidying it.
    const advance = next();
    const result = await runLocaleRequest(
      {
        handlerType: "serverFn",
        next: advance,
        request: new Request("https://a.test/en/discover"),
      },
      localeRouting,
    );

    expect(advance).toHaveBeenCalledOnce();
    expect(result).not.toBeInstanceOf(Response);
  });

  it("redirects a non-canonical document permanently", async () => {
    const advance = next();
    const result = await runLocaleRequest(
      {
        handlerType: "router",
        next: advance,
        request: new Request("https://a.test/en/discover?page=2#top"),
      },
      localeRouting,
    );

    expect(advance).not.toHaveBeenCalled();
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(308);
    expect((result as Response).headers.get("location")).toBe(
      "/discover?page=2#top",
    );
  });

  it("attaches the locale cookie to the redirect that earned it", async () => {
    // `/pl/admin` is both an explicit choice and a redirect, and the redirect is
    // the end of the request - so the cookie has to ride on it or the language
    // the visitor asked for by URL is gone before `/admin` renders.
    const result = (await runLocaleRequest(
      {
        handlerType: "router",
        next: next(),
        request: new Request("https://a.test/pl/admin"),
      },
      localeRouting,
    )) as Response;

    expect(result.status).toBe(308);
    expect(result.headers.get("location")).toBe("/admin");
    expect(result.headers.get("set-cookie")).toContain("pl");
    expect(result.headers.get("cache-control")).toBe("private, no-store");
  });
});

describe("/api/* passes through the pipeline untouched", () => {
  const jsonResponse = () =>
    new Response('{"ok":true}', {
      headers: {
        "cache-control": "public, max-age=300",
        "content-type": "application/json",
      },
    });

  it.each(["https://a.test/api", "https://a.test/api/vitnode/core/session"])(
    "does not redirect %s",
    async url => {
      const advance = vi.fn(
        async () => await Promise.resolve({ response: jsonResponse() }),
      );
      const result = await runLocaleRequest(
        {
          handlerType: "router",
          next: advance,
          request: new Request(url),
        },
        localeRouting,
      );

      expect(advance).toHaveBeenCalledOnce();
      expect(result).not.toBeInstanceOf(Response);
    },
  );

  it("strips a locale prefix in front of it without remembering the language", async () => {
    // `/pl/api/foo` is a mistake to correct, not a language to record: clients
    // hold API URLs verbatim and the API negotiates its own locale per request.
    const result = (await runLocaleRequest(
      {
        handlerType: "router",
        next: vi.fn(),
        request: new Request("https://a.test/pl/api/foo"),
      },
      localeRouting,
    )) as Response;

    expect(result.headers.get("location")).toBe("/api/foo");
    expect(result.headers.get("set-cookie")).toBeNull();
  });

  it("leaves the API's own cache policy to the API", async () => {
    const response = jsonResponse();
    await runLocaleRequest(
      {
        handlerType: "router",
        next: vi.fn(async () => await Promise.resolve({ response })),
        request: new Request("https://a.test/api/vitnode/core/session"),
      },
      localeRouting,
    );

    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
  });
});

describe("what the pipeline does to the response it gets back", () => {
  const documentThatAlreadySetACookie = () =>
    new Response("<!doctype html>", {
      headers: {
        "cache-control": "public, max-age=60",
        "content-type": "text/html; charset=utf-8",
        "set-cookie": "vitnode_auth=abc; Path=/; HttpOnly",
      },
    });

  const renderAt = async (url: string, response: Response) => {
    await runLocaleRequest(
      {
        handlerType: "router",
        next: async () => await Promise.resolve({ response }),
        request: new Request(url),
      },
      localeRouting,
    );

    return response;
  };

  it("appends the locale cookie instead of replacing the session's", async () => {
    // `set`, not `append`, would sign the visitor out: the API mounted at
    // `/api/*` and the auth flow both mint their own cookies.
    const response = await renderAt(
      "https://a.test/pl/discover",
      documentThatAlreadySetACookie(),
    );
    const cookies = response.headers.getSetCookie();

    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain("vitnode_auth=abc");
    expect(cookies.some(cookie => cookie.includes("pl"))).toBe(true);
  });

  it("forces the document directive over whatever the route asked for", async () => {
    const response = await renderAt(
      "https://a.test/pl/discover",
      documentThatAlreadySetACookie(),
    );

    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("writes no cookie for an unprefixed URL", async () => {
    // `/discover` is English because English is the default, not because the
    // visitor chose it - overwriting a stored `pl` here would undo the switcher.
    const response = await renderAt(
      "https://a.test/discover",
      new Response("<!doctype html>", {
        headers: { "content-type": "text/html" },
      }),
    );

    expect(response.headers.getSetCookie()).toEqual([]);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
