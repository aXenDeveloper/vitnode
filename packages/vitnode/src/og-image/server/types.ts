import type { ReactElement } from "react";
import type { SatoriOptions } from "satori";

/** Raw bytes, or a function that loads them once, on first use. */
export type OgImageBinarySource =
  | (() => Promise<ArrayBuffer | Uint8Array>)
  | ArrayBuffer
  | Uint8Array;

/**
 * One font face the renderer may use. TTF, OTF and WOFF work; WOFF2 and
 * variable fonts do not.
 *
 * Satori uses one face per `name` and `weight`, so split subsets go under
 * their own names - `Inter` and `Inter Latin Ext` - and the template lists both
 * in `fontFamily`.
 */
export interface OgImageFont {
  data: OgImageBinarySource;
  name: string;
  style?: "italic" | "normal";
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
}

/** An image ready to drop into a template's `<img src>`: always a `data:` URI. */
export interface OgImageTemplateAsset {
  /** The alt text an author gave the image, when there is one. */
  alt: null | string;
  height: number;
  src: string;
  width: number;
}

/** Colors and the font stack the built-in template paints with. */
export interface OgImageTheme {
  /** Accent bar and the site name. Defaults to `#3b82f6`. */
  accentColor: string;
  /** Defaults to `#0b1220`. */
  backgroundColor: string;
  /** The CSS `fontFamily` for every text node. Defaults to the bundled Inter. */
  fontFamily: string;
  /** Title color. Defaults to `#f8fafc`. */
  foregroundColor: string;
  /** Description and footer color. Defaults to `#94a3b8`. */
  mutedColor: string;
}

/**
 * What every template receives. Built on the server from trusted data -
 * a Content Engine record, a plugin's own page, or the AdminCP preview form -
 * after length limits and asset checks ran.
 */
export interface OgImageTemplateInput {
  /** Pixels; a cover in this size fills the card without cropping. */
  cover: null | OgImageTemplateAsset;
  /** Plain text, already trimmed. `null` when the page has none. */
  description: null | string;
  height: number;
  /** The language the content is in, e.g. `pl`. Set `lang` from it. */
  locale: string;
  logo: null | OgImageTemplateAsset;
  siteName: string;
  theme: OgImageTheme;
  /** Plain text, already trimmed and never empty. */
  title: string;
  /** The page's canonical URL, when the caller knows it. */
  url: null | string;
  width: number;
}

/**
 * A template renders one card as JSX with inline `style` objects. Only the
 * flexbox subset of CSS that Satori supports works: no `className`, no
 * Tailwind, no grid, no app components and no hooks. Every `<div>` with more
 * than one child needs `display: "flex"`.
 */
export type OgImageTemplateRender = (
  input: OgImageTemplateInput,
) => Promise<ReactElement> | ReactElement;

/** One entry of `ogImages.templates`. */
export interface OgImageTemplate {
  /** Shown in AdminCP → SEO → OG Images. Defaults to the template id. */
  label?: string;
  render: OgImageTemplateRender;
  /**
   * Part of every cached image's identity. Bump it whenever the template's
   * output changes, and cached images are rendered again on their next request.
   */
  version: string;
}

/** Default names and pictures, used where the page does not bring its own. */
export interface OgImageBranding {
  /**
   * The logo in the card's corner: bytes, a loader, or an `https` URL fetched
   * once with the same limits as any remote image. PNG, JPEG, WebP or SVG.
   */
  logo?: OgImageBinarySource | string;
  /** Defaults to the API config's `metadata.shortTitle ?? metadata.title`. */
  siteName?: string;
}

/**
 * Open Graph image settings, `buildApiConfig({ ogImages })`. Present means on:
 * `ogImages: {}` serves the built-in template with the bundled fonts.
 *
 * Server-only. Everything here stays in the API process; the AdminCP only ever
 * receives template ids, labels and versions.
 */
export interface OgImagesConfig {
  /** Default branding. See {@link OgImageBranding}. */
  branding?: OgImageBranding;
  /** The template used when nothing names one. Defaults to `"default"`. */
  defaultTemplate?: string;
  /**
   * Replaces the bundled fonts (Inter regular and bold, Latin and Latin
   * Extended - Polish included). Set `theme.fontFamily` to match.
   */
  fonts?: OgImageFont[];
  /**
   * Supplies characters the fonts lack, called by Satori while rendering:
   * return an SVG `data:` URI when `languageCode` is `"emoji"`, or extra fonts
   * for a script such as `"ja-JP"`. Unset, rendering never touches the
   * network and a missing character is drawn as a "no glyph" box. Bump
   * `version` after changing it.
   */
  loadAdditionalAsset?: SatoriOptions["loadAdditionalAsset"];
  /**
   * Templates by id (`a-z`, `0-9`, `-`, `_`). Defaults to
   * `{ default: defaultOgImageTemplate }`; when set, it is the whole list, so
   * include the built-in one if you still want it.
   */
  templates?: Record<string, OgImageTemplate>;
  /** Colors and font stack handed to every template. */
  theme?: Partial<OgImageTheme>;
  /**
   * Part of every cached image's identity. Bump it after changing a font file
   * or a logo that keeps its URL, and every image is rendered again.
   */
  version?: string;
}
