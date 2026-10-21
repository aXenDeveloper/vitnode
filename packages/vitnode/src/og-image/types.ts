import type { ReactElement } from "react";

/** Open Graph images are always rendered at this width, in pixels. */
export const OG_IMAGE_WIDTH = 1200;
/** Open Graph images are always rendered at this height, in pixels. */
export const OG_IMAGE_HEIGHT = 630;
/** The MIME type of every rendered Open Graph image. */
export const OG_IMAGE_TYPE = "image/png";

/** Longest title a template receives, in characters; longer ones end with `…`. */
export const OG_IMAGE_TITLE_MAX_LENGTH = 140;
/** Longest description a template receives, in characters; longer ones end with `…`. */
export const OG_IMAGE_DESCRIPTION_MAX_LENGTH = 220;

/** The id the built-in template is registered under. */
export const OG_IMAGE_DEFAULT_TEMPLATE_ID = "default";

/** An image a template can draw with `<img src={image.src} />`. */
export interface OgImageAsset {
  height: number;
  /** A `data:` URI, so rendering never waits on the network. */
  src: string;
  width: number;
}

/** Colors the built-in template reads. Custom templates may ignore them. */
export interface OgImageColors {
  /** Accent bar and site-name color. Defaults to `#3261bf`. */
  accent: string;
  /** Background behind the text. Defaults to `#ffffff`. */
  background: string;
  /** Title color. Defaults to `#0f172a`. */
  foreground: string;
  /** Description and footer color. Defaults to `#475569`. */
  muted: string;
}

/**
 * What every template receives. Built by the generator from trusted data -
 * a Content Engine record, a plugin's own query, or AdminCP preview input -
 * already trimmed and cut to {@link OG_IMAGE_TITLE_MAX_LENGTH} and
 * {@link OG_IMAGE_DESCRIPTION_MAX_LENGTH}.
 */
export interface OgImageTemplateInput {
  colors: OgImageColors;
  /** Cover image, already resized and converted to a format the renderer reads. */
  cover: null | OgImageAsset;
  description: null | string;
  /** The language the text is in, e.g. `pl`. */
  locale: string;
  /** Site logo from `ogImages.branding.logo`. */
  logo: null | OgImageAsset;
  /** Site name from `ogImages.branding.siteName`, else the API config's `metadata`. */
  siteName: string;
  title: string;
  /** The canonical URL of the page the image belongs to, when known. */
  url: null | string;
}

/**
 * One Open Graph template: a function from {@link OgImageTemplateInput} to JSX
 * that `@vercel/og` (Satori) can draw.
 *
 * Satori is not a browser. Style with inline `style` objects only, give every
 * element with more than one child `display: "flex"`, and do not use Tailwind
 * classes or UI components - they do not render. See
 * https://github.com/vercel/satori#css for the supported CSS.
 */
export interface OgImageTemplate {
  /**
   * Draws the 1200 × 630 image. Must be pure: same input, same image. Runs on
   * the server only.
   */
  render: (input: OgImageTemplateInput) => ReactElement;
  /**
   * Bump it whenever the template draws something differently - every image
   * cached for the old version is regenerated on its next request.
   */
  version: string;
}

/**
 * A font Satori can draw with. TTF, OTF and WOFF only - not WOFF2.
 * Satori never synthesizes bold or italic, so register each weight you use.
 */
export interface OgImageFont {
  /**
   * The font bytes, or a function returning them. A function is called once per
   * process and its result reused for every image.
   */
  data:
    | (() => ArrayBuffer | Promise<ArrayBuffer | Uint8Array> | Uint8Array)
    | ArrayBuffer
    | Uint8Array;
  /** The family name templates use in `fontFamily`. */
  name: string;
  style?: "italic" | "normal";
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
}

/** Branding the built-in template shows when the site has nothing better. */
export interface OgImageBranding {
  /** Partial overrides of the built-in template's colors. */
  colors?: Partial<OgImageColors>;
  /**
   * The logo: an `https://` URL (downloaded once, at most 5 MB, with an
   * 8-second timeout), a `data:` URI, or a function returning the bytes (for
   * example `readFile("public/logo.png")`). PNG, JPEG, WebP and SVG. Leave it
   * out to draw no logo.
   */
  logo?: (() => Promise<Uint8Array> | Uint8Array) | string;
  /** The name in the image footer. Defaults to the API config's `metadata.shortTitle ?? metadata.title`. */
  siteName?: string;
}

/**
 * The `ogImages` block of `vitnode.api.config.ts`: generated Open Graph
 * images. Setting it turns the generator on; Content Engine types then opt in
 * with `delivery.seo.ogImage`. The AdminCP only previews what is set here.
 *
 * @example
 * ```ts
 * import { buildApiConfig } from "@vitnode/core/vitnode.config";
 *
 * import { articleOgTemplate } from "./og/article-template";
 *
 * export const vitNodeApiConfig = buildApiConfig({
 *   // ...
 *   ogImages: {
 *     defaultTemplate: "article",
 *     templates: { article: articleOgTemplate },
 *     branding: { siteName: "My community" },
 *   },
 * });
 * ```
 */
export interface OgImagesConfig {
  /** Branding the built-in template shows. */
  branding?: OgImageBranding;
  /**
   * The template used when a caller names none. Must be a key of `templates`
   * or `"default"` (the built-in one). Defaults to `"default"`.
   */
  defaultTemplate?: string;
  /**
   * Extra fonts, tried before the bundled Geist Regular, which covers Latin
   * and Latin Extended (Polish included). Characters no font covers are
   * fetched by `@vercel/og` from Google Fonts at render time.
   */
  fonts?: OgImageFont[];
  /**
   * Your templates by id. Ids are 1-64 characters of `a-z`, `0-9`, `-` and
   * `_`. `default` is the built-in template unless you register your own under
   * that id.
   */
  templates?: Record<string, OgImageTemplate>;
  /**
   * Bump it after changing `branding` or `fonts`, so every cached image is
   * regenerated. Template changes use the template's own `version`.
   */
  version?: string;
}

/**
 * Declares an Open Graph template. Returns it unchanged - the helper only
 * types it. Keep templates in their own `.tsx` files and import them into
 * `vitnode.api.config.ts`.
 *
 * @example
 * ```tsx
 * // src/og/article-template.tsx
 * import { defineOgImageTemplate } from "@vitnode/core/og-image";
 *
 * export const articleOgTemplate = defineOgImageTemplate({
 *   version: "1",
 *   render: ({ title, siteName, colors }) => (
 *     <div
 *       style={{
 *         display: "flex",
 *         flexDirection: "column",
 *         justifyContent: "space-between",
 *         width: "100%",
 *         height: "100%",
 *         padding: 72,
 *         background: colors.background,
 *         color: colors.foreground,
 *       }}
 *     >
 *       <div style={{ fontSize: 72, lineHeight: 1.1 }}>{title}</div>
 *       <div style={{ fontSize: 32, color: colors.accent }}>{siteName}</div>
 *     </div>
 *   ),
 * });
 * ```
 */
export const defineOgImageTemplate = (
  template: OgImageTemplate,
): OgImageTemplate => template;
