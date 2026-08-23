/** Query parameter carrying the page to return to after signing back in. */
export const ADMIN_REDIRECT_PARAM = "redirect";

/** The AdminCP sign-in page. */
export const ADMIN_SIGN_IN_PATH = "/admin";

/** Where an admin lands when there is nothing to return to. */
export const ADMIN_HOME_PATH = "/admin/core";

/**
 * Narrows a `?redirect=` value down to a path inside the AdminCP, or
 * `undefined` when it is anything else.
 *
 * The value is untrusted on both hops - it arrives in the URL, and again in the
 * sign-in form's payload - so both sanitise it. Without this an expired session
 * would hand anyone a link that signs an admin in and drops them on
 * `//evil.example`, which is exactly the open redirect a "take me back where I
 * was" feature invites. Only locale-less paths under `/admin` survive, and the
 * sign-in page itself is rejected so a successful sign-in never lands back on
 * the form.
 */
export const sanitizeAdminRedirect = (
  value: null | string | undefined,
): string | undefined => {
  if (typeof value !== "string" || !value.startsWith("/")) return undefined;

  // `//evil.example` and `/\evil.example` are both protocol-relative URLs to
  // another origin, and a backslash anywhere else is no more legitimate.
  if (value.includes("\\") || value.startsWith("//")) return undefined;

  const [pathname] = value.split(/[#?]/);

  if (!pathname.startsWith(`${ADMIN_SIGN_IN_PATH}/`)) return undefined;
  // `/admin/../..` stays same-origin, but it leaves the AdminCP.
  if (pathname.split("/").includes("..")) return undefined;

  return value;
};

/**
 * The sign-in href for an admin who was on `pathname` when their session ran
 * out, remembering it as `?redirect=` when it is worth returning to.
 */
export const getAdminSignInHref = (pathname: null | string | undefined) => {
  const redirectTo = sanitizeAdminRedirect(pathname);

  if (!redirectTo) return ADMIN_SIGN_IN_PATH;

  return {
    pathname: ADMIN_SIGN_IN_PATH,
    query: { [ADMIN_REDIRECT_PARAM]: redirectTo },
  };
};
