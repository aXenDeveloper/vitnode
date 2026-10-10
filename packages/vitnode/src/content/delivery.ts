import type { ContentLocaleRouting, ContentPublicUrl } from "./public-url";
import type {
  AnyContentTypeDefinition,
  ContentDeliveryConfig,
  ContentDeliverySitemapConfig,
  ContentFieldDescriptor,
  ContentFieldMap,
  ContentSitemapChangeFrequency,
  DeliverableContentTypeDefinition,
  ResolvedContentDeliveryConfig,
  ResolvedContentPublicApiConfig,
} from "./types";

import { parseRoutePath } from "../routing/path";
import {
  CONTENT_DELIVERY_DESCRIPTION_KINDS,
  CONTENT_DELIVERY_NO_INDEX_KINDS,
  CONTENT_DELIVERY_PATH_MAX_LENGTH,
  CONTENT_DELIVERY_TITLE_KINDS,
  isContentSitemapChangeFrequency,
} from "./const";
import { contentOptionConfig } from "./define-shared";
import { ContentEngineError } from "./errors";
import { normalizeContentLocale } from "./locale";
import { readContentPath, splitContentFieldPath } from "./paths";
import { contentPublicHref, contentPublicUrl } from "./public-url";
import { isRichTextDocument } from "./rich-text/document";
import { richTextToPlainText } from "./rich-text/plain-text";

/** Kinds the three SEO slots accept, as runtime sets. */
const titleKinds: ReadonlySet<string> = new Set(CONTENT_DELIVERY_TITLE_KINDS);
const descriptionKinds: ReadonlySet<string> = new Set(
  CONTENT_DELIVERY_DESCRIPTION_KINDS,
);
const noIndexKinds: ReadonlySet<string> = new Set(
  CONTENT_DELIVERY_NO_INDEX_KINDS,
);

/** The disabled default every content type without `delivery` carries. */
export const contentDeliveryDisabled: ResolvedContentDeliveryConfig<false> = {
  enabled: false,
  hreflang: { xDefault: null },
  path: "",
  redirects: { enabled: false },
  seo: {
    descriptionField: null,
    fallbackDescriptionField: null,
    fallbackTitleField: null,
    noIndexField: null,
    openGraph: null,
    titleField: null,
  },
  sitemap: { changeFrequency: null, enabled: false, priority: null },
  slugScope: "none",
};

const resolveSeoTarget = (
  fields: ContentFieldMap,
  name: string,
): null | {
  container: "group" | "repeatable" | "row";
  descriptor: ContentFieldDescriptor;
} => {
  const path = splitContentFieldPath(name);
  if (!path) {
    const fieldValue = fields[name];

    return fieldValue ? { container: "row", descriptor: fieldValue } : null;
  }

  const [owner, leaf] = path;
  const container = fields[owner];
  if (container?.kind !== "group" && container?.kind !== "repeatable") {
    return null;
  }

  const leafValue = (container as { fields: ContentFieldMap }).fields[leaf];

  return leafValue
    ? { container: container.kind, descriptor: leafValue }
    : null;
};

const assertSeoField = ({
  exposed,
  fields,
  id,
  kinds,
  label,
  localizedFields,
  name,
  shared = false,
}: {
  exposed: ReadonlySet<string>;
  fields: ContentFieldMap;
  id: string;
  kinds: ReadonlySet<string>;
  label: string;
  localizedFields: ContentFieldMap;
  name: string;
  /** Whether the slot refuses a localized field. Only `noIndexField` does. */
  shared?: boolean;
}): void => {
  const target = resolveSeoTarget(fields, name);
  if (!target) {
    throw new ContentEngineError(
      `${label} references unknown field "${name}".`,
      { contentTypeId: id },
    );
  }

  if (target.container === "repeatable") {
    throw new ContentEngineError(
      `${label} names the repeatable leaf "${name}", which is many values rather than one. A page has one title, one description and one indexing decision.`,
      { contentTypeId: id },
    );
  }

  if (!kinds.has(target.descriptor.kind)) {
    throw new ContentEngineError(
      `${label} names "${name}" of kind "${target.descriptor.kind}". Expected one of: ${[...kinds].sort().join(", ")}.`,
      { contentTypeId: id },
    );
  }

  if (!exposed.has(name)) {
    throw new ContentEngineError(
      `${label} names "${name}", which is not in publicApi.fields. Delivery metadata is rendered into a public page, so every field it is built from has to be publicly readable already.`,
      { contentTypeId: id },
    );
  }

  if (shared) {
    const path = splitContentFieldPath(name);
    const owner = path ? path[0] : name;
    if (localizedFields[owner] !== undefined) {
      throw new ContentEngineError(
        `${label} names the localized field "${name}". This slot has to be shared: sitemap inclusion and the \`robots\` metadata must agree, and a per-locale value would give one record one answer per language while it has a single canonical decision.`,
        { contentTypeId: id },
      );
    }
  }
};

