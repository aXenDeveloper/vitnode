export interface ImageAltOccurrence {
  alt?: null | string;
  decorative?: boolean;
}

export type ImageAltSource =
  | "decorative"
  | "fallback"
  | "file"
  | "missing"
  | "occurrence";

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
