import { sanitizeReturnTo } from "./return-to";

/**
 * Where the auth flow sends people, as pure data.
 *
 * Two directions and one rule each:
 *
 *     anonymous at /settings  ->  /login?returnTo=/settings   (returnToFor)
 *     signed in at /login     ->  /settings                   (postAuthDestination)
 *
 * Nothing here navigates, and nothing here imports the router. Every function is
 * a string transform, which is what lets the whole redirect policy - including
 * the two ways it can go wrong - be stated as a table rather than exercised
 * through a browser.
 *
 * `./return-to` is the security half: it decides whether a target is an
 * application-relative path at all, and rejects every origin, scheme and
 * control-character spelling. This module builds on that answer and adds the two
 * things that are about *this* flow rather than about safety in general - the
 * loop guard below, and the shape a TanStack redirect wants.
 */

/**
 * The login page's internal path - what the route tree matches, with no locale
 * in it.
 *
 * `/login` and `/pl/login` are the same route: the application's locale rewrite
 * strips the prefix before matching and writes it back into every href the
 * router builds. So this constant is deliberately un-prefixed, and nothing in
 * the auth flow concatenates a language onto it.
 */
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

/**
 * A validated path, split into the fields a router navigation takes.
 *
 * **Not `href`.** A redirect carrying `href` is used verbatim
 * (`Router.resolveRedirect` short-circuits on it), so it never reaches
 * `buildLocation` and never runs the locale rewrite - a Polish visitor signing
 * in at `/pl/login` would land on the English `/discover`. Split into
 * `to`/`search`/`hash`, the same navigation goes through `buildLocation`, the
 * rewrite writes the prefix back, and no code here has to know a language
 * exists.
 *
 * Repeated search keys collapse to the last one. A `returnTo` is a link
 * somebody clicked, not a form post, and every VitNode page reads its
 * parameters singly.
 */
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

/**
 * Whether a target points back at the login page - or anything under it.
 *
 * The loop guard, and the one failure mode this module exists to prevent:
 * `/login?returnTo=/login` sends a signed-in visitor to the login page, whose
 * guard sends them to `/login`, forever. `/login/sso/google` is caught by the
 * same rule, because finishing an OAuth round trip that has already completed is
 * the same loop wearing a provider's name.
 */
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