const CONTENT_DELIVERY_SLUG_SEGMENT = ":slug";

const RESERVED_DELIVERY_PREFIXES: ReadonlySet<string> = new Set([
  "admin",
  "api",
]);

const resolveContentDeliveryPath = ({
  id,
  path,
  publicPath,
}: {
  id: string;
  path: string | undefined;
  publicPath: string;
}): string => {
  if (path === undefined)
    return `/${publicPath}/${CONTENT_DELIVERY_SLUG_SEGMENT}`;

  if (
    typeof path !== "string" ||
    path.length > CONTENT_DELIVERY_PATH_MAX_LENGTH
  ) {
    throw new ContentEngineError(
      `delivery.path must be a string of at most ${CONTENT_DELIVERY_PATH_MAX_LENGTH} characters.`,
      { contentTypeId: id },
    );
  }

  const parsed = parseRoutePath(path);
  if (!parsed.ok) {
    throw new ContentEngineError(
      `delivery.path is not a valid route path: ${parsed.reason}.`,
      { contentTypeId: id },
    );
  }

  const slugs = parsed.segments.filter(
    segment => segment.kind === "param" && segment.name === "slug",
  ).length;
  if (slugs !== 1) {
    throw new ContentEngineError(
      `delivery.path "${path}" must contain exactly one "${CONTENT_DELIVERY_SLUG_SEGMENT}" parameter, not ${slugs}. It is the one value a record fills in.`,
      { contentTypeId: id },
    );
  }

  const extra = parsed.segments.find(
    segment =>
      segment.kind === "splat" ||
      (segment.kind === "param" && segment.name !== "slug"),
  );
  if (extra) {
    throw new ContentEngineError(
      `delivery.path "${path}" declares ${extra.kind === "param" ? `":${extra.name}"` : '"*"'}, but "${CONTENT_DELIVERY_SLUG_SEGMENT}" is the only parameter a record can fill.`,
      { contentTypeId: id },
    );
  }

  const [first] = parsed.segments;
  if (first?.kind === "static" && RESERVED_DELIVERY_PREFIXES.has(first.value)) {
    throw new ContentEngineError(
      `delivery.path "${path}" starts with "/${first.value}", which is reserved for the ${first.value === "api" ? "API" : "AdminCP"} and never served as a public page.`,
      { contentTypeId: id },
    );
  }

  return parsed.path;
};

