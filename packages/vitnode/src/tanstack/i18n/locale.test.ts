import type { AnyRouter } from "@tanstack/react-router";

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { afterEach, describe, expect, it } from "vitest";

import type { VitNodeI18nConfig } from "@/lib/i18n/types";

import { LocaleRoutingConfigError } from "@/lib/i18n/route-paths";

import type { LocaleHostReader } from "./locale";

import { browserHostOf, requestHostOf } from "./host";
import { createLocaleRewrite, localizeHref, resolveLocale } from "./locale";
import { configureIntl, resetIntlRuntime } from "./runtime";

const LOCALES = [
  { code: "en", name: "English" },
  { code: "pl", name: "Polski" },
];

const ROUTE_PATHS = { pl: { "/articles/:id": "/artykuly/:id" } };

const DOMAINS = [
  { defaultLocale: "en", origin: "https://vitnode.com" },
  { defaultLocale: "pl", origin: "https://vitnode.pl" },
];

const configure = (i18n: Partial<VitNodeI18nConfig> = {}) =>
  configureIntl({
    fetchMessages: async ({ locale }) =>
      await Promise.resolve({ locale, messages: {} }),
    i18n: {
      defaultLocale: "en",
      locales: LOCALES,
      routePaths: ROUTE_PATHS,
      ...i18n,
    },
  });

const routeTree = () => {
  const root = createRootRoute();

  return root.addChildren([
    createRoute({ getParentRoute: () => root, path: "/" }),
    createRoute({ getParentRoute: () => root, path: "/articles/$id" }),
    createRoute({ getParentRoute: () => root, path: "/discover" }),
    createRoute({ getParentRoute: () => root, path: "/admin/$" }),
    createRoute({ getParentRoute: () => root, path: "/api/$" }),
  ]);
};

const routerAt = async (
  publicHref: string,
  readHost: LocaleHostReader = () => undefined,
) => {
  const holder: { current?: AnyRouter } = {};
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [publicHref] }),
    rewrite: createLocaleRewrite(() => holder.current, { readHost }),
    routeTree: routeTree(),
  });
  holder.current = router;
  await router.load();

  return router;
};

const articleHref = (router: AnyRouter, id: string) =>
  router.buildLocation({ params: { id }, to: "/articles/$id" }).publicHref;

afterEach(() => {
  resetIntlRuntime();
});

describe("createLocaleRewrite with translated route paths", () => {
  it("reads a translated public URL as the English route", async () => {
    configure();
    const router = await routerAt("/pl/artykuly/42?tab=a#c");

    expect(router.state.location.pathname).toBe("/articles/42");
    expect(router.state.location.search).toEqual({ tab: "a" });
    expect(router.state.location.hash).toBe("c");
  });

  it("writes links in the translated spelling of the current locale", async () => {
    configure();
    const router = await routerAt("/pl/artykuly/42");

    expect(articleHref(router, "7")).toBe("/pl/artykuly/7");
  });

  it("keeps percent-encoded params exactly once encoded", async () => {
    configure();
    const router = await routerAt("/pl/artykuly/za%C5%BC%C3%B3%C5%82%C4%87");

    expect(router.state.location.pathname).toBe("/articles/zażółć");
    expect(articleHref(router, "zażółć")).toBe(
      "/pl/artykuly/za%C5%BC%C3%B3%C5%82%C4%87",
    );
  });

  it("falls back to the English spelling for a route without a translation", async () => {
    configure();
    const router = await routerAt("/pl/discover");

    expect(router.state.location.pathname).toBe("/discover");
    expect(router.buildLocation({ to: "/discover" }).publicHref).toBe(
      "/pl/discover",
    );
  });

  it("leaves the default locale unprefixed and untranslated", async () => {
    configure();
    const router = await routerAt("/articles/42");

    expect(router.state.location.pathname).toBe("/articles/42");
    expect(articleHref(router, "7")).toBe("/articles/7");
  });

  it("prefixes every locale under localePrefix always", async () => {
    configure({ localePrefix: "always" });
    const router = await routerAt("/en/articles/42");

    expect(router.state.location.pathname).toBe("/articles/42");
    expect(articleHref(router, "7")).toBe("/en/articles/7");
  });
});

