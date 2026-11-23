import type { Context } from "hono";

import type {
  OgImageConfig,
  OgImageFont,
  OgImageLogoConfig,
  OgImageTemplate,
  OgImageTemplateLogo,
  OgImageTemplateProps,
  OgImageTheme,
  ResolvedOgImageConfig,
} from "./og-image/types";

import { fingerprint } from "../content/hash";
import { CONFIG } from "./config";
import {
  GEIST_BOLD_WOFF2,
  GEIST_REGULAR_WOFF2,
} from "./og-image/geist-fonts.gen";
import { DefaultOgImageTemplate } from "./og-image/template";

export { DefaultOgImageTemplate } from "./og-image/template";
export type {
  OgImageConfig,
  OgImageFont,
  OgImageKind,
  OgImageLayout,
  OgImageLogoConfig,
  OgImageRasterLogo,
  OgImageSvgLogo,
  OgImageTemplate,
  OgImageTemplateLogo,
  OgImageTemplateProps,
  OgImageTheme,
  ResolvedOgImageConfig,
} from "./og-image/types";

/** The size every card is drawn at: the 1.91:1 ratio Open Graph and X expect. */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_TYPE = "image/png";

/** The family the built-in Geist is registered under. Not "Geist": Takumi bundles a Latin-only Geist under that name. */
export const OG_IMAGE_DEFAULT_FONT_FAMILY = "VitNode Sans";

const DEFAULT_THEME: OgImageTheme = {
  accent: "#3368d0",
  background: "#0c0e12",
  fontFamily: OG_IMAGE_DEFAULT_FONT_FAMILY,
  foreground: "#f7f7f7",
  muted: "#aaaeb6",
};

/**
 * Image types every major link preview (Facebook, LinkedIn, X, Slack,
 * Discord) shows as `og:image`; SVG, AVIF and HEIC are not among them.
 */
export const OG_IMAGE_COVER_TYPES: ReadonlySet<string> = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const DEFAULT_TEMPLATE_REVISION = "3";

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const SHORT_CACHE = "public, max-age=3600, s-maxage=3600";

const decodeBase64 = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

let builtInFonts: OgImageFont[] | undefined;

const defaultFonts = (): OgImageFont[] =>
  (builtInFonts ??= [
    {
      data: decodeBase64(GEIST_REGULAR_WOFF2),
      name: OG_IMAGE_DEFAULT_FONT_FAMILY,
      style: "normal",
      weight: 400,
    },
    {
      data: decodeBase64(GEIST_BOLD_WOFF2),
      name: OG_IMAGE_DEFAULT_FONT_FAMILY,
      style: "normal",
      weight: 700,
    },
  ]);

const DEFAULT_LOGO_HEIGHT = 56;
const MAX_LOGO_HEIGHT = 160;
const MAX_LOGO_WIDTH = 720;

const encodeBase64 = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return btoa(binary);
};

