/**
 * Browser-safe half of VitNode's Open Graph images: sizes, limits and the
 * descriptor a page puts in its `<head>`. The renderer, fonts and templates
 * live in `@vitnode/core/og-image/server`, which never reaches a client bundle.
 */

/** Width of every generated image, in pixels - the size social cards expect. */
export const OG_IMAGE_WIDTH = 1200;

/** Height of every generated image, in pixels. */
export const OG_IMAGE_HEIGHT = 630;

/** The only format the generator writes. */
export const OG_IMAGE_MIME_TYPE = "image/png";

/** Longest title a request may hand the generator, in characters. */
export const OG_IMAGE_TITLE_MAX_LENGTH = 300;

/** Longest description a request may hand the generator, in characters. */
export const OG_IMAGE_DESCRIPTION_MAX_LENGTH = 1000;

/** What a template id may look like: `default`, `blog-post`, `docs_v2`. */
export const OG_IMAGE_TEMPLATE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/**
 * One image a page shares on social networks, as `pageHead({ openGraph: { image } })`
 * takes it. Only `url` is required; the generated images always fill in the
 * size and the type.
 */
export interface OgImageDescriptor {
  /** The image's description for people who cannot see it: `og:image:alt`. */
  alt?: string;
  /** Pixels: `og:image:height`. */
  height?: number;
  /** `og:image:type`, e.g. `image/png`. */
  type?: string;
  /**
   * Absolute (`https://...`) or root-relative (`/api/...`). A relative URL is
   * resolved against the public site origin (`VITNODE_WEB_URL`), because
   * crawlers ignore relative image URLs.
   */
  url: string;
  /** Pixels: `og:image:width`. */
  width?: number;
}

/** A registered template as the AdminCP sees it: no renderer, nothing executable. */
export interface OgImageTemplateSummary {
  id: string;
  /** Whether it is the configured `defaultTemplate`. */
  isDefault: boolean;
  /** A display name, when the template declares one. */
  label: null | string;
  version: string;
}

/** Whether `value` is a template id the generator would accept. */
export const isOgImageTemplateId = (value: unknown): value is string =>
  typeof value === "string" && OG_IMAGE_TEMPLATE_ID_PATTERN.test(value);
