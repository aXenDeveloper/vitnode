/** A non-empty string as it arrived, or nothing at all. */
const keptString = <K extends string>(
  key: K,
  value: unknown,
): Partial<Record<K, string>> =>
  typeof value === "string" && value !== ""
    ? ({ [key]: value } as Record<K, string>)
    : {};

export interface LoginSearch {
  returnTo?: string;
}

export const normalizeLoginSearch = (
  input: Record<string, unknown>,
): LoginSearch => keptString("returnTo", input.returnTo);

export interface SsoCallbackSearch {
  code?: string;
  /** The token of an emailed SSO confirmation link. */
  confirm?: string;
  error?: string;
  state?: string;
  /** Apple's first-authorization profile, relayed by the `form_post` bridge. */
  user?: string;
}

export const normalizeSsoCallbackSearch = (
  input: Record<string, unknown>,
): SsoCallbackSearch => ({
  ...keptString("code", input.code),
  ...keptString("confirm", input.confirm),
  ...keptString("error", input.error),
  ...keptString("state", input.state),
  ...keptString("user", input.user),
});
