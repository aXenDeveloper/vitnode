/**
 * The Next.js navigation adapter - the active implementation.
 *
 * This is the one module in the package that is allowed to import `next/link`
 * and `next/navigation`. Everything else goes through `./index`, so porting
 * VitNode to another framework is a matter of writing a sibling of this file
 * and repointing that barrel, rather than editing the ~60 call sites that
 * navigate.
 *
 * The locale-aware half is `next-intl`'s, not ours: `createNavigation()`
 * returns a `Link`, a router and a `redirect` that prefix the active locale.
 * The locale-free half comes straight from `next/navigation`, unwrapped -
 * `notFound` and `permanentRedirect` already take the shape the contract asks
 * for, and a wrapper around a function whose whole job is to throw would only
 * add a frame to every stack trace.
 */

// The one module where these imports are the point rather than a leak.
/* eslint-disable no-restricted-imports */
import type { QueryParams } from "next-intl/navigation";

import { createNavigation } from "next-intl/navigation";
import { getLocale } from "next-intl/server";

import type { NavigationRedirectType } from "./types";

/** An anchor that renders the href it was given, locale and all. */
export { default as UnlocalizedLink } from "next/link";

/**
 * Locale-free primitives, re-exported as-is.
 *
 * `permanentRedirect` is renamed rather than aliased away: the name is the
 * warning. It issues a 308 to a location it does not touch, so the caller is
 * responsible for the locale segment - see {@link NavigationAdapter} for the
 * two places where that is the correct trade.
 */
export {
  notFound,
  permanentRedirect as unlocalizedPermanentRedirect,
  useSearchParams,
} from "next/navigation";

const {
  Link,
  getPathname,
  redirect: redirectWithLocale,
  usePathname,
  useRouter,
} = createNavigation();

/**
 * A temporary (307) redirect to a path written *without* a locale prefix.
 *
 * Async, and that is not incidental: the locale lives in the request, so the
 * only honest way to prefix it is to await it. Callers are server actions and
 * route handlers, which are async already.
 */
const redirect = async (
  href: string | { pathname: string; query?: QueryParams },
  type?: NavigationRedirectType,
): Promise<void> => {
  const locale = await getLocale();

  redirectWithLocale({ href, locale }, type);
};

export { getPathname, Link, redirect, usePathname, useRouter };
