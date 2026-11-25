/** The OAuth parameters an MCP client puts on the consent page's URL. */
export const OAUTH_AUTHORIZE_PARAMS = [
  "client_id",
  "redirect_uri",
  "response_type",
  "code_challenge",
  "code_challenge_method",
  "state",
  "scope",
  "resource",
] as const;

export type OAuthAuthorizeParam = (typeof OAUTH_AUTHORIZE_PARAMS)[number];

/** The consent page's search: each OAuth parameter the client sent, as text. */
export type OAuthAuthorizeSearch = Partial<Record<OAuthAuthorizeParam, string>>;
