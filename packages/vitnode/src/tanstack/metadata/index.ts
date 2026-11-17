import type { VitNodeMetadata } from "@vitnode/api/lib/metadata";

import { CONFIG } from "@vitnode/api/lib/config";
import { formatPageTitle } from "@vitnode/api/lib/metadata";

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
export type RouteOpenGraphType = "article" | "profile" | "website";

/** A page's `og:image`. */
export interface RouteOpenGraphImage {
  /** The `og:image:alt`: what the image shows. */
  alt?: null | string;
  /** Pixels. Emitted only when known. */
  height?: null | number;
  /** The MIME type, e.g. `image/png`. */
  type?: null | string;
  /** An absolute `http(s)` URL, or a path on the web app's origin. */
  url: string;
  /** Pixels. Emitted only when known. */
  width?: null | number;
}

export interface RouteOpenGraph {
  /** The `<meta property="og:description">`. Defaults to the page's `description`. */
  description?: string;
  /**
   * The `og:image`. Defaults to the site's image (`metadata.ogImage` in the
   * VitNode config): the API's generated site card unless set otherwise.
   */
  image?: RouteOpenGraphImage;
  /** The `<meta property="og:title">`, used as is - no site-name suffix. Defaults to the page's `title`. */
  title?: string;
  /** `article` for a document, `profile` for a member, `website` (the default) for anything else. */
  type?: RouteOpenGraphType;
}

/**
 * What a page puts in its `<head>`. Every field is optional. A page with a
 * `title` (or `openGraph.title`) also gets Open Graph and X card tags (`og:title`,
 * `og:image`, `twitter:card`...), filled from its title, description, locale
 * and canonical URL, with the site's image when it sets none.
 */
export interface RouteHeadOptions {
  /**
   * The page's internal path per locale. With `locale`, emits the canonical
   * link and `hreflang` alternates (see `localeAlternateLinks`).
   */
  alternates?: LocaleAlternates;
  /**
   * The page's canonical URL, absolute or a path on the web app's origin, for
   * a page without `alternates` (those emit their own canonical link).
   */
  canonical?: string;
  /** The `<meta name="description">`, when the page has one. */
  description?: string;

  /**
   * The locale being rendered: picks the canonical link of `alternates` and
   * becomes `og:locale`.
   */
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

const SITE_OG_IMAGE_PATH = "/api/@vitnode/core/og/site";

const absoluteUrl = (value: string, origin: () => URL): string | undefined => {
  try {
    const url = new URL(value, origin());

    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The image of pages that set none, from `metadata.ogImage`: the API's site
 * card by default, a URL of the app's choosing, or nothing for `false`.
 */
const siteImage = (
  metadata: VitNodeMetadata,
): RouteOpenGraphImage | undefined => {
  const { ogImage = "generated" } = metadata;
  if (ogImage === false) return undefined;

  if (ogImage === "generated") {
    const url = absoluteUrl(SITE_OG_IMAGE_PATH, () => CONFIG.api);

    return url === undefined
      ? undefined
      : {
          alt: metadata.title,
          height: 630,
          type: "image/png",
          url,
          width: 1200,
        };
  }

  const url = absoluteUrl(ogImage, () => CONFIG.web);

  return url === undefined ? undefined : { alt: metadata.title, url };
};

/** The page's own image, with a path made absolute on the web app's origin. */
const pageImage = (
  image: RouteOpenGraphImage,
): RouteOpenGraphImage | undefined => {
  const url = absoluteUrl(image.url, () => CONFIG.web);

  return url === undefined ? undefined : { ...image, url };
};

const nonEmpty = (value: string | undefined): string | undefined =>
  value === "" ? undefined : value;

/** `pl-PL` -> `pl_PL`, the form `og:locale` uses. */
const ogLocale = (locale: string): string => locale.replace("-", "_");

const property = (name: string, content: null | number | string | undefined) =>
  content === null || content === undefined || content === ""
    ? []
    : [{ content: String(content), property: name }];

/**
 * Open Graph and X (Twitter) card tags for a page with a title (its own or
 * `openGraph.title`). A layout route that sets only `robots` gets none, so it
 * never leaves an image behind for the page under it.
 */
const socialMeta = (
  metadata: VitNodeMetadata,
  {
    description,
    locale,
    openGraph,
    title,
    url,
  }: Pick<
    RouteHeadOptions,
    "description" | "locale" | "openGraph" | "title"
  > & {
    url?: string;
  },
): RouteHeadMeta[] => {
  // An empty string is a title nobody wrote: it counts as none.
  const ogTitle = nonEmpty(openGraph?.title) ?? nonEmpty(title);
  if (ogTitle === undefined) return [];

  const image =
    openGraph?.image === undefined
      ? siteImage(metadata)
      : pageImage(openGraph.image);

  return [
    ...property("og:title", ogTitle),
    ...property("og:description", openGraph?.description ?? description),
    ...property("og:type", openGraph?.type ?? "website"),
    ...property("og:site_name", metadata.title),
    ...property("og:url", url),
    ...property(
      "og:locale",
      locale === undefined ? undefined : ogLocale(locale),
    ),
    ...(image === undefined
      ? []
      : [
          ...property("og:image", image.url),
          ...property("og:image:type", image.type),
          ...property("og:image:width", image.width),
          ...property("og:image:height", image.height),
          ...property("og:image:alt", image.alt),
        ]),
    {
      content: image === undefined ? "summary" : "summary_large_image",
      name: "twitter:card",
    },
  ];
};

/** A TanStack Router `head` return value. */
export interface RouteHeadResult {
  links?: RouteHeadLink[];
  meta: RouteHeadMeta[];
}

const alternateLinksOf = (
  alternates: LocaleAlternates | undefined,
  locale: string | undefined,
): RouteHeadLink[] =>
  alternates && locale ? localeAlternateLinks({ alternates, locale }) : [];

const routeMeta = (
  metadata: VitNodeMetadata,
  {
    description,
    locale,
    openGraph,
    robots,
    title,
    url,
  }: Pick<
    RouteHeadOptions,
    "description" | "locale" | "openGraph" | "robots" | "title"
  > & { url?: string },
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
  ...socialMeta(metadata, { description, locale, openGraph, title, url }),
];

/** {@link pageHead} with explicit site metadata, for code that runs before the config is registered. */
export const routeHead = (
  metadata: VitNodeMetadata,
  {
    alternates,
    canonical,
    description,
    locale,
    openGraph,
    robots,
    title,
  }: RouteHeadOptions = {},
): RouteHeadResult => {
  const links = alternateLinksOf(alternates, locale);
  let url = links.find(link => link.rel === "canonical")?.href;
  if (url === undefined && canonical !== undefined) {
    url = absoluteUrl(canonical, () => CONFIG.web);
    if (url !== undefined) links.unshift({ href: url, rel: "canonical" });
  }

  return {
    ...(links.length > 0 ? { links } : {}),
    meta: routeMeta(metadata, {
      description,
      locale,
      openGraph,
      robots,
      title,
      url,
    }),
  };
};

/** Binds {@link routeHead} to one site's metadata. */
export const createRouteHead =
  (metadata: VitNodeMetadata) =>
  (options: RouteHeadOptions = {}) =>
    routeHead(metadata, options);

/**
 * A route's `head` from translated page data: title (suffixed with the site
 * name from `buildConfig({ metadata })`), description, robots, canonical
 * link, locale alternates, and Open Graph and X card tags with the page's
 * image (or the site's, `metadata.ogImage`). Universal; use it in a route's `head`, written after
 * `loader` so `loaderData` is typed.
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
