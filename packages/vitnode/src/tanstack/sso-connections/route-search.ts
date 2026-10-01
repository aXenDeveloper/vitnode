export interface SsoSettingsSearch {
  import?: string;
}

const PROVIDER_ID = /^[\w-]{1,255}$/;

export const normalizeSsoSettingsSearch = (
  input: Record<string, unknown>,
): SsoSettingsSearch =>
  typeof input.import === "string" && PROVIDER_ID.test(input.import)
    ? { import: input.import }
    : {};

export const ssoSettingsHref = ({ import: providerId }: SsoSettingsSearch) =>
  providerId
    ? `/settings/sso?${new URLSearchParams({ import: providerId }).toString()}`
    : "/settings/sso";