export const resolveContentDelivery = ({
  delivery: deliveryOption,
  editorial,
  fields,
  id,
  localization,
  localizedFields,
  publicApi,
  publication,
}: {
  delivery: boolean | ContentDeliveryConfig | undefined;
  /** Whether the content type opted into the editorial workflow. */
  editorial: boolean;
  fields: ContentFieldMap;
  id: string;
  localization: { defaultLocale: string; enabled: boolean };
  localizedFields: ContentFieldMap;
  publicApi: ResolvedContentPublicApiConfig;
  publication: boolean;
}): ResolvedContentDeliveryConfig => {
  const delivery = contentOptionConfig(deliveryOption);
  if (!delivery) return contentDeliveryDisabled;

  if (!publicApi.enabled) {
    throw new ContentEngineError(
      "delivery needs `publicApi: { path, fields }`. A content type with no public API has no public URL, so there is no canonical path, no redirect and no sitemap entry for delivery to produce.",
      { contentTypeId: id },
    );
  }

  const slugField = publicApi.slugField;
  if (slugField === "") {
    throw new ContentEngineError(
      "delivery needs an exposed slug field. `publicApi` already requires exactly one, so this content type is misconfigured upstream.",
      { contentTypeId: id },
    );
  }

  const redirects = delivery.redirects === true;
  const sitemapConfig = contentOptionConfig<ContentDeliverySitemapConfig>(
    delivery.sitemap,
  );
  const slugScope =
    localizedFields[slugField] === undefined ? "shared" : "localized";

  // Slug history has to be written in the same transaction as the slug mutation, the
  // version check and the revision - and the only mutation paths that own such a
  // transaction are `editorial-service` and `translation-editorial-service`. Without
  // `editorial` a content type writes through the plain repository, which has neither
  // a version to guard nor a history to write, so accepting this would be accepting a
  // feature that records nothing.
  //
  // Refused rather than downgraded to `redirects: false`: an author who
  // asked for redirects and silently got none would find out from a broken link
  // months later. The type system refuses it too - see `ContentDeliveryConfig`.
  if (redirects && !editorial) {
    throw new ContentEngineError(
      "delivery.redirects needs `editorial`. Redirect history has to be written atomically with the slug mutation and its version and revision, and only the editorial mutation paths own that transaction. Delivery without `redirects` - canonical URLs, SEO, alternates and the sitemap - works without editorial.",
      { contentTypeId: id },
    );
  }

  // A localized content type whose slug is *shared* has one URL segment and several
  // URLs - `/en/articles/hello` and `/pl/articles/hello` are both live, and a slug
  // change moves all of them at once. Slug history stores the URL that was live, so
  // one retired row would have to be several paths, and the AdminCP would show one
  // of them as if it were the address somebody bookmarked. Canonical URLs, SEO,
  // alternates and the sitemap all work fine in that shape - only the redirect
  // reservation is ambiguous, so only it is refused.
  if (redirects && localization.enabled && slugScope === "shared") {
    throw new ContentEngineError(
      `delivery.redirects needs a localized slug field on a localized content type, but "${slugField}" is shared. Every language answers to the same segment, so one retired address would belong to several URLs at once. Mark the slug \`localized: true\`, or drop \`redirects\`.`,
      { contentTypeId: id },
    );
  }

  // Restated even though `publicApi` already requires publication: a sitemap
  // lists what anonymous readers can reach, and "what can be reached" is exactly
  // the publication lifecycle. Without it every row would be in the sitemap from
  // the moment it was created.
  if (sitemapConfig && !publication) {
    throw new ContentEngineError(
      "delivery.sitemap needs `publication: true`. A sitemap lists what is publicly reachable, and without the lifecycle every row would be listed the moment it was created.",
      { contentTypeId: id },
    );
  }

  if (sitemapConfig?.priority !== undefined) {
    const { priority } = sitemapConfig;
    if (!Number.isFinite(priority) || priority < 0 || priority > 1) {
      throw new ContentEngineError(
        `delivery.sitemap.priority is ${priority}; the sitemap protocol defines it between 0 and 1 inclusive.`,
        { contentTypeId: id },
      );
    }
  }

  if (
    sitemapConfig?.changeFrequency !== undefined &&
    !isContentSitemapChangeFrequency(sitemapConfig.changeFrequency)
  ) {
    throw new ContentEngineError(
      `delivery.sitemap.changeFrequency is "${String(sitemapConfig.changeFrequency)}", which is not one of the values the sitemap protocol defines. A crawler ignores an unknown one silently, so a typo would be a hint nobody ever receives.`,
      { contentTypeId: id },
    );
  }

  if (delivery.hreflang !== undefined) {
    if (delivery.hreflang.xDefault !== "defaultLocale") {
      throw new ContentEngineError(
        `delivery.hreflang.xDefault is "${String(delivery.hreflang.xDefault)}"; the only supported value is "defaultLocale". An x-default has to point at a URL that actually resolves.`,
        { contentTypeId: id },
      );
    }

    if (!localization.enabled) {
      throw new ContentEngineError(
        "delivery.hreflang needs `localization: { defaultLocale }`. A content type with one language has no alternates, so there is nothing for an x-default to be the default of.",
        { contentTypeId: id },
      );
    }
  }

  const path = resolveContentDeliveryPath({
    id,
    path: delivery.path,
    publicPath: publicApi.path,
  });

  const exposed = new Set(publicApi.fields);

  // Alternates and `hreflang` are resolved by identifier - the query enumerates a
  // record's published translations - and delivery reads the **public projection**,
  // so a localized content type that withholds `id` would silently produce an empty
  // `hreflang` set from `resolveSlug`. Refused loudly here rather than left as a
  // quiet gap: an empty `hreflang` looks exactly like a record with one translation.
  //
  // Not required of a nonlocalized content type, which has no alternates to resolve.
  if (localization.enabled && !exposed.has("id")) {
    throw new ContentEngineError(
      'delivery on a localized content type needs "id" in publicApi.fields. Alternates and `hreflang` are resolved by identifier, and delivery reads the public projection - so without it every localized response would carry an empty alternate set.',
      { contentTypeId: id },
    );
  }

  const seo = delivery.seo ?? {};

  for (const [label, name] of [
    ["delivery.seo.titleField", seo.titleField],
    ["delivery.seo.fallbackTitleField", seo.fallbackTitleField],
    ["delivery.seo.openGraph.titleField", seo.openGraph?.titleField],
  ] as const) {
    if (name === undefined) continue;

    assertSeoField({
      exposed,
      fields,
      id,
      kinds: titleKinds,
      label,
      localizedFields,
      name,
    });
  }

  for (const [label, name] of [
    ["delivery.seo.descriptionField", seo.descriptionField],
    ["delivery.seo.fallbackDescriptionField", seo.fallbackDescriptionField],
    [
      "delivery.seo.openGraph.descriptionField",
      seo.openGraph?.descriptionField,
    ],
  ] as const) {
    if (name === undefined) continue;

    assertSeoField({
      exposed,
      fields,
      id,
      kinds: descriptionKinds,
      label,
      localizedFields,
      name,
    });
  }

  if (seo.noIndexField !== undefined) {
    assertSeoField({
      exposed,
      fields,
      id,
      kinds: noIndexKinds,
      label: "delivery.seo.noIndexField",
      localizedFields,
      name: seo.noIndexField,
      shared: true,
    });
  }

  // A fallback with no primary is a configuration that reads as if it does
  // something and does nothing: the primary is what is consulted first, so
  // naming only the fallback means the fallback is never reached.
  if (seo.fallbackTitleField !== undefined && seo.titleField === undefined) {
    throw new ContentEngineError(
      "delivery.seo.fallbackTitleField is set without `titleField`. The fallback is only consulted when the primary is empty, so on its own it would never be read - name it as `titleField` instead.",
      { contentTypeId: id },
    );
  }

  if (
    seo.fallbackDescriptionField !== undefined &&
    seo.descriptionField === undefined
  ) {
    throw new ContentEngineError(
      "delivery.seo.fallbackDescriptionField is set without `descriptionField`. The fallback is only consulted when the primary is empty, so on its own it would never be read.",
      { contentTypeId: id },
    );
  }

  return {
    enabled: true,
    hreflang: { xDefault: delivery.hreflang?.xDefault ?? null },
    path,
    redirects: { enabled: redirects },
    seo: {
      descriptionField: seo.descriptionField ?? null,
      fallbackDescriptionField: seo.fallbackDescriptionField ?? null,
      fallbackTitleField: seo.fallbackTitleField ?? null,
      noIndexField: seo.noIndexField ?? null,
      openGraph:
        seo.openGraph === undefined
          ? null
          : {
              descriptionField: seo.openGraph.descriptionField ?? null,
              titleField: seo.openGraph.titleField ?? null,
            },
      titleField: seo.titleField ?? null,
    },
    sitemap: {
      changeFrequency: sitemapConfig?.changeFrequency ?? null,
      enabled: sitemapConfig !== null,
      priority: sitemapConfig?.priority ?? null,
    },
    slugScope,
  };
};

