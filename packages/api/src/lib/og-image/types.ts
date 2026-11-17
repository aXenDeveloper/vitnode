import type { ReactElement } from "react";

/** What a social card is drawn for. */
export type OgImageKind = "content" | "profile" | "site";

/** The colours and font family the default template draws with. */
export interface OgImageTheme {
  /** Highlight colour: the dot before the site name and the bar at the bottom. */
  accent: string;
  background: string;
  /** The CSS font stack. Its first family must be one of the registered fonts. */
  fontFamily: string;
  foreground: string;
  /** Secondary text: the description and the domain. */
  muted: string;
}

/** The site's logo, ready for an `<img>`: a data URI and the size to draw it at. */
export interface OgImageTemplateLogo {
  /** Pixels on the 1200 × 630 card. */
  height: number;
  /** A `data:` URI - nothing is fetched while drawing. SVG `currentColor` is `theme.foreground`. */
  src: string;
  /**
   * The original SVG markup, or `null` for a raster logo. A template that
   * draws the logo on another background recolors it with `ogImageLogoSrc`.
   */
  svg: null | string;
  /** Pixels on the 1200 × 630 card, from the logo's own aspect ratio. */
  width: number;
  /** `true` when the logo already spells the site name, so a template drops the name beside it. */
  wordmark: boolean;
}

/** A picture behind the card: a record's cover or a member's profile cover. */
export interface OgImageTemplateImage {
  /** A `data:` URI with the image's bytes, read from storage - nothing is fetched while drawing. */
  src: string;
}

/** What a template is given to draw one card. */
export interface OgImageTemplateProps {
  /** A profile card's member initial and avatar colour. */
  avatar?: { color: string; initial: string };
  /** The content type the card is for, e.g. `blog.post`. Content cards only. */
  contentTypeId?: string;
  /** Plain text, already trimmed. `null` when the page has none. */
  description: null | string;
  /** The web app's host, e.g. `community.example.com`. */
  domain: string;
  /**
   * The record's `imageField` cover, or the member's profile cover, when there
   * is a public one. The built-in card draws it blurred behind the quote.
   */
  image?: OgImageTemplateImage;
  kind: OgImageKind;
  /** The language the text is in, or `null` when it has none. */
  locale: null | string;
  /** The site's logo from `ogImage.logo`, or `undefined` when none is set. */
  logo?: OgImageTemplateLogo;
  /** The plugin that owns the content type. Content cards only. */
  pluginId?: string;
  /** The site's title from the API config's `metadata`. */
  siteName: string;
  theme: OgImageTheme;
  /** Plain text. Never empty: falls back to the site name. */
  title: string;
}

/**
 * Draws one 1200 × 630 social card. Called as a plain function (never mounted
 * by React), so it must not use hooks or context.
 *
 * Takumi lays the tree out: every element that has more than one child needs
 * `display: "flex"` (or `grid`), and only inline `style` objects and `tw`
 * classes apply - no class names from the app's CSS.
 */
export type OgImageTemplate = (props: OgImageTemplateProps) => ReactElement;

/** A font the renderer may draw with. Load it once, at startup. */
export interface OgImageFont {
  /** The raw TTF, OTF, WOFF or WOFF2 bytes. */
  data: ArrayBuffer | Uint8Array;
  /** The family name templates refer to in `fontFamily`. */
  name: string;
  style?: "italic" | "normal";
  /** `400` for regular, `700` for bold. Defaults to the file's own weight. */
  weight?: number;
}

/** What every logo shape shares. */
interface OgImageLogoBase {
  /** Pixels on the 1200 × 630 card. The width follows the logo's aspect ratio. Defaults to `56`. */
  height?: number;
  /**
   * `true` when the logo already spells the site name (a wordmark), so the
   * card does not repeat the name beside it. Defaults to `false`.
   */
  wordmark?: boolean;
}

/** A PNG, JPEG or WebP logo. */
export interface OgImageRasterLogo extends OgImageLogoBase {
  /** The image's own width and height in pixels, for its aspect ratio. */
  size: { height: number; width: number };
  /**
   * The image as a `data:` URI. Remote URLs are refused: the renderer never
   * fetches.
   */
  src: `data:image/${string}`;
}

/** An SVG logo - preferred, it stays sharp at any size. */
export interface OgImageSvgLogo extends OgImageLogoBase {
  /**
   * SVG markup with a `viewBox`. `currentColor` is drawn in
   * `theme.foreground`, so a logo with dark text stays readable on a dark
   * card.
   */
  svg: string;
}

/**
 * The site's logo on every card. SVG markup is preferred: it stays sharp at
 * any size and is drawn without a network request.
 *
 * @example
 * ```ts
 * import { VITNODE_LOGO_SVG } from "@vitnode/api/lib/og-image/vitnode-logo";
 *
 * ogImage: { logo: { svg: VITNODE_LOGO_SVG, wordmark: true } }
 * ```
 */
export type OgImageLogoConfig = OgImageRasterLogo | OgImageSvgLogo;

/**
 * Generated social cards (`og:image`), set as `ogImage` in `buildApiConfig`.
 * Every property is optional; the defaults draw a dark card with Geist.
 */
export interface OgImageConfig {
  /**
   * Draw cards at all. Defaults to `true`. `false` makes every card route
   * answer `404` and leaves generated images out of the delivery metadata;
   * set `metadata.ogImage: false` on the web config as well.
   */
  enabled?: boolean;
  /**
   * Extra fonts, registered next to the built-in Geist (Latin, Latin
   * Extended, Cyrillic). Add one for scripts Geist lacks (Greek, Arabic, CJK)
   * and put its family first in `theme.fontFamily`. Never fetched: pass the
   * bytes.
   */
  fonts?: OgImageFont[];
  /** The site's logo, shown on every card. Without one, cards show the site name only. */
  logo?: OgImageLogoConfig;
  /** The template for every card a more specific one does not cover. */
  template?: OgImageTemplate;
  /**
   * Templates per content type id (`blog.post`), overriding the ones plugins
   * register with `buildApiPlugin({ ogImageTemplates })`.
   */
  templates?: Readonly<Record<string, OgImageTemplate>>;
  /** Colours and font family for the default template, merged over the defaults. */
  theme?: Partial<OgImageTheme>;
  /**
   * Part of every card's URL version. Change it after editing a template or
   * the theme so crawlers and CDNs fetch the new cards instead of the cached
   * ones.
   */
  version?: string;
}

/** {@link OgImageConfig} with its defaults applied, as `c.get("core").ogImage`. */
export interface ResolvedOgImageConfig {
  enabled: boolean;
  fonts: OgImageFont[];
  logo: OgImageTemplateLogo | undefined;
  template: OgImageTemplate;
  /** Content type id to template: plugins' first, the app's `templates` over them. */
  templates: ReadonlyMap<string, OgImageTemplate>;
  theme: OgImageTheme;
  version: string;
}
