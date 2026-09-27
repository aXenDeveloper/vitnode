import { normalizeHost } from "@/lib/i18n/locale-domains";

export interface RequestHostSource {
  headers: Pick<Headers, "get">;
  url: string;
}

const urlHost = (url: string): string | undefined => {
  try {
    return normalizeHost(new URL(url).host);
  } catch {
    return undefined;
  }
};

export const requestHostOf = ({
  headers,
  url,
}: RequestHostSource): string | undefined =>
  normalizeHost(headers.get("x-forwarded-host")) ??
  normalizeHost(headers.get("host")) ??
  urlHost(url);

export const browserHostOf = (
  location: Pick<Location, "host"> | undefined,
): string | undefined => normalizeHost(location?.host);