describe("createLocaleRewrite on paths outside locale routing", () => {
  it.each([
    ["/admin/$", "users"],
    ["/api/$", "articles/1"],
  ] as const)("neither translates nor prefixes %s", async (to, splat) => {
    configure({ domains: DOMAINS });
    const path = `${to.slice(0, -1)}${splat}`;

    const direct = await routerAt(path, () => "vitnode.pl");
    const polish = await routerAt("/artykuly/42", () => "vitnode.pl");

    expect(direct.state.location.pathname).toBe(path);
    expect(
      polish.buildLocation({ params: { _splat: splat }, to }).publicHref,
    ).toBe(path);
  });
});

describe("createLocaleRewrite on language domains", () => {
  it("serves the domain's language without a prefix", async () => {
    configure({ domains: DOMAINS });
    const router = await routerAt("/artykuly/42", () => "vitnode.pl");

    expect(router.state.location.pathname).toBe("/articles/42");
    expect(articleHref(router, "7")).toBe("/artykuly/7");
    expect(
      resolveLocale("/artykuly/42", { readHost: () => "vitnode.pl" }),
    ).toBe("pl");
  });

  it("ignores an unconfigured host", async () => {
    configure({ domains: DOMAINS });
    const router = await routerAt("/pl/artykuly/42", () => "evil.example");

    expect(router.state.location.pathname).toBe("/articles/42");
    expect(articleHref(router, "7")).toBe("/pl/artykuly/7");
  });

  it("renders the same href from the server's request host and the browser's location", async () => {
    configure({ domains: DOMAINS });

    const serverHost = requestHostOf(
      new Request("http://127.0.0.1:3000/artykuly/42", {
        headers: { "x-forwarded-host": "vitnode.pl" },
      }),
    );
    const browserHost = browserHostOf({ host: "vitnode.pl" });

    const server = await routerAt("/artykuly/42", () => serverHost);
    const browser = await routerAt("/artykuly/42", () => browserHost);

    expect(articleHref(server, "7")).toBe(articleHref(browser, "7"));
    expect(articleHref(server, "7")).toBe("/artykuly/7");
  });
});

describe("localizeHref", () => {
  it("returns a path on this host and an absolute URL on another one", () => {
    configure({ domains: DOMAINS });

    expect(
      localizeHref("/articles/7?x=1", "pl", { readHost: () => "vitnode.pl" }),
    ).toBe("/artykuly/7?x=1");
    expect(
      localizeHref("/articles/7?x=1", "pl", { readHost: () => "vitnode.com" }),
    ).toBe("https://vitnode.pl/artykuly/7?x=1");
  });
});

describe("configureIntl", () => {
  it("rejects a route translation that drops a param", () => {
    expect(() =>
      configure({ routePaths: { pl: { "/articles/:id": "/artykuly" } } }),
    ).toThrow(LocaleRoutingConfigError);
  });

  it("rejects a domain for a locale the app does not serve", () => {
    expect(() =>
      configure({
        domains: [
          ...DOMAINS,
          { defaultLocale: "de", origin: "https://vitnode.de" },
        ],
      }),
    ).toThrow(LocaleRoutingConfigError);
  });
});

describe("links to a stored public URL", () => {
  it("preloads the route behind a public href such as a search result", async () => {
    configure();
    const router = await routerAt("/pl/discover");

    const matches = await router.preloadRoute({
      href: "/pl/artykuly/42",
      to: "/pl/artykuly/42",
    });

    expect(matches?.map(match => match.routeId)).toEqual([
      "__root__",
      "/articles/$id",
    ]);
  });
});
