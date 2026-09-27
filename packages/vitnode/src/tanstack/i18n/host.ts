import { normalizeHost } from "@/lib/i18n/locale-domains";

export const requestHostOf = ({
  url,
}: Pick<Request, "url">): string | undefined => {
  try {
    return normalizeHost(new URL(url).host);
  } catch {
    return undefined;
  }
};

export const browserHostOf = (
  location: Pick<Location, "host"> | undefined,
): string | undefined => normalizeHost(location?.host);
