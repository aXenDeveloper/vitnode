import { CONTENT_SLUG_DEFAULT_LENGTH } from "./const";

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
