import { CONTENT_LOCALE_MAX_LENGTH, CONTENT_LOCALE_PATTERN } from "./const";

/**
 * A locale reduced to the form two codes are compared in.
 *
 * Trimmed and lower-cased, because a locale travels in a URL and in an
 * `Accept-Language` header, and `PL`, `pl` and ` pl ` all name the same language.
 * The **canonical** spelling always comes back off `core_languages.code` - this is
 * only ever the comparison key, never a value that gets stored or returned.
 */
export const normalizeContentLocale = (value: string): string =>
  value.trim().toLowerCase();

/** Whether two locale codes name the same language. */
export const contentLocalesMatch = (a: string, b: string): boolean =>
  normalizeContentLocale(a) === normalizeContentLocale(b);

/**
 * Whether a string could be a locale at all.
 *
 * Cheap and deliberately in front of every lookup: an explicit `?locale=` is
 * attacker-controlled, and a 200-character value has no business reaching the
 * language registry, the cache-tag builder or a log line.
 */
export const isContentLocaleShaped = (value: string): boolean => {
  const trimmed = value.trim();

  return (
    trimmed.length > 0 &&
    trimmed.length <= CONTENT_LOCALE_MAX_LENGTH &&
    CONTENT_LOCALE_PATTERN.test(trimmed)
  );
};

/**
 * Where the locale of a public read came from.
 *
 * Reported rather than inferred, because the three sources have different cache
 * consequences: an `explicit` locale is part of the URL and needs no `Vary`, a
 * `negotiated` one depends on a request header and does, and `default` depends on
 * nothing at all.
 */
export type ContentLocaleSource = "default" | "explicit" | "negotiated";

export interface ContentLocaleResolution {
  /** The canonical `core_languages.code`, never the caller's casing. */
  locale: string;
  source: ContentLocaleSource;
}

/**
 * One `Accept-Language` header, best language first.
 *
 * Quality values are honoured because that is what they are for; `q=0` is a
 * refusal and is dropped rather than ranked last. `*` is dropped too - it means
 * "anything", which is what the default locale already is, so keeping it would
 * turn every request into a negotiated one and make `Vary: Accept-Language`
 * unavoidable for no benefit.
 *
 * Malformed input is skipped, never thrown on: this parses a header that anybody
 * can send.
 */
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

/**
 * The best available language for one `Accept-Language` header, or `null`.
 *
 * Two passes, and the order matters: an exact match wins outright, and only then
 * is `pt-BR` allowed to satisfy a request for `pt`. Doing it in one pass would let
 * a header of `pt, pt-BR` resolve to `pt-BR` when `pt` is right there.
 */
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

/**
 * The one place that decides which language a public read is for.
 *
 * **Explicit, then negotiated, then default**, and the precedence is the whole
 * point:
 *
 * - An **explicit** locale is a deliberate request for one language. It is never
 *   quietly replaced - an explicit locale that names no available language comes
 *   back as `null`, and the caller answers the same 404 it answers for a slug that
 *   does not exist. Substituting the default here would serve English to a URL
 *   that said `pl`, which is the exact accident locale-aware caching then makes
 *   permanent.
 * - A **negotiated** locale is a preference, so an unmatched one falls through to
 *   the default rather than failing. A visitor whose browser asks for Icelandic
 *   should get the site, not a 404.
 * - The **default** is the content type's own `localization.defaultLocale`, which
 *   is the one language every record is guaranteed to exist in.
 *
 * `available` is the set of locales this install actually serves. Passing the
 * disabled ones in would let a public URL address a language the app has switched
 * off, which is the read-side half of the rule that already stops content being
 * *written* into one.
 */
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