// ---------------------------------------------------------------------------
// Canonical URLs
// ---------------------------------------------------------------------------

export const contentDeliveryInternalPath = ({
  definition,
  slug,
}: {
  definition: AnyContentTypeDefinition;
  slug: string;
}): null | string => {
  const route = definition.delivery.path;
  const trimmed = slug.trim();
  if (route === "" || trimmed === "") return null;

  return route
    .split("/")
    .map(segment =>
      segment === CONTENT_DELIVERY_SLUG_SEGMENT
        ? encodeURIComponent(trimmed)
        : segment,
    )
    .join("/");
};

export const contentDeliveryPublicUrl = ({
  definition,
  host,
  locale,
  routing,
  slug,
}: {
  definition: AnyContentTypeDefinition;
  host?: null | string;
  locale?: null | string;
  routing: ContentLocaleRouting;
  slug: string;
}): ContentPublicUrl | null => {
  const internalPath = contentDeliveryInternalPath({ definition, slug });
  if (internalPath === null) return null;

  return contentPublicUrl({
    host,
    internalPath,
    locale: definition.localization.enabled
      ? (locale ?? "")
      : routing.defaultLocale,
    routing,
  });
};

export const contentDeliveryPath = (args: {
  definition: AnyContentTypeDefinition;
  locale?: null | string;
  routing: ContentLocaleRouting;
  slug: string;
}): null | string => contentDeliveryPublicUrl(args)?.pathname ?? null;

