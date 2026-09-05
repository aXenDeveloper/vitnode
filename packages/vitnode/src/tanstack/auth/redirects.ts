import { useRouter } from "@tanstack/react-router";

import type { LocaleRouting } from "@/lib/i18n/locale-routing";

import type { AuthNavigate } from "./actions";

import { sanitizeReturnTo } from "./return-to";

export const LOGIN_PATH = "/login";

/** The search parameter carrying where a blocked visitor was heading. */
export const RETURN_TO_PARAM = "returnTo";

/**
 * A base for `URL` to resolve an already-validated path against. Never
 * requested; only `pathname`, `search` and `hash` are read back off it.
 */
const RELATIVE_BASE = "https://vitnode.invalid";

/** A destination in the shape TanStack Router's `redirect`/`navigate` take. */
export interface InternalDestination {
  hash?: string;
  search?: Record<string, string>;
  to: string;
}

export const parseInternalDestination = (
  target: string,
): InternalDestination => {
  const url = new URL(target, RELATIVE_BASE);
  const search = Object.fromEntries(url.searchParams);
  const hash = url.hash.slice(1);

  return {
    ...(hash ? { hash } : {}),
    ...(Object.keys(search).length > 0 ? { search } : {}),
    to: url.pathname,
  };
};

/** The path part of an already-normalised target, without its query or hash. */
const pathnameOf = (target: string): string =>
  new URL(target, RELATIVE_BASE).pathname;

const isLoginTarget = (target: string): boolean => {
  const pathname = pathnameOf(target);

  return pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`);
};

/**
 * Where a visitor who is already signed in should go instead of the login page.
 *
 * Total: every input has an answer, and the answer is always somewhere this app
 * may send a browser. `sanitizeReturnTo` rejects anything that names an origin
 * or a scheme and falls back to `/`; the loop guard then rejects the login page
 * itself.
 *
 * The result is an *internal* path. It is handed to the router, which applies
 * the locale prefix on the way out.
 */
export const postAuthDestination = (returnTo: unknown): string => {
  const target = sanitizeReturnTo(returnTo);

  return isLoginTarget(target) ? sanitizeReturnTo(undefined) : target;
};

/**
 * The `returnTo` to attach when bouncing an anonymous visitor to the login page,
 * or nothing.
 *
 * Built from the *internal* location - the path the route tree matched, with the
 * locale already stripped - so the value that survives a round trip through the
 * URL carries no language, and the prefix is written back exactly once, by the
 * rewrite, when the router builds the link home.
 *
 * `undefined` for the front page, because `?returnTo=/` is the default spelled
 * out: it makes the login URL longer and changes nothing.
 */
export const returnToFor = ({
  hash = "",
  pathname,
  searchStr = "",
}: {
  hash?: string;
  pathname: string;
  searchStr?: string;
}): string | undefined => {
  const suffix = `${searchStr}${hash && !hash.startsWith("#") ? `#${hash}` : hash}`;
  const target = sanitizeReturnTo(`${pathname}${suffix}`);

  if (target === sanitizeReturnTo(undefined) || isLoginTarget(target)) {
    return undefined;
  }

  return target;
};

/**
 * Going somewhere in an application from code, bound to that app's languages.
 *
 * The counterpart to a rendered link: a navigation nobody clicked - the one a
 * sign-in performs when it is finished, the one the login and `/admin` guards
 * perform for somebody who is already signed in, and the one the AdminCP's
 * command palette performs on Enter. Every one of them is handed a path a
 * visitor supplied (`?returnTo=`), so the two questions a target has to answer
 * are kept apart:
 *
 *     safe   - may this app send a browser here at all?   `sanitizeReturnTo`
 *     shape  - what does the router want to be handed?    here
 *
 * The first is applied where the value is *used* and nothing here relaxes it.
 * This answers the second.
 *
 * ## Why it takes `localeRouting`
 *
 * The route tree has no locale in it, so what the router is handed must not
 * either - and then the rewrite writes the prefix back when the location is
 * built. Stripping it here and re-adding it there is one rule running in two
 * directions, not two rules.
 *
 * That matters because the href is user-supplied. `returnTo` is produced from an
 * internal path in the normal flow, but nothing stops somebody visiting
 * `/pl/login?returnTo=/pl/discover` - and `sanitizeReturnTo` accepts it, because
 * it is a perfectly safe application path. Passing `/pl/discover` through as `to`
 * would ask the router to navigate to a route that does not exist under that
 * name.
 *
 * So the app's own locale rule does the stripping - the same one the router's
 * `rewrite.input` applies - rather than a prefix check written here, which would
 * be a second copy that disagreed the first time a language was added. It
 * already knows which paths carry no locale at all (`/admin`, `/api`), so
 * `/admin/core` comes back untouched and `/plugins` is not mistaken for Polish.
 * Which languages exist is the installation's, which is why this is a factory
 * and not a constant.
 */
export const createAuthNavigation = ({
  localeRouting,
}: {
  localeRouting: Pick<LocaleRouting, "deLocalizeUrl">;
}) => {
  /**
   * An href in the spelling the route tree uses: the locale prefix removed, the
   * query and hash intact.
   */
  const internalHref = (href: string): string => {
    const { hash, pathname, search } = localeRouting.deLocalizeUrl(
      new URL(href, RELATIVE_BASE),
    );

    return `${pathname}${search}${hash}`;
  };

  /**
   * A validated internal path, split into the fields a router navigation takes.
   *
   * **Not `href`.** A redirect carrying `href` is used verbatim by
   * `Router.resolveRedirect` - it short-circuits before `buildLocation` - so it
   * would skip the locale rewrite and drop a Polish visitor on the English page.
   * Split into `to`/`search`/`hash`, the same navigation goes through
   * `buildLocation`, the rewrite writes the prefix back, and no code here has to
   * know a language exists.
   *
   * Pure, and deliberately so: the same decision is made in two environments
   * that share no navigation API. A `beforeLoad` running on the server turns the
   * result into an HTTP redirect through `redirect()`, and a click handler in the
   * browser turns it into a `router.navigate()` call. Both take this exact
   * shape, so only the execution differs.
   */
  const internalDestination = (href: string): InternalDestination =>
    parseInternalDestination(internalHref(href));

  return {
    internalDestination,
    /**
     * Navigate to a validated internal path.
     *
     * The browser half. `router.navigate` performs it, so the router's own
     * blockers and dangerous-protocol checks run and nothing here reaches around
     * the framework with `location.assign`.
     */
    useAppNavigate: (): AuthNavigate => {
      const router = useRouter();

      return async (href: string): Promise<void> => {
        await router.navigate(internalDestination(href));
      };
    },
  };
};
