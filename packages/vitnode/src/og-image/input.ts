import {
  OG_IMAGE_DESCRIPTION_MAX_LENGTH,
  OG_IMAGE_TITLE_MAX_LENGTH,
} from "./types";

const LOCALE = /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/;

/**
 * Collapses whitespace and cuts `value` to `max` characters at a word boundary,
 * ending with `…`. Returns `null` for an empty result. Counts code points, so an
 * emoji or a Polish letter is never split in half.
 */
export const clampOgText = (
  value: null | string | undefined,
  max: number,
): null | string => {
  if (typeof value !== "string") return null;

  const text = value.replace(/\s+/g, " ").trim();
  if (text === "") return null;

  const chars = [...text];
  if (chars.length <= max) return text;

  const cut = chars.slice(0, max - 1).join("");
  const lastSpace = cut.lastIndexOf(" ");
  const head = lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut;

  return `${head.replace(/[\s.,;:!?-]+$/, "")}…`;
};

/** The text fields every image is drawn from, normalized and bounded. */
export interface OgImageText {
  description: null | string;
  locale: string;
  title: string;
}

/**
 * Normalizes the text of one image. Returns `null` when there is no title left,
 * because an image without one is not worth drawing.
 */
export const normalizeOgImageText = ({
  description,
  locale,
  title,
}: {
  description?: null | string;
  locale?: null | string;
  title: null | string | undefined;
}): null | OgImageText => {
  const cleanTitle = clampOgText(title, OG_IMAGE_TITLE_MAX_LENGTH);
  if (cleanTitle === null) return null;

  return {
    description: clampOgText(description, OG_IMAGE_DESCRIPTION_MAX_LENGTH),
    locale: typeof locale === "string" && LOCALE.test(locale) ? locale : "en",
    title: cleanTitle,
  };
};