/**
 * A canonical path turned absolute, when the caller has an origin.
 *
 * `origin` is whatever the request or the deployment says it is - a configured
 * public URL, `VITNODE_WEB_URL`, a forwarded host. It is validated here rather
 * than concatenated: `https://example.com` and `https://example.com/` have to
 * produce the same URL, and a malformed origin has to be a `null` rather than a
 * link with two schemes in it.
 */
export const contentDeliveryUrl = ({
  origin,
  path,
}: {
  origin: string;
  path: null | string;
}): null | string => {
  if (path === null) return null;

  try {
    return new URL(path, origin).toString();
  } catch {
    return null;
  }
};

/** One published translation's URL, as `alternates` and `hreflang` report it. */
export interface ContentDeliveryAlternate {
  internalPath: string;
  /** The canonical `core_languages.code`. */
  locale: string;
  origin?: string;
  path: string;
}

export interface ContentDeliveryHreflang {
  languages: Record<string, string>;
  /** Present only with `delivery.hreflang.xDefault` and a resolvable default. */
  xDefault?: string;
}

export const contentDeliveryAlternateHref = (
  alternate: ContentDeliveryAlternate,
): string =>
  contentPublicHref({ origin: alternate.origin, pathname: alternate.path });

export const contentDeliveryHreflang = ({
  alternates,
  definition,
}: {
  alternates: readonly ContentDeliveryAlternate[];
  definition: AnyContentTypeDefinition;
}): ContentDeliveryHreflang => {
  const languages: Record<string, string> = {};
  for (const alternate of alternates) {
    languages[alternate.locale] = contentDeliveryAlternateHref(alternate);
  }

  if (definition.delivery.hreflang.xDefault !== "defaultLocale") {
    return { languages };
  }

  // Only when the default locale is genuinely one of the alternates. An
  // `x-default` pointing at a language this record has not published would be a
  // hint to crawl a 404, which is worse than emitting nothing.
  const fallback = alternates.find(alternate =>
    contentDeliveryLocalesMatch(
      alternate.locale,
      definition.localization.defaultLocale,
    ),
  );

  return fallback === undefined
    ? { languages }
    : { languages, xDefault: contentDeliveryAlternateHref(fallback) };
};

const contentDeliveryLocalesMatch = (a: string, b: string): boolean =>
  normalizeContentLocale(a) === normalizeContentLocale(b);

// ---------------------------------------------------------------------------
// SEO projection
// ---------------------------------------------------------------------------

export interface ContentDeliverySeo {
  description: null | string;
  title: null | string;
}

export interface ContentDeliveryRobots {
  follow: boolean;
  index: boolean;
}

const readSeoText = (
  row: Record<string, unknown>,
  primary: null | string,
  fallback: null | string,
): null | string => {
  for (const name of [primary, fallback]) {
    if (name === null) continue;

    const raw = readContentPath(row, name);
    // A rich text description is its words: the host truncates them, and
    // markup has no place in a meta tag.
    const value = isRichTextDocument(raw) ? richTextToPlainText(raw) : raw;
    if (typeof value !== "string") continue;

    const trimmed = value.trim();
    if (trimmed !== "") return trimmed;
  }

  return null;
};

export const contentDeliverySeo = (
  definition: AnyContentTypeDefinition,
  row: Record<string, unknown>,
): ContentDeliverySeo => {
  const { seo } = definition.delivery;

  return {
    description: readSeoText(
      row,
      seo.descriptionField,
      seo.fallbackDescriptionField,
    ),
    title: readSeoText(row, seo.titleField, seo.fallbackTitleField),
  };
};

export const contentDeliveryOpenGraph = (
  definition: AnyContentTypeDefinition,
  row: Record<string, unknown>,
): ContentDeliverySeo | null => {
  const { seo } = definition.delivery;
  if (seo.openGraph === null) return null;

  const base = contentDeliverySeo(definition, row);

  return {
    description:
      readSeoText(row, seo.openGraph.descriptionField, null) ??
      base.description,
    title: readSeoText(row, seo.openGraph.titleField, null) ?? base.title,
  };
};

