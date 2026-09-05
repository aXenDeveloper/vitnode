import { sanitizeReturnTo } from "../auth/return-to";
import { ADMIN_ENTRY_PATH, ADMIN_HOME_PATH } from "./state";

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

export const isSafeAdminReturnTo = (value: unknown): value is string =>
  typeof value === "string" &&
  sanitizeAdminReturnTo(value, { fallback: ADMIN_HOME_PATH }) === value;

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
