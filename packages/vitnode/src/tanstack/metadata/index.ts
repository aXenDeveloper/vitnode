import type {
  SITE_OG_IMAGE_LAYOUTS,
  VitNodeMetadata,
} from "@vitnode/api/lib/metadata";

import { CONFIG } from "@vitnode/api/lib/config";
import {
  formatPageTitle,
  SITE_OG_IMAGE_ACCENT_PATTERN,
  SITE_OG_IMAGE_CATEGORY_MAX,
  SITE_OG_IMAGE_DESCRIPTION_MAX,
  SITE_OG_IMAGE_TITLE_MAX,
} from "@vitnode/api/lib/metadata";

import { getVitNodeConfig } from "@/vitnode.config";

import type { LocaleAlternates, RouteHeadLink } from "./alternates";

import { localeAlternateLinks, X_DEFAULT_HREFLANG } from "./alternates";
import { OG_LOCALE_ALTERNATE_NAME_PREFIX } from "./og-locale-alternate";

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

/** How the generated site card arranges a page's title and description. */
export type RouteOpenGraphImageLayout = (typeof SITE_OG_IMAGE_LAYOUTS)[number];

/** The label above the title on the generated site card. */
export interface RouteOpenGraphImageCategory {
  /** The label, glow and bar colour, as `#rrggbb`. Defaults to the card theme's accent. */
  color?: string;
  /** The label, e.g. the docs section the page belongs to. */
  title: string;
}

