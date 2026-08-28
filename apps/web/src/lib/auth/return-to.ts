/**
 * Where a visitor goes after signing in, when the URL asked for somewhere
 * specific.
 *
 * A pure string transform - no router, no request, no `window` - because the
 * value it judges is the most attacker-reachable input in the whole auth flow:
 * anyone can put `?returnTo=` on a link to the login page, and whatever comes
 * out of here is handed to a navigation. So the rule is deliberately narrow:
 * an *application-relative path*, or the fallback. Never a value that can name
 * an origin, and never a scheme.
 *
 * That is what stops the two classic bugs at once - an open redirect
 * (`?returnTo=https://evil.example.com`, which turns this site's login into a
 * credible phishing hop) and a script URL (`?returnTo=javascript:...`, which is
 * an XSS sink the moment anything assigns it to `location`).
 *
 * Nothing here performs a redirect. It answers "is this somewhere I may send
 * you, and spelled how?" and the caller navigates.
 */

/** Where an absent or rejected target lands: this site's root. */
export const DEFAULT_RETURN_TO = '/'

/**
 * A base for `URL` to resolve a path against.
 *
 * `.invalid` is reserved by RFC 2606 precisely so it can never be a real host,
 * which is what makes the origin comparison below meaningful: a value that
 * carries an origin of its own - `https://evil.example.com`,
 * `//evil.example.com` - resolves to *that* origin instead of this one, and is
 * spotted by the two no longer matching.
 */
const SENTINEL_ORIGIN = 'http://return-to.invalid'

/**
 * Characters no accepted target may carry raw.
 *
 * Whitespace and C0/C1 controls because browsers *strip* tab, newline and
 * carriage return out of a URL before parsing it, so `/\tjavascript:x` and
 * `java\nscript:x` are two spellings of one thing and only one of them looks
 * suspicious. A backslash because the URL parser treats `\` as `/` in a special
 * scheme, which makes `/\evil.example.com` a protocol-relative URL wearing a
 * disguise. Rejecting all of them outright is cheaper than trying to out-guess
 * the normalisation, and a legitimate path needs none of them - it spells them
 * percent-encoded.
 */
const REJECTED_CHARACTERS = /[\s\\]|\p{Cc}/u

/**
 * The canonical spelling of an acceptable target, or `null`.
 *
 * The string checks come first and do the real work: a target must begin with a
 * single `/`, which excludes every scheme (`javascript:`, `data:`, `https:`) and
 * every protocol-relative host (`//evil.example.com`) before a parser is
 * involved at all. `URL` then normalises what survives - resolving `.` and `..`,
 * percent-encoding what has to be - and the origin check is the backstop for
 * any spelling the string checks did not anticipate.
 */
const normalize = (value: string): null | string => {
  if (!value.startsWith('/') || value.startsWith('//')) return null
  if (REJECTED_CHARACTERS.test(value)) return null

  let url: URL
  try {
    url = new URL(value, SENTINEL_ORIGIN)
  } catch {
    return null
  }

  if (url.origin !== SENTINEL_ORIGIN) return null

  // Rebuilt from the parsed parts rather than returned as given, so the caller
  // navigates to what was actually validated. The locale prefix rides along in
  // the pathname untouched: `/pl/discover` is just a path here, which is why
  // this needs to know nothing about languages.
  return `${url.pathname}${url.search}${url.hash}`
}

/** Whether `value` is a target {@link sanitizeReturnTo} would keep. */
export const isSafeReturnTo = (value: unknown): value is string =>
  typeof value === 'string' && normalize(value) !== null

/**
 * `value` as a path this app may navigate to, or `fallback`.
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
  const target = typeof value === 'string' ? normalize(value) : null

  return target ?? normalize(fallback) ?? DEFAULT_RETURN_TO
}
