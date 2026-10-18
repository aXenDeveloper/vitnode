/** What one placement of an image says about its alt text. */
export interface ImageAltOccurrence {
  /** Alt text written for this placement; wins over the file's own. */
  alt?: null | string;
  /** Marks the image decorative: the alt is `""` whatever else is set. */
  decorative?: boolean;
}

export type ImageAltSource =
  | "decorative"
  | "fallback"
  | "file"
  | "missing"
  | "occurrence";

/** The alt text to render and where it came from. */
export interface ResolvedImageAlt {
  /** `""` when decorative or missing. */
  alt: string;
  source: ImageAltSource;
}

/**
 * Picks an image's alt text, in this order: decorative (empty) → the
 * placement's own trimmed `alt` → the file's alt in `locale` → the file's alt
 * in the first of `fallbackLocales` that has one → empty with source
 * `missing`. A locale counts when the file has an entry for it, even an empty
 * one. Pure; runs anywhere.
 */
export const resolveImageAlt = ({
  alts,
  fallbackLocales = [],
  locale,
  occurrence = {},
}: {
  /** The file's alt texts keyed by locale code. */
  alts?: null | Record<string, string>;
  /** Locales to try, in order, when `locale` has no entry. Defaults to none. */
  fallbackLocales?: readonly string[];
  /** The locale being rendered. */
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
