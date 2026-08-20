/**
 * What the navigation layer promises, tested against a stubbed framework.
 *
 * Two things are worth a test here and the rest is not. The first is *which*
 * primitive each export reaches for - the locale-aware redirect and the
 * unlocalized one differ by nothing at the call site and by a doubled locale
 * segment in production, so the wiring is the bug. The second is that
 * `@/lib/navigation` still hands back the same functions, because roughly fifty
 * modules and every app import it by that name.
 *
 * The framework is stubbed rather than exercised: whether Next.js redirects
 * correctly is Next.js's test, not ours.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const nextIntl = vi.hoisted(() => ({
  getLocale: vi.fn(async () => await Promise.resolve("pl")),
  getPathname: vi.fn(),
  Link: () => null,
  redirect: vi.fn(),
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}));

const next = vi.hoisted(() => ({
  Link: () => null,
  notFound: vi.fn(),
  permanentRedirect: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock("next-intl/navigation", () => ({
  createNavigation: () => ({
    getPathname: nextIntl.getPathname,
    Link: nextIntl.Link,
    redirect: nextIntl.redirect,
    usePathname: nextIntl.usePathname,
    useRouter: nextIntl.useRouter,
  }),
}));

vi.mock("next-intl/server", () => ({ getLocale: nextIntl.getLocale }));

vi.mock("next/link", () => ({ default: next.Link }));

vi.mock("next/navigation", () => ({
  notFound: next.notFound,
  permanentRedirect: next.permanentRedirect,
  useSearchParams: next.useSearchParams,
}));

const navigation = await import("./index");
const shim = await import("@/lib/navigation");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("redirect", () => {
  it("prefixes the reader's locale, which is why it has to be async", async () => {
    await navigation.redirect("/settings");

    expect(nextIntl.getLocale).toHaveBeenCalledTimes(1);
    expect(nextIntl.redirect).toHaveBeenCalledWith(
      { href: "/settings", locale: "pl" },
      undefined,
    );
  });

  it("passes the history mode through untouched", async () => {
    await navigation.redirect("/settings", "replace");

    expect(nextIntl.redirect).toHaveBeenCalledWith(
      { href: "/settings", locale: "pl" },
      "replace",
    );
  });

  it("carries a query object as a query object, not a serialised string", async () => {
    await navigation.redirect({ pathname: "/search", query: { q: "hono" } });

    expect(nextIntl.redirect).toHaveBeenCalledWith(
      { href: { pathname: "/search", query: { q: "hono" } }, locale: "pl" },
      undefined,
    );
  });
});

describe("unlocalizedPermanentRedirect", () => {
  it("leaves the location alone - it already carries its locale segment", () => {
    navigation.unlocalizedPermanentRedirect("/pl/articles/moved", "replace");

    expect(next.permanentRedirect).toHaveBeenCalledWith(
      "/pl/articles/moved",
      "replace",
    );
    // The whole reason this export exists: prefixing again would send
    // `/pl/articles/moved` to `/pl/pl/articles/moved`.
    expect(nextIntl.getLocale).not.toHaveBeenCalled();
    expect(nextIntl.redirect).not.toHaveBeenCalled();
  });
});

describe("the two links", () => {
  it("keeps the locale-aware and locale-free anchors distinct", () => {
    // `global-error` renders above the i18n provider and must get the plain one;
    // a mix-up here throws at runtime on the page that exists to not throw.
    expect(navigation.Link).toBe(nextIntl.Link);
    expect(navigation.UnlocalizedLink).toBe(next.Link);
    expect(navigation.Link).not.toBe(navigation.UnlocalizedLink);
  });
});

describe("the surface", () => {
  it("exports exactly the contract, so a port knows what it owes", () => {
    expect(Object.keys(navigation).toSorted()).toEqual([
      "Link",
      "UnlocalizedLink",
      "getPathname",
      "notFound",
      "redirect",
      "unlocalizedPermanentRedirect",
      "usePathname",
      "useRouter",
      "useSearchParams",
    ]);
  });

  it("delegates the read-only hooks and `notFound` without wrapping them", () => {
    // Re-exported by identity on purpose: a wrapper around a function whose job
    // is to throw only adds a frame to every stack trace.
    expect(navigation.notFound).toBe(next.notFound);
    expect(navigation.useSearchParams).toBe(next.useSearchParams);
    expect(navigation.usePathname).toBe(nextIntl.usePathname);
    expect(navigation.useRouter).toBe(nextIntl.useRouter);
    expect(navigation.getPathname).toBe(nextIntl.getPathname);
  });
});

describe("the `@/lib/navigation` shim", () => {
  it("still exports the same five names it always did", () => {
    expect(Object.keys(shim).toSorted()).toEqual([
      "Link",
      "getPathname",
      "redirect",
      "usePathname",
      "useRouter",
    ]);
  });

  it("hands back the very same functions, not lookalikes", () => {
    expect(shim.Link).toBe(navigation.Link);
    expect(shim.getPathname).toBe(navigation.getPathname);
    expect(shim.redirect).toBe(navigation.redirect);
    expect(shim.usePathname).toBe(navigation.usePathname);
    expect(shim.useRouter).toBe(navigation.useRouter);
  });
});
