import { sanitizeReturnTo } from "../auth/return-to";
import { ADMIN_ENTRY_PATH, ADMIN_HOME_PATH } from "./state";

/**
 * Where an administrator goes after signing in, when the URL asked for
 * somewhere specific.
 *
 * A pure string transform - no router, no request, no `window` - because the
 * value it judges is the most attacker-reachable input in the AdminCP: anyone
 * can put `?returnTo=` on a link to `/admin`, and whatever comes out of here is
 * handed to a navigation.
 *
 * Two rules, applied in order, and they answer different questions:
 *
 *     safe   - may this app send a browser here at all?   sanitizeReturnTo
 *     admin  - is this inside the AdminCP?                isAdminTarget
 *
 * The first is `tanstack/auth`'s and is reused rather than reimplemented. It
 * rejects every origin (`https://evil.example.com`), every protocol-relative
 * host (`//evil.example.com`), every scheme (`javascript:`, `data:`) and the
 * whitespace and control-character spellings browsers strip before parsing - the
 * open redirect and the XSS sink, in one place, for both sessions. Writing a
 * second copy here is how the two would eventually disagree.
 *
 * The second is this module's own, and it is narrower than the public flow's for
 * a reason stated under {@link sanitizeAdminReturnTo}.
 */

/**
 * Whether an already-safe target is a page inside the AdminCP.
 *
 * `/admin/core/users` yes; `/admin` itself no - see the loop guard below;
 * `/discover` no, and `/administrators` no, which is why the test is on the
 * `/admin/` prefix with its slash rather than on `startsWith("/admin")`.
 */
const isAdminTarget = (target: string): boolean =>
  target.startsWith(`${ADMIN_ENTRY_PATH}/`);

/**
 * `value` as an AdminCP path this app may navigate to, or the AdminCP's home.
 *
 * Total by construction: every input has an answer, so a caller never has to
 * branch on "was it valid" before navigating.
 *
 * ## Why this is narrower than the public `postAuthDestination`
 *
 * The public flow accepts any safe application path, because signing in at
 * `/login` is how you get to the rest of the site. Signing in at `/admin` is
 * not: it mints the *admin* session and nothing else - the API branches on
 * `isAdmin` and calls `SessionAdminModel.createSessionByUserId`, leaving the
 * public cookie untouched - so an administrator who arrives at the AdminCP door
 * and is then bounced to `/settings` has been sent somewhere the credentials
 * they just typed did not unlock. Confining the destination to `/admin/*` keeps
 * the sign-in and its landing page describing the same session.
 *
 * It also closes a small phishing seam that the safety rule alone leaves open.
 * `?returnTo=` is attacker-supplied, and a link that reads
 * `https://example.com/admin?returnTo=/some/convincing/page` would use the
 * AdminCP's own sign-in form as a credible hop to a page of somebody else's
 * choosing. That page is still on this site, so it is not an open redirect - but
 * there is no reason for the admin door to lead anywhere except behind it.
 *
 * ## The loop guard
 *
 * `/admin` itself is rejected. It is the sign-in screen, and its own guard sends
 * a signed-in administrator to their destination - so accepting it would mean
 * signing in, landing on the sign-in page, and being redirected off it again.
 * Not infinite, because the second pass falls back to the home path, but a
 * visible bounce through a form the administrator has already filled in.
 */
export const sanitizeAdminReturnTo = (
  value: unknown,
  { fallback = ADMIN_HOME_PATH }: { fallback?: string } = {},
): string => {
  const target = sanitizeReturnTo(value, { fallback });

  if (isAdminTarget(target)) return target;

  // The fallback is held to the same rule rather than trusted for having been
  // passed in code, so a caller cannot widen this by supplying a default of
  // their own that points outside the AdminCP.
  const fallbackTarget = sanitizeReturnTo(fallback, {
    fallback: ADMIN_HOME_PATH,
  });

  return isAdminTarget(fallbackTarget) ? fallbackTarget : ADMIN_HOME_PATH;
};

/**
 * Whether a target is somewhere {@link sanitizeAdminReturnTo} would keep as-is.
 *
 * For the guard that decides whether attaching a `?returnTo=` to the sign-in URL
 * is worth doing at all.
 */
export const isSafeAdminReturnTo = (value: unknown): value is string =>
  typeof value === "string" &&
  sanitizeAdminReturnTo(value, { fallback: ADMIN_HOME_PATH }) === value;

/**
 * The `returnTo` to attach when bouncing an administrator to `/admin`, or
 * nothing.
 *
 * Built from the *internal* location - the path the route tree matched - which
 * for the AdminCP is also the public one, because `/admin` and its descendants
 * carry no locale prefix in any language. That is not a coincidence to rely on
 * quietly: `DEFAULT_IGNORED_LOCALE_PATHS` lists `/admin`, the rewrite therefore
 * neither strips nor writes a prefix here, and `handleLocaleRequest` 308s
 * `/pl/admin/...` to `/admin/...` before a route ever sees it. So there is no
 * language to strip and none to write back, and nothing in this module needs to
 * know a language exists.
 *
 * `undefined` for the AdminCP home, because `?returnTo=/admin/core` is the
 * default spelled out: it makes the URL longer and changes nothing.
 */
export const adminReturnToFor = ({
  hash = "",
  pathname,
  searchStr = "",
}: {
  hash?: string;
  pathname: string;
  searchStr?: string;
}): string | undefined => {
  const suffix = `${searchStr}${hash && !hash.startsWith("#") ? `#${hash}` : hash}`;
  const target = sanitizeAdminReturnTo(`${pathname}${suffix}`);

  return target === ADMIN_HOME_PATH ? undefined : target;
};
