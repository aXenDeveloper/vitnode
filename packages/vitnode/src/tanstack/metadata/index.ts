import type { VitNodeMetadata } from "@/lib/metadata";

import { CONFIG } from "@/lib/config";
import { formatPageTitle } from "@/lib/metadata";
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_TYPE,
  OG_IMAGE_WIDTH,
} from "@/og-image/types";
import { getVitNodeConfig } from "@/vitnode.config";

import type { LocaleAlternates, RouteHeadLink } from "./alternates";

import { localeAlternateLinks } from "./alternates";

export type {
  LocaleAlternateLinksOptions,
  LocaleAlternates,
  RouteHeadLink,
} from "./alternates";
export {
  declaredLocaleAlternates,
  localeAlternateLinks,
  X_DEFAULT_HREFLANG,
} from "./alternates";

/** What a crawler may do with a page. */
export type RouteRobots =
  | "index, follow"
  | "noindex, follow"
  | "noindex, nofollow";

/** What kind of thing a page is, to a social card. */
export type RouteOpenGraphType = "article" | "website";

/**
 * The image a social card shows. Emits `og:image` (plus its width, height, alt
 * and type when given) and the `twitter:card` / `twitter:image` pair.
 */
export interface RouteOpenGraphImage {
  /** `og:image:alt` and `twitter:image:alt`: what the image shows, for screen readers. */
  alt?: string;
  height?: number;
  /** `og:image:type`, e.g. `image/png`. */
  type?: string;
  /**
   * Absolute, or a root-relative path (`/api/...`) resolved against the public
   * site origin (`VITNODE_WEB_URL`). Crawlers ignore relative image URLs, so a
   * path is always turned into an absolute URL; anything else that is not
   * `http(s)` emits nothing.
   */
  url: string;
  width?: number;
}

export interface RouteOpenGraph {
  /** The `<meta property="og:description">`. */
  description?: string;
  /** The social card image; see {@link RouteOpenGraphImage}. */
  image?: RouteOpenGraphImage;

  /** The `<meta property="og:title">`, used as is - no site-name suffix. */
  title?: string;
  /** `article` for a document, `website` for a landing page. */
  type?: RouteOpenGraphType;
}

/** What a page puts in its `<head>`. Every field is optional and emits nothing when unset. */
export interface RouteHeadOptions {
  /**
   * The page's internal path per locale. With `locale`, emits the canonical
   * link and `hreflang` alternates (see `localeAlternateLinks`).
   */
  alternates?: LocaleAlternates;
  /** The `<meta name="description">`, when the page has one. */
  description?: string;

  /** The locale being rendered; required for `alternates` to emit anything. */
  locale?: string;

  openGraph?: RouteOpenGraph;

  /** The `<meta name="robots">`. A deeper route's value replaces its parent's. */
  robots?: RouteRobots;
  /** The page's own title, already translated. The site name is appended (`Title - Site`). */
  title?: string;
}

export type RouteHeadMeta =
  | { content: string; name: string }
  | { content: string; property: string }
  | { title: string };

/** A TanStack Router `head` return value. */
export interface RouteHeadResult {
  links?: RouteHeadLink[];
  meta: RouteHeadMeta[];
}

/**
 * An {@link RouteOpenGraphImage} for a VitNode-generated image: 1200 × 630
 * PNG at `url`. Universal.
 *
 * @example
 * ```ts
 * import { generatedOgImage, pageHead } from "@vitnode/core/tanstack/metadata";
 *
 * head: ({ loaderData }) =>
 *   pageHead({
 *     title: loaderData?.name,
 *     openGraph: {
 *       image: generatedOgImage({
 *         url: `/api/@acme/shop/products/${loaderData?.id}/og-image`,
 *         alt: loaderData?.name,
 *       }),
 *     },
 *   }),
 * ```
 */
export const generatedOgImage = ({
  alt,
  url,
}: {
  alt?: string;
  url: string;
}): RouteOpenGraphImage => ({
  ...(alt ? { alt } : {}),
  height: OG_IMAGE_HEIGHT,
  type: OG_IMAGE_TYPE,
  url,
  width: OG_IMAGE_WIDTH,
});

/**
 * `url` as an absolute `http(s)` URL: kept when already absolute, resolved
 * against `origin` when it is a root-relative path, `undefined` otherwise.
 */
