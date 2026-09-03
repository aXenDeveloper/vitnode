import { CONTENT_LOCALE_MAX_LENGTH, CONTENT_LOCALE_PATTERN } from "./const";

export const normalizeContentLocale = (value: string): string =>
  value.trim().toLowerCase();

/** Whether two locale codes name the same language. */
export const contentLocalesMatch = (a: string, b: string): boolean =>
  normalizeContentLocale(a) === normalizeContentLocale(b);

export const isContentLocaleShaped = (value: string): boolean => {
  const trimmed = value.trim();

  return (
    trimmed.length > 0 &&
    trimmed.length <= CONTENT_LOCALE_MAX_LENGTH &&
    CONTENT_LOCALE_PATTERN.test(trimmed)
  );
};

export type ContentLocaleSource = "default" | "explicit" | "negotiated";

export interface ContentLocaleResolution {
  /** The canonical `core_languages.code`, never the caller's casing. */
  locale: string;
  source: ContentLocaleSource;
}

export const parseAcceptLanguage = (header: string): string[] =>
  header
    .split(",")
    .flatMap(part => {
      const [rawTag, ...parameters] = part.split(";");
      const tag = normalizeContentLocale(rawTag ?? "");
      if (tag === "" || tag === "*") return [];

      const quality = parameters
        .map(parameter => parameter.trim())
        .find(parameter => parameter.startsWith("q="));
      if (quality === undefined) return [{ q: 1, tag }];

      const parsed = Number.parseFloat(quality.slice(2));
      if (!Number.isFinite(parsed) || parsed <= 0) return [];

      return [{ q: parsed, tag }];
    })
    // A stable sort, so two tags with the same `q` keep the order they were sent
    // in - which is the order the client meant.
    .sort((a, b) => b.q - a.q)
    .map(entry => entry.tag);

export const negotiateContentLocale = (
  header: string,
  available: readonly string[],
): null | string => {
  const wanted = parseAcceptLanguage(header);
  if (wanted.length === 0 || available.length === 0) return null;

  const byNormalized = new Map(
    available.map(locale => [normalizeContentLocale(locale), locale]),
  );

  for (const tag of wanted) {
    const exact = byNormalized.get(tag);
    if (exact !== undefined) return exact;
  }

  for (const tag of wanted) {
    const base = tag.split(/[-_]/)[0];
    const prefixed = available.find(
      locale => normalizeContentLocale(locale).split(/[-_]/)[0] === base,
    );
    if (prefixed !== undefined) return prefixed;
  }

  return null;
};

export const resolveContentPublicLocale = ({
  acceptLanguage,
  available,
  defaultLocale,
  explicit,
}: {
  /** The request header, when the caller is serving an HTTP request. */
  acceptLanguage?: string;
  /** Every locale this install serves, canonically spelled. */
  available: readonly string[];
  defaultLocale: string;
  /** `?locale=`, a path segment, or an argument. */
  explicit?: string;
}): ContentLocaleResolution | null => {
  const byNormalized = new Map(
    available.map(locale => [normalizeContentLocale(locale), locale]),
  );

  if (explicit !== undefined && explicit.trim() !== "") {
    if (!isContentLocaleShaped(explicit)) return null;

    const matched = byNormalized.get(normalizeContentLocale(explicit));

    return matched === undefined
      ? null
      : { locale: matched, source: "explicit" };
  }

  if (acceptLanguage !== undefined && acceptLanguage.trim() !== "") {
    const negotiated = negotiateContentLocale(acceptLanguage, available);
    if (negotiated !== null)
      return { locale: negotiated, source: "negotiated" };
  }

  // The default locale is not required to be in `available`: an install that
  // switched its own default off is misconfigured, and the boot guard says so far
  // more usefully than a 404 here would.
  const matched = byNormalized.get(normalizeContentLocale(defaultLocale));

  return { locale: matched ?? defaultLocale, source: "default" };
};
