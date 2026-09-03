/** Where an absent or rejected target lands: this site's root. */
export const DEFAULT_RETURN_TO = "/";

const SENTINEL_ORIGIN = "http://return-to.invalid";

const REJECTED_CHARACTERS = /[\s\\]|\p{Cc}/u;

const normalize = (value: string): null | string => {
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (REJECTED_CHARACTERS.test(value)) return null;

  let url: URL;
  try {
    url = new URL(value, SENTINEL_ORIGIN);
  } catch {
    return null;
  }

  if (url.origin !== SENTINEL_ORIGIN) return null;

  // Rebuilt from the parsed parts rather than returned as given, so the caller
  // navigates to what was actually validated. The locale prefix rides along in
  // the pathname untouched: `/pl/discover` is just a path here, which is why
  // this needs to know nothing about languages.
  return `${url.pathname}${url.search}${url.hash}`;
};

/** Whether `value` is a target {@link sanitizeReturnTo} would keep. */
export const isSafeReturnTo = (value: unknown): value is string =>
  typeof value === "string" && normalize(value) !== null;

/**
 * `value` as a path the application may navigate to, or `fallback`.
 *
 * Total by construction: every input has an answer, so a caller never has to
 * branch on "was it valid" before navigating. An unusable `fallback` is held to
 * the same rule and degrades to {@link DEFAULT_RETURN_TO} rather than being
 * trusted for having been passed in code.
 */
export const sanitizeReturnTo = (
  value: unknown,
  { fallback = DEFAULT_RETURN_TO }: { fallback?: string } = {},
): string => {
  const target = typeof value === "string" ? normalize(value) : null;

  return target ?? normalize(fallback) ?? DEFAULT_RETURN_TO;
};