const svgSize = (svg: string): null | { height: number; width: number } => {
  const root = /<svg\b[^>]*>/i.exec(svg)?.[0];
  if (!root) return null;

  const viewBox = /\bviewBox\s*=\s*["']([^"']+)["']/i.exec(root)?.[1];
  const box = viewBox
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (box?.length === 4 && box[2] > 0 && box[3] > 0) {
    return { height: box[3], width: box[2] };
  }

  const width = Number(/\bwidth\s*=\s*["']([\d.]+)/i.exec(root)?.[1]);
  const height = Number(/\bheight\s*=\s*["']([\d.]+)/i.exec(root)?.[1]);

  return width > 0 && height > 0 ? { height, width } : null;
};

/**
 * The logo's `data:` URI with SVG `currentColor` drawn in `color`, for a
 * template that places the logo on a surface other than `theme.background`.
 * A raster logo is returned as it is. Universal.
 *
 * @example
 * ```tsx
 * <img src={ogImageLogoSrc(logo, "#18181b")} width={logo.width} height={logo.height} />
 * ```
 */
export const ogImageLogoSrc = (
  logo: OgImageTemplateLogo,
  color: string,
): string =>
  logo.svg === null
    ? logo.src
    : `data:image/svg+xml;base64,${encodeBase64(
        logo.svg.replaceAll(/currentColor/gi, color),
      )}`;

/**
 * Turns `ogImage.logo` into what templates draw: a `data:` URI sized for the
 * card. SVG `currentColor` becomes `theme.foreground`.
 *
 * @throws When the SVG declares no size, the image is not a `data:` URI, or
 * the size is not positive.
 */
export const resolveOgImageLogo = (
  logo: OgImageLogoConfig | undefined,
  theme: OgImageTheme,
): OgImageTemplateLogo | undefined => {
  if (logo === undefined) return undefined;

  const height = Math.min(logo.height ?? DEFAULT_LOGO_HEIGHT, MAX_LOGO_HEIGHT);
  if (!(height > 0)) {
    throw new Error(
      "[VitNode] `ogImage.logo.height` must be a positive number.",
    );
  }

  let src: string;
  let svg: null | string = null;
  let size: null | { height: number; width: number };
  if ("svg" in logo) {
    ({ svg } = logo);
    size = svgSize(logo.svg);
    if (size === null) {
      throw new Error(
        "[VitNode] `ogImage.logo.svg` declares no size. Give the root <svg> a `viewBox` (or `width` and `height`) so the card can keep its aspect ratio.",
      );
    }
    src = `data:image/svg+xml;base64,${encodeBase64(
      logo.svg.replaceAll(/currentColor/gi, theme.foreground),
    )}`;
  } else {
    if (!logo.src.startsWith("data:image/")) {
      throw new Error(
        "[VitNode] `ogImage.logo.src` must be a `data:image/...` URI. Cards are drawn without network access, so a URL would never load.",
      );
    }
    size = logo.size;
    if (!(size.width > 0 && size.height > 0)) {
      throw new Error("[VitNode] `ogImage.logo.size` must be positive.");
    }
    src = logo.src;
  }

  const width = Math.min(
    Math.round((height * size.width) / size.height),
    MAX_LOGO_WIDTH,
  );

  return {
    height: Math.round((width * size.height) / size.width),
    src,
    svg,
    width,
    wordmark: logo.wordmark ?? false,
  };
};

/**
 * Applies the defaults to `buildApiConfig({ ogImage })` and merges the
 * plugins' per-content-type templates under the app's own.
 *
 * @throws When a template is registered for a content type no plugin defines.
 */
export const resolveOgImageConfig = ({
  config,
  contentTypeIds,
  pluginTemplates,
}: {
  config: OgImageConfig | undefined;
  contentTypeIds: ReadonlySet<string>;
  pluginTemplates: readonly {
    pluginId: string;
    templates: Readonly<Record<string, OgImageTemplate>> | undefined;
  }[];
}): ResolvedOgImageConfig => {
  const templates = new Map<string, OgImageTemplate>();
  const register = (
    source: string,
    entries: Readonly<Record<string, OgImageTemplate>> | undefined,
  ) => {
    for (const [contentTypeId, template] of Object.entries(entries ?? {})) {
      if (!contentTypeIds.has(contentTypeId)) {
        throw new Error(
          `[VitNode] ${source} registers a social card template for "${contentTypeId}", which is not a content type any plugin defines. Use the content type's id, e.g. "blog.post".`,
        );
      }
      templates.set(contentTypeId, template);
    }
  };

  for (const { pluginId, templates: entries } of pluginTemplates) {
    register(`Plugin "${pluginId}"`, entries);
  }
  register("`ogImage.templates` in the API config", config?.templates);

  const theme = { ...DEFAULT_THEME, ...config?.theme };
  const logo = resolveOgImageLogo(config?.logo, theme);

  return {
    enabled: config?.enabled ?? true,
    fonts: [...defaultFonts(), ...(config?.fonts ?? [])],
    logo,
    template: config?.template ?? DefaultOgImageTemplate,
    templates,
    theme,
    version: `${DEFAULT_TEMPLATE_REVISION}.${config?.version ?? "1"}${logo ? `.${fingerprint(logo.src)}` : ""}`,
  };
};

/**
 * A short, stable version of the inputs a card is drawn from, for the `v`
 * query parameter of its URL. Equal inputs give an equal version, so a card
 * URL only changes when its picture would.
 */
export const ogImageVersion = (c: Context, parts: readonly unknown[]): string =>
  fingerprint(
    JSON.stringify([
      c.get("core").ogImage.version,
      c.get("core").metadata.title,
      ...parts,
    ]),
  );

/**
 * The absolute URL of a route of the API, e.g.
 * `ogImageApiUrl("/@vitnode/core/og/site")`. The API is served under `/api`.
 */
export const ogImageApiUrl = (
  path: string,
  query: Readonly<Record<string, null | string | undefined>> = {},
): string => {
  const url = new URL(`/api${path}`, CONFIG.api.origin);
  for (const [key, value] of Object.entries(query)) {
    if (value) url.searchParams.set(key, value);
  }

  return url.href;
};

/** The base props every card shares: the site name, logo, domain and theme. */
export const ogImageBaseProps = (
  c: Context,
): Pick<OgImageTemplateProps, "domain" | "logo" | "siteName" | "theme"> => ({
  domain: CONFIG.web.host,
  logo: c.get("core").ogImage.logo,
  siteName: c.get("core").metadata.title,
  theme: c.get("core").ogImage.theme,
});

/**
 * Draws one card as PNG bytes with Takumi, on whichever backend its package
 * resolves for the build (WebAssembly in VitNode's Nitro builds, Node.js and
 * Cloudflare Workers alike). Server-only. Never touches the network: fonts
 * come from the config and emoji are drawn from the fonts.
 *
 * @throws When the renderer cannot be loaded or the template throws.
 */
export const renderOgImage = async (
  c: Context,
  props: OgImageTemplateProps,
  template: OgImageTemplate = c.get("core").ogImage.template,
): Promise<Uint8Array> => {
  const { render } = await import("takumi-js");
  return await render(template(props), {
    emoji: "from-font",
    fonts: c.get("core").ogImage.fonts,
    format: "png",
    height: OG_IMAGE_HEIGHT,
    width: OG_IMAGE_WIDTH,
  });
};

/**
 * A route's answer with one drawn card: `200` with the PNG, cached for a year
 * when the request's `v` matches `version` and for an hour otherwise, or
 * `503` when the renderer fails (logged). Server-only.
 *
 * Draw only what anyone may see - the route must have checked that the record
 * or profile is public before calling this.
 *
 * @example
 * ```ts
 * import { ogImageResponse, ogImageBaseProps, ogImageVersion } from "@vitnode/api/lib/og-image";
 *
 * handler: async c => {
 *   const title = "Spring meetup";
 *   const props = { ...ogImageBaseProps(c), description: null, kind: "content", locale: null, title } as const;
 *
 *   return await ogImageResponse(c, props, { version: ogImageVersion(c, [title]) });
 * },
 * ```
 */
export const ogImageResponse = async (
  c: Context,
  props: OgImageTemplateProps,
  {
    template,
    version,
  }: {
    template?: OgImageTemplate;
    /** The version the current URL carries; omit for a card with no versioned URL. */
    version?: string;
  } = {},
): Promise<Response> => {
  let png: Uint8Array;
  try {
    png = await renderOgImage(c, props, template);
  } catch (error) {
    await c
      .get("log")
      .error(
        `Social card for "${props.title}" could not be drawn: ${error instanceof Error ? error.message : String(error)}`,
      );

    return c.json({ error: "Social card unavailable" }, 503, {
      "Cache-Control": "no-store",
      "Retry-After": "60",
    });
  }

  const matches = version !== undefined && c.req.query("v") === version;

  return c.body(png as Uint8Array<ArrayBuffer>, 200, {
    "Cache-Control": matches ? IMMUTABLE_CACHE : SHORT_CACHE,
    "Content-Type": OG_IMAGE_TYPE,
    "X-Content-Type-Options": "nosniff",
  });
};
