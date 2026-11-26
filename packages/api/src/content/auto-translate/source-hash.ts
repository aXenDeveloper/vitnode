import { sha256Hex } from "./sha256";

/** Bumped when the fingerprint input changes shape, so old rows stop matching. */
export const AUTO_TRANSLATE_FINGERPRINT_VERSION = 1;

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter(key => (value as Record<string, unknown>)[key] !== undefined)
        .map(key => [key, canonical((value as Record<string, unknown>)[key])]),
    );
  }

  return value;
};

/**
 * The fingerprint of one field's displayed value: SHA-256 over the field name,
 * the source locale when it is known, and the value itself - the text, or the
 * whole rich-text document with its keys sorted, so any change to the text or
 * to the structure a translation preserves (marks, links, mentions) gives a
 * new fingerprint, and nothing else (timestamps, reactions, tags) does.
 *
 * Browser-safe and synchronous: the server keys stored translations by it, and
 * a page computes it for the text it renders to tell whether a translation
 * still belongs to that text.
 *
 * @example
 * ```ts
 * import { autoTranslateFingerprint } from "@vitnode/api/content/auto-translate";
 *
 * const fingerprint = autoTranslateFingerprint({
 *   field: "title",
 *   value: topic.title,
 * });
 * ```
 */
export const autoTranslateFingerprint = ({
  field,
  sourceLocale = null,
  value,
}: {
  field: string;
  /**
   * On a localized content type, the language the record was served in (its
   * public `locale`). Omit it on any other content type.
   */
  sourceLocale?: null | string;
  value: unknown;
}): string =>
  sha256Hex(
    JSON.stringify([
      AUTO_TRANSLATE_FINGERPRINT_VERSION,
      field,
      sourceLocale,
      canonical(value ?? null),
    ]),
  );
