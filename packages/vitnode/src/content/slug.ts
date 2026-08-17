import { CONTENT_SLUG_DEFAULT_LENGTH } from "./const";

/**
 * Letters Unicode normalisation cannot take apart.
 *
 * `NFD` splits a base letter from its combining marks, which handles nearly
 * every accented character - but a stroked or ligature letter is one indivisible
 * codepoint, so it survives the pass and would then be dropped as "not a-z".
 * `ł` is the one the repo already special-cases in `removeSpecialCharacters`;
 * the rest are its immediate neighbours.
 */
const TRANSLITERATIONS: Record<string, string> = {
  æ: "ae",
  đ: "d",
  ð: "d",
  ł: "l",
  ø: "o",
  œ: "oe",
  ß: "ss",
  þ: "th",
};

/**
 * Turns any text into a URL segment: lowercase, ASCII, dash separated.
 *
 * ```text
 * "Hello World"      -> "hello-world"
 * "  Hello   World " -> "hello-world"
 * "hello---world"    -> "hello-world"
 * "Zażółć gęślą"     -> "zazolc-gesla"
 * ```
 *
 * Deterministic and pure - the same input always yields the same slug, on every
 * machine and in every process. Nothing random and nothing numeric is appended:
 * uniqueness is the unique index's job, and a collision surfaces as a 409 rather
 * than as a silently different URL.
 *
 * Returns `""` for text that folds to nothing - CJK, Cyrillic, emoji. Callers
 * treat that as a failure rather than inventing a fallback; see the service's
 * slug handling.
 *
 * Not the same thing as `removeSpecialCharacters`, which does not lowercase and
 * keeps characters that are illegal in a slug. That one stays where it is, for
 * the blog's `friendlyUrl`.
 */
export const slugify = (
  value: string,
  maxLength: number = CONTENT_SLUG_DEFAULT_LENGTH,
): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[æđðłøœßþ]/g, match => TRANSLITERATIONS[match])
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    // Truncation can land mid-separator, and a trailing dash is not a slug.
    .replace(/-+$/, "");