export const contentDeliveryRobots = (
  definition: AnyContentTypeDefinition,
  row: Record<string, unknown>,
): ContentDeliveryRobots | null => {
  const { noIndexField } = definition.delivery.seo;
  if (noIndexField === null) return null;

  return { follow: true, index: readContentPath(row, noIndexField) !== true };
};

// ---------------------------------------------------------------------------
// Path parsing
// ---------------------------------------------------------------------------

/** A public path split into the two things a delivery lookup needs. */
export interface ContentDeliveryPathParts {
  /** `null` for a content type that is not localized. */
  locale: null | string;
  slug: string;
}

const decodeSegments = (pathname: string): null | string[] => {
  const segments: string[] = [];

  for (const segment of pathname.split("/")) {
    if (segment === "") continue;

    try {
      segments.push(decodeURIComponent(segment));
    } catch {
      return null;
    }
  }

  return segments;
};

const validSlug = (slug: string | undefined): slug is string =>
  slug !== undefined && slug !== "" && slug !== "." && slug !== "..";

const matchDeliveryRoute = (
  definition: AnyContentTypeDefinition,
  internalPathname: string,
): null | string => {
  const route = definition.delivery.path;
  if (route === "") return null;

  const expected = route.split("/").filter(segment => segment !== "");
  const actual = decodeSegments(internalPathname);
  if (actual?.length !== expected.length) return null;

  let slug: string | undefined;
  for (const [index, segment] of expected.entries()) {
    const value = actual[index];
    if (segment === CONTENT_DELIVERY_SLUG_SEGMENT) {
      slug = value;
      continue;
    }

    if (value.toLowerCase() !== segment) return null;
  }

  return validSlug(slug) ? slug : null;
};

const parseLegacyDeliveryPath = (
  definition: AnyContentTypeDefinition,
  pathname: string,
): ContentDeliveryPathParts | null => {
  const parts = decodeSegments(pathname);
  if (!parts) return null;

  const localized = definition.localization.enabled;
  if (parts.length !== (localized ? 3 : 2)) return null;

  const [prefix, slug] = localized
    ? [parts[1], parts[2]]
    : [parts[0], parts[1]];
  if (prefix !== definition.publicApi.path || !validSlug(slug)) return null;

  return {
    locale: localized ? normalizeContentLocale(parts[0]) : null,
    slug,
  };
};

export const parseContentDeliveryPath = (
  definition: AnyContentTypeDefinition,
  path: string,
  { host, routing }: { host?: null | string; routing: ContentLocaleRouting },
): ContentDeliveryPathParts | null => {
  if (path.length > CONTENT_DELIVERY_PATH_MAX_LENGTH) return null;

  const pathname = path.split(/[?#]/)[0] ?? "";
  const resolved = routing.resolvePublicPathname(
    pathname.startsWith("/") ? pathname : `/${pathname}`,
    { host },
  );
  const slug = matchDeliveryRoute(definition, resolved.internalPathname);

  if (slug === null) return parseLegacyDeliveryPath(definition, pathname);

  return {
    locale: definition.localization.enabled
      ? normalizeContentLocale(resolved.locale)
      : null,
    slug,
  };
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const listDeliveryContentTypes = <
  TEntry extends { definition: AnyContentTypeDefinition; pluginId: string },
>(
  entries: readonly TEntry[],
): TEntry[] =>
  [...entries]
    .filter(entry => entry.definition.delivery.enabled)
    .sort((a, b) => a.definition.id.localeCompare(b.definition.id));

/** Whether one definition has a delivery layer, as a type guard. */
export const isDeliverableContentType = (
  definition: AnyContentTypeDefinition,
): definition is DeliverableContentTypeDefinition =>
  definition.delivery.enabled && definition.publicApi.enabled;

/** The sitemap defaults of one content type, or `null` when it lists nothing. */
export const contentSitemapDefaults = (
  definition: AnyContentTypeDefinition,
): null | {
  changeFrequency: ContentSitemapChangeFrequency | null;
  priority: null | number;
} => {
  const { sitemap } = definition.delivery;
  if (!definition.delivery.enabled || !sitemap.enabled) return null;

  return {
    changeFrequency: sitemap.changeFrequency,
    priority: sitemap.priority,
  };
};
