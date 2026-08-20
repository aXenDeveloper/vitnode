/**
 * Framework-agnostic navigation contracts.
 *
 * A link, a router, a redirect and a 404 are the four things roughly a hundred
 * VitNode components cannot be written without, and they are also the four
 * things the host framework owns. This module writes them down *without* the
 * framework in the type, so that `./next` stays the single module in the
 * package that has to be rewritten the day VitNode runs somewhere else.
 *
 * Nothing here imports a framework - the only import is React, which the whole
 * UI is built on either way. The active adapter is asserted against
 * {@link NavigationAdapter} in `types.test-d.ts`, and that assertion is what
 * keeps this file honest: a Next-shaped signature that leaked into the adapter
 * and got used from a view would fail the type suite rather than quietly
 * becoming part of the contract.
 *
 * The contracts are deliberately *narrower* than what Next.js offers. The
 * public exports in `./index` keep the adapter's own inferred types, so callers
 * lose nothing today; the contract describes the subset a second framework
 * would have to reimplement.
 */
import type React from "react";

/**
 * Whether a redirect adds a history entry or overwrites the current one.
 *
 * A plain union rather than a framework enum: `replace` is what a moved URL
 * wants, so that following a stale link does not force the reader to press back
 * twice to leave a page they were never meant to land on.
 */
export type NavigationRedirectType = "push" | "replace";

/** Query values a navigation target may carry. */
export type NavigationQueryParams = Record<
  string,
  boolean | number | readonly string[] | string
>;

/** A navigation target: a path, or a path plus a query to serialise onto it. */
export type NavigationHref =
  string | { pathname: string; query?: NavigationQueryParams };

/**
 * A read-only view of the current URL's query string.
 *
 * Read-only because the query is derived from the URL: the way to change it is
 * to navigate, not to mutate the object the framework handed you.
 */
export type NavigationSearchParams = Omit<
  URLSearchParams,
  "append" | "delete" | "set" | "sort"
>;

/** Imperative, client-side navigation. */
export interface NavigationRouter {
  back: () => void;
  forward: () => void;
  prefetch: (href: NavigationHref) => void;
  push: (href: NavigationHref, options?: { scroll?: boolean }) => void;
  /** Re-fetch the current route's server data without losing client state. */
  refresh: () => void;
  replace: (href: NavigationHref, options?: { scroll?: boolean }) => void;
}

/**
 * The props a VitNode link is allowed to rely on.
 *
 * Intentionally a small subset of `<a>`: everything listed here has to exist in
 * every framework's link, so the list is the price of a port rather than a
 * catalogue of what the current one happens to support.
 */
export interface NavigationLinkProps {
  children?: React.ReactNode;
  className?: string;
  href: NavigationHref;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  prefetch?: boolean | null;
  ref?: React.Ref<HTMLAnchorElement>;
  target?: React.HTMLAttributeAnchorTarget;
}

/** A component that renders {@link NavigationLinkProps} as an anchor. */
export type NavigationLink = React.ComponentType<NavigationLinkProps>;

/**
 * Everything a host framework has to provide for VitNode's UI to navigate.
 *
 * Two link components and two redirects, because locale is the axis that splits
 * them. `Link` and `redirect` prefix the reader's locale, which is what an
 * in-app href wants. `UnlocalizedLink` and `unlocalizedPermanentRedirect` do
 * not, which is what the two callers outside the i18n provider need: the global
 * error page, which renders above it, and the content engine's delivery
 * resolver, whose locations already carry their locale segment - prefixing them
 * again would send `/pl/articles/x` to `/pl/pl/articles/x`.
 */
export interface NavigationAdapter {
  /** Builds the href {@link Link} would render, without rendering one. */
  getPathname: (args: { href: NavigationHref; locale: string }) => string;
  /** Locale-aware anchor: `/settings` renders as `/pl/settings`. */
  Link: NavigationLink;
  /** Ends the render and shows the nearest not-found page. */
  notFound: () => never;
  /** Locale-aware, temporary (307). Async because it resolves the locale. */
  redirect: (
    href: NavigationHref,
    type?: NavigationRedirectType,
  ) => Promise<void>;
  /** Anchor for the paths that must not be locale-prefixed. */
  UnlocalizedLink: NavigationLink;
  /**
   * Permanent (308), for a location that is already a complete path.
   *
   * 308 rather than 301 because it preserves the request method: both behave
   * identically for the `GET` a page is read with, and only one of them still
   * behaves correctly the day a form under a moved path is submitted.
   */
  unlocalizedPermanentRedirect: (
    location: string,
    type?: NavigationRedirectType,
  ) => never;
  /** The current path with the locale segment stripped back off. */
  usePathname: () => string;
  useRouter: () => NavigationRouter;
  useSearchParams: () => NavigationSearchParams;
}
