/**
 * Which ALT text one image occurrence renders with, in order:
 *
 * 1. the occurrence itself - an explicit text, or decorative (`""`);
 * 2. the file's default ALT in the requested language (Core Files);
 * 3. the file's default ALT in a fallback language;
 * 4. nothing known: `""`, flagged `missing` so editors can be told.
 *
 * An explicit empty value is kept as it is: a person decided the image says
 * nothing, and a fallback must not overrule that.
 */
export interface ImageAltOccurrence {
  /** The text this occurrence set, if any. `null`/`undefined` means "not set". */
  alt?: null | string;
  /** This occurrence is decorative - screen readers skip it. */
  decorative?: boolean;
}

export type ImageAltSource =
  "decorative" | "fallback" | "file" | "missing" | "occurrence";

export interface ResolvedImageAlt {
  alt: string;
  source: ImageAltSource;
}

export const resolveImageAlt = ({
  alts,
  fallbackLocales = [],
  locale,
  occurrence = {},
}: {
  /** The file's default ALT per language code, from its descriptor. */
  alts?: null | Record<string, string>;
  fallbackLocales?: readonly string[];
  locale: string;
  occurrence?: ImageAltOccurrence;
}): ResolvedImageAlt => {
  if (occurrence.decorative) return { alt: "", source: "decorative" };
  const own = occurrence.alt?.trim();
  if (own) return { alt: own, source: "occurrence" };

  if (alts && Object.hasOwn(alts, locale)) {
    return { alt: alts[locale], source: "file" };
  }
  for (const fallback of fallbackLocales) {
    if (alts && Object.hasOwn(alts, fallback)) {
      return { alt: alts[fallback], source: "fallback" };
    }
  }

  return { alt: "", source: "missing" };
};