export const absoluteImageUrl = (
  url: string,
  origin: string | URL = CONFIG.web,
): string | undefined => {
  try {
    const resolved = /^\/(?![/\\])/.test(url)
      ? new URL(url, origin)
      : new URL(url);

    return resolved.protocol === "https:" || resolved.protocol === "http:"
      ? resolved.href
      : undefined;
  } catch {
    return undefined;
  }
};

const positiveInteger = (value: number | undefined): number | undefined =>
  typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;

const imageMeta = (image: RouteOpenGraphImage | undefined): RouteHeadMeta[] => {
  if (!image) return [];

  const url = absoluteImageUrl(image.url);
  if (url === undefined) return [];

  const width = positiveInteger(image.width);
  const height = positiveInteger(image.height);
  const alt = image.alt?.trim();

  return [
    { content: url, property: "og:image" },
    ...(width ? [{ content: String(width), property: "og:image:width" }] : []),
    ...(height
      ? [{ content: String(height), property: "og:image:height" }]
      : []),
    ...(image.type ? [{ content: image.type, property: "og:image:type" }] : []),
    ...(alt ? [{ content: alt, property: "og:image:alt" }] : []),
    { content: "summary_large_image", name: "twitter:card" },
    { content: url, name: "twitter:image" },
    ...(alt ? [{ content: alt, name: "twitter:image:alt" }] : []),
  ];
};

const alternateLinksOf = (
  alternates: LocaleAlternates | undefined,
  locale: string | undefined,
): RouteHeadLink[] =>
  alternates && locale ? localeAlternateLinks({ alternates, locale }) : [];

const routeMeta = (
  metadata: VitNodeMetadata,
  {
    description,
    openGraph,
    robots,
    title,
  }: Pick<RouteHeadOptions, "description" | "openGraph" | "robots" | "title">,
): RouteHeadMeta[] => [
  ...(robots ? [{ content: robots, name: "robots" }] : []),
  ...(title ? [{ title: formatPageTitle(metadata, title) }] : []),
  ...(description ? [{ content: description, name: "description" }] : []),
  /*
   * Open Graph is `property`, not `name`, and that is not cosmetic: it is what
   * the specification uses and what every crawler looks for. TanStack Router
   * dedupes a meta tag by `name ?? property` and prefers the deepest matched
   * route, so a child overriding one of these works exactly as it does for
   * `robots` - see `buildTagsFromMatches` in `@tanstack/react-router`.
   */
  ...(openGraph?.title
    ? [{ content: openGraph.title, property: "og:title" }]
    : []),
  ...(openGraph?.description
    ? [{ content: openGraph.description, property: "og:description" }]
    : []),
  ...(openGraph?.type
    ? [{ content: openGraph.type, property: "og:type" }]
    : []),
  ...imageMeta(openGraph?.image),
];

/** {@link pageHead} with explicit site metadata, for code that runs before the config is registered. */
export const routeHead = (
  metadata: VitNodeMetadata,
  {
    alternates,
    description,
    locale,
    openGraph,
    robots,
    title,
  }: RouteHeadOptions = {},
): RouteHeadResult => {
  const links = alternateLinksOf(alternates, locale);

  return {
    ...(links.length > 0 ? { links } : {}),
    meta: routeMeta(metadata, { description, openGraph, robots, title }),
  };
};

/** Binds {@link routeHead} to one site's metadata. */
export const createRouteHead =
  (metadata: VitNodeMetadata) =>
  (options: RouteHeadOptions = {}) =>
    routeHead(metadata, options);

/**
 * A route's `head` from translated page data: title (suffixed with the site
 * name from `buildConfig({ metadata })`), description, robots, Open Graph and
 * locale alternates. `openGraph.image` adds `og:image` (with its size, type and
 * alt) plus `twitter:card` `summary_large_image` and `twitter:image`, resolving
 * a root-relative URL against `VITNODE_WEB_URL`; without it no image tag is
 * emitted. Universal; use it in a route's `head`, written after `loader` so
 * `loaderData` is typed.
 *
 * @throws When the VitNode config has not been registered with `buildConfig`.
 *
 * @example
 * ```ts
 * import { pageHead } from "@vitnode/core/tanstack/metadata";
 *
 * head: ({ loaderData }) =>
 *   pageHead({
 *     title: loaderData?.title,
 *     description: loaderData?.description,
 *     robots: loaderData ? "index, follow" : "noindex, nofollow",
 *   }),
 * ```
 */
export const pageHead = (options: RouteHeadOptions = {}): RouteHeadResult =>
  routeHead(getVitNodeConfig().metadata, options);
