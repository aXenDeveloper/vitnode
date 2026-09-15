import { ADMIN_RETURN_TO_PARAM } from "./state";

export interface AdminSignInSearch {
  returnTo?: string;
}

/**
 * The AdminCP sign-in page's query string.
 *
 * Its own module rather than the page's, because `src/routes.ts` names it and
 * that file must not reach a page: a route tree is data the build reads in Node,
 * and importing a screen from it would put the screen in the initial bundle.
 */
export const normalizeAdminSignInSearch = (
  input: Record<string, unknown>,
): AdminSignInSearch => ({
  returnTo:
    typeof input[ADMIN_RETURN_TO_PARAM] === "string"
      ? input[ADMIN_RETURN_TO_PARAM]
      : undefined,
});
