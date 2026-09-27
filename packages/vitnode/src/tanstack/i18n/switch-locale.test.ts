import type { AnyRouter } from "@tanstack/react-router";

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { VitNodeI18nConfig } from "@/lib/i18n/types";

import type { LocaleHostReader } from "./locale";

import { localeAlternateLinks } from "../metadata/alternates";
import { createLocaleRewrite } from "./locale";
import { configureIntl, resetIntlRuntime } from "./runtime";
import { switchLocaleOn } from "./switch-locale";

const LOCALES = [
  { code: "de", name: "Deutsch" },
  { code: "en", name: "English" },
  { code: "pl", name: "Polski" },
];

const configure = (i18n: Partial<VitNodeI18nConfig> = {}) =>
  configureIntl({
    fetchMessages: async ({ locale }) =>
      await Promise.resolve({ locale, messages: {} }),
    i18n: {
      defaultLocale: "en",
      locales: LOCALES,
      routePaths: { pl: { "/articles/:slug": "/artykuly/:slug" } },
      ...i18n,
    },
  });

const ARTICLE_ALTERNATES: Record<string, string> = {
  en: "/articles/hello-world",
  pl: "/articles/witaj-swiecie",
};

const slugLocale = (slug: string) =>
  Object.entries(ARTICLE_ALTERNATES).find(
    ([, pathname]) => pathname === `/articles/${slug}`,
  )?.[0] ?? "en";

const routeTree = () => {
  const root = createRootRoute();

  return root.addChildren([
    createRoute({ getParentRoute: () => root, path: "/" }),
    createRoute({ getParentRoute: () => root, path: "/discover" }),
    createRoute({
      getParentRoute: () => root,
      head: ({ params }: { params: { slug: string } }) => ({
        links: localeAlternateLinks({
          alternates: ARTICLE_ALTERNATES,
          locale: slugLocale(params.slug),
          webOrigin: "https://vitnode.example",
        }),
      }),
      path: "/articles/$slug",
    }),
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

const publicHrefAfterSwitch = async (
  router: AnyRouter,
  locale: string,
  readHost: LocaleHostReader = () => undefined,
) => {
  const navigateDocument = vi.fn<(href: string) => void>();
  await switchLocaleOn(router, locale, { navigateDocument, readHost });

  return {
    document: navigateDocument.mock.calls.map(([href]) => href),
    href: router.latestLocation.publicHref,
  };
};

afterEach(() => {
  resetIntlRuntime();
});

describe("switchLocaleOn", () => {
  it("translates the current route and keeps its query and hash", async () => {
    configure();
    const router = await routerAt("/discover?sort=new#list");

    expect(await publicHrefAfterSwitch(router, "pl")).toEqual({
      document: [],
      href: "/pl/discover?sort=new#list",
    });
  });

  it("goes to the target slug when the page declares alternates", async () => {
    configure();
    const router = await routerAt("/articles/hello-world?ref=x");

    expect(await publicHrefAfterSwitch(router, "pl")).toEqual({
      document: [],
      href: "/pl/artykuly/witaj-swiecie?ref=x",
    });
  });

  it("switches back through the alternates from a translated page", async () => {
    configure();
    const router = await routerAt("/pl/artykuly/witaj-swiecie");

    expect((await publicHrefAfterSwitch(router, "en")).href).toBe(
      "/articles/hello-world",
    );
  });

  it("goes to the target locale's home page when the page has no version in it", async () => {
    configure();
    const router = await routerAt("/articles/hello-world?ref=x#top");

    expect((await publicHrefAfterSwitch(router, "de")).href).toBe("/de");
  });

  it("ignores a locale the app does not serve", async () => {
    configure();
    const router = await routerAt("/discover");

    expect(await publicHrefAfterSwitch(router, "fr")).toEqual({
      document: [],
      href: "/discover",
    });
  });

  it("loads the other domain as a document when the target locale lives there", async () => {
    configure({
      domains: [
        {
          defaultLocale: "en",
          locales: ["en", "de"],
          origin: "https://vitnode.com",
        },
        { defaultLocale: "pl", origin: "https://vitnode.pl" },
      ],
    });
    const router = await routerAt(
      "/articles/hello-world?ref=x",
      () => "vitnode.com",
    );

    expect(
      await publicHrefAfterSwitch(router, "pl", () => "vitnode.com"),
    ).toEqual({
      document: ["https://vitnode.pl/artykuly/witaj-swiecie?ref=x"],
      href: "/articles/hello-world?ref=x",
    });
  });

  it("stays on this domain for a locale it also serves", async () => {
    configure({
      domains: [
        {
          defaultLocale: "en",
          locales: ["en", "de"],
          origin: "https://vitnode.com",
        },
        { defaultLocale: "pl", origin: "https://vitnode.pl" },
      ],
    });
    const router = await routerAt("/discover", () => "vitnode.com");

    expect(
      await publicHrefAfterSwitch(router, "de", () => "vitnode.com"),
    ).toEqual({ document: [], href: "/de/discover" });
  });
});
