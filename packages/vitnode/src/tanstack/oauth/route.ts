import type { OAuthAuthorizeSearch } from "@/views/auth/oauth/authorize-search";

import { OAUTH_AUTHORIZE_PARAMS } from "@/views/auth/oauth/authorize-search";

export const OAUTH_AUTHORIZE_NAMESPACES = [
  "core.global",
  "core.auth.oauth",
] as const;

/**
 * The OAuth parameters as the client sent them. The router parses a value that
 * reads as JSON (`state=123`) into a number or boolean, so those are turned
 * back into text; anything else is dropped and left for the API to refuse.
 */
export const normalizeOAuthAuthorizeSearch = (
  input: Record<string, unknown>,
): OAuthAuthorizeSearch => {
  const search: OAuthAuthorizeSearch = {};

  for (const key of OAUTH_AUTHORIZE_PARAMS) {
    const value = input[key];

    if (typeof value === "string") search[key] = value;
    else if (typeof value === "number" || typeof value === "boolean") {
      search[key] = String(value);
    }
  }

  return search;
};
