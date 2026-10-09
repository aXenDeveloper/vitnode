export const SIDEBAR_COOKIE_NAME = "sidebar_state";
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const isSidebarOpenInCookies = (
  cookieHeader: null | string | undefined,
): boolean =>
  !cookieHeader
    ?.split(";")
    .some(part => part.trim() === `${SIDEBAR_COOKIE_NAME}=false`);