export interface RouteOpenGraph {
  /** The `<meta property="og:description">`. Defaults to the page's `description`. */
  description?: string;
  /**
   * The `og:image`. Defaults to the site's image (`metadata.ogImage` in the
   * VitNode config): the API's generated site card unless set otherwise.
   */
  image?: RouteOpenGraphImage;
  /** A category the generated site card shows above the title, in its own colour. */
  imageCategory?: RouteOpenGraphImageCategory;
  /**
   * How the generated site card arranges the page's text when the page sets
   * no `image`: `headline` (the default) draws the title large with the
   * description under it, `quote` draws the description as a large quote
   * signed with the title.
   */
  imageLayout?: RouteOpenGraphImageLayout;
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
  | { content: string; name: string; property: string }
  | { content: string; name: string }
  | { content: string; property: string }
  | { title: string };

const SITE_OG_IMAGE_PATH = "/api/@vitnode/core/og/site";

const absoluteUrl = (value: string, origin: URL): string | undefined => {
  try {
    const url = new URL(value, origin);

    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
};

const truncate = (value: string, max: number): string => {
  const text = value.replaceAll(/\s+/g, " ").trim();
  if (text.length <= max) return text;

  return `${text.slice(0, max - 1).trimEnd()}…`;
};

interface SiteImagePage {
  category?: RouteOpenGraphImageCategory;
  description?: string;
  layout?: RouteOpenGraphImageLayout;
  locale?: string;
  title: string;
}

const siteImageOrigin = (): URL =>
  process.env.VITNODE_API_URL ? CONFIG.api : CONFIG.web;

const generatedSiteImageUrl = (page: SiteImagePage): string => {
  const imageUrl = new URL(SITE_OG_IMAGE_PATH, siteImageOrigin());
  imageUrl.searchParams.set(
    "title",
    truncate(page.title, SITE_OG_IMAGE_TITLE_MAX),
  );
  if (page.description) {
    imageUrl.searchParams.set(
      "description",
      truncate(page.description, SITE_OG_IMAGE_DESCRIPTION_MAX),
    );
  }
  if (page.category?.title.trim()) {
    imageUrl.searchParams.set(
      "category",
      truncate(page.category.title, SITE_OG_IMAGE_CATEGORY_MAX),
    );
    if (
      page.category.color &&
      SITE_OG_IMAGE_ACCENT_PATTERN.test(page.category.color)
    ) {
      imageUrl.searchParams.set("accent", page.category.color);
    }
  }
  if (page.layout) imageUrl.searchParams.set("layout", page.layout);
  if (page.locale) imageUrl.searchParams.set("locale", page.locale);

  return imageUrl.href;
};

const siteImage = (
  metadata: VitNodeMetadata,
  page: SiteImagePage,
): RouteOpenGraphImage | undefined => {
  const { ogImage = "generated" } = metadata;
  if (ogImage === false) return undefined;

  if (ogImage === "generated") {
    return {
      alt: page.title,
      height: 630,
      type: "image/png",
      url: generatedSiteImageUrl(page),
      width: 1200,
    };
  }

  const url = absoluteUrl(ogImage, CONFIG.web);

  return url === undefined ? undefined : { alt: metadata.title, url };
};

const pageImage = (
  image: RouteOpenGraphImage,
): RouteOpenGraphImage | undefined => {
  const url = absoluteUrl(image.url, CONFIG.web);

  return url === undefined ? undefined : { ...image, url };
};

const nonEmpty = (value: string | undefined): string | undefined =>
  value === "" ? undefined : value;

const ogLocale = (locale: string): string => {
  try {
    const { language, region } = new Intl.Locale(locale).maximize();

    return region ? `${language}_${region}` : language;
  } catch {
    return locale.replace("-", "_");
  }
};

const ogLocaleAlternates = (
  locale: string | undefined,
  alternateLocales: readonly string[],
): RouteHeadMeta[] => {
  const current = locale === undefined ? undefined : ogLocale(locale);

  return [...new Set(alternateLocales.map(ogLocale))]
    .filter(alternate => alternate !== current)
    .map(alternate => ({
      content: alternate,
      name: `${OG_LOCALE_ALTERNATE_NAME_PREFIX}${alternate}`,
      property: "og:locale:alternate",
    }));
};

const named = (name: string, content: null | string | undefined) =>
  content === null || content === undefined || content === ""
    ? []
    : [{ content, name }];

const twitterHandle = (value: string | undefined): string | undefined => {
  const handle = value?.trim().replace(/^@/, "");

  return handle && /^\w{1,15}$/.test(handle) ? `@${handle}` : undefined;
};

const property = (name: string, content: null | number | string | undefined) =>
  content === null || content === undefined || content === ""
    ? []
    : [{ content: String(content), property: name }];

const socialMeta = (
  metadata: VitNodeMetadata,
  {
    alternateLocales = [],
    description,
    locale,
    openGraph,
    title,
    url,
  }: Pick<
    RouteHeadOptions,
    "description" | "locale" | "openGraph" | "title"
  > & {
    alternateLocales?: readonly string[];
    url?: string;
  },
): RouteHeadMeta[] => {
  const ogTitle = nonEmpty(openGraph?.title) ?? nonEmpty(title);
  if (ogTitle === undefined) return [];

  const ogDescription = openGraph?.description ?? description;
  const image =
    openGraph?.image === undefined
      ? siteImage(metadata, {
          category: openGraph?.imageCategory,
          description: ogDescription,
          layout: openGraph?.imageLayout,
          locale,
          title: ogTitle,
        })
      : pageImage(openGraph.image);

  return [
    ...property("og:title", ogTitle),
    ...property("og:description", ogDescription),
    ...property("og:type", openGraph?.type ?? "website"),
    ...property("og:site_name", metadata.title),
    ...property("og:url", url),
    ...property(
      "og:locale",
      locale === undefined ? undefined : ogLocale(locale),
    ),
    ...ogLocaleAlternates(locale, alternateLocales),
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
    ...named("twitter:site", twitterHandle(metadata.twitterSite)),
    ...named("twitter:title", ogTitle),
    ...named("twitter:description", ogDescription),
    ...named("twitter:image", image?.url),
    ...named("twitter:image:alt", image?.alt),
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
    alternateLocales,
    description,
    locale,
    openGraph,
    robots,
    title,
    url,
  }: Pick<
    RouteHeadOptions,
    "description" | "locale" | "openGraph" | "robots" | "title"
  > & { alternateLocales?: readonly string[]; url?: string },
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
  ...socialMeta(metadata, {
    alternateLocales,
    description,
    locale,
    openGraph,
    title,
    url,
  }),
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
    url = absoluteUrl(canonical, CONFIG.web);
    if (url !== undefined) links.unshift({ href: url, rel: "canonical" });
  }

  const alternateLocales = links.flatMap(({ hrefLang, rel }) =>
    rel === "alternate" && hrefLang && hrefLang !== X_DEFAULT_HREFLANG
      ? [hrefLang]
      : [],
  );

  return {
    ...(links.length > 0 ? { links } : {}),
    meta: routeMeta(metadata, {
      alternateLocales,
      description,
      locale,
      openGraph,
      robots,
      title,
      url,
    }),
  };
};

/**
 * The root route's fallback `og:url` and `og:locale`, for pages that set no
 * canonical URL or locale of their own: the public pathname on the web app's
 * origin, without the query string. A page's own tags replace these, because
 * TanStack Router keeps the deepest route's tag. Universal.
 *
 * @example
 * ```ts
 * import { documentSocialMeta } from "@vitnode/core/tanstack/metadata";
 *
 * head: ({ match }) => ({
 *   meta: [...documentSocialMeta({ locale: match.context.locale, pathname: match.context.publicPathname })],
 * }),
 * ```
 */
export const documentSocialMeta = ({
  locale,
  pathname,
}: {
  /** The locale being rendered. */
  locale?: string;
  /** The public pathname, locale prefix included. */
  pathname?: string;
}): RouteHeadMeta[] => [
  ...property(
    "og:url",
    pathname === undefined ? undefined : absoluteUrl(pathname, CONFIG.web),
  ),
  ...property("og:locale", locale === undefined ? undefined : ogLocale(locale)),
];

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
