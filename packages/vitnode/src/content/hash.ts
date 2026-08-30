/**
 * Short deterministic hashes, for generated identifiers that have to fit.
 *
 * ## Why this file is not called `fingerprint.ts`
 *
 * It was, and it broke the development server for anybody running an ad
 * blocker. Filter lists block any request whose path matches `fingerprint*.js`
 * - the rule is aimed at browser-fingerprinting scripts - and Vite serves every
 * module by its real filename in dev, so `/@fs/…/content/fingerprint.js` came
 * back as `net::ERR_BLOCKED_BY_CLIENT`. That failure surfaces as
 * `Failed to fetch dynamically imported module` against the *entry*, naming a
 * file in `@tanstack/react-start` that is perfectly fine, so it costs an
 * afternoon to trace.
 *
 * The exported names are unaffected and deliberately unchanged: blocking is by
 * URL, not by symbol, and `fingerprint` is what this function is. Only the
 * module's filename ever reaches a filter list.
 *
 * Production builds do not care either way - the module is bundled into a
 * content-hashed chunk - so this is purely about the dev server. Anything else
 * added here should keep the filename boring for the same reason.
 */

/**
 * FNV-1a, 32 bits, base36. Deterministic across processes and Node versions,
 * needs no dependency, and is short enough to leave a readable prefix intact.
 */
export const fingerprint = (value: string): string => {
  let hash = 0x811c9dc5;

  for (let position = 0; position < value.length; position += 1) {
    hash ^= value.charCodeAt(position);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(36).padStart(7, "0");
};

/**
 * Keeps a generated identifier under a hard length limit.
 *
 * Plain truncation is not enough: two long values that differ only near the end
 * would collapse onto the same result. Appending a fingerprint of the *whole*
 * value keeps the prefix readable and the result distinct.
 *
 * Two callers, two limits: Postgres identifiers cap at 63 characters, and a
 * Next cache tag at 256.
 */
export const clampWithFingerprint = (
  value: string,
  maxLength: number,
): string => {
  if (value.length <= maxLength) return value;

  const suffix = `_${fingerprint(value)}`;

  return `${value.slice(0, maxLength - suffix.length)}${suffix}`;
};
