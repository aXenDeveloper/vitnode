import type {
  AnyContentTypeDefinition,
  ContentDeliveryConfig,
  ContentFieldDescriptor,
  ContentFieldMap,
  ContentSitemapChangeFrequency,
  DeliverableContentTypeDefinition,
  ResolvedContentDeliveryConfig,
  ResolvedContentPublicApiConfig,
} from "./types";

import {
  CONTENT_DELIVERY_DESCRIPTION_KINDS,
  CONTENT_DELIVERY_NO_INDEX_KINDS,
  CONTENT_DELIVERY_PATH_MAX_LENGTH,
  CONTENT_DELIVERY_TITLE_KINDS,
  isContentSitemapChangeFrequency,
} from "./const";
import { ContentEngineError } from "./errors";
import { normalizeContentLocale } from "./locale";
import { readContentPath, splitContentFieldPath } from "./paths";

/**
 * The Content Delivery layer: what a public URL *is*, rather than what a record
 * contains.
 *
 * Everything in this module is pure and client-safe. It answers four questions
 * and nothing else - what is the canonical path of this record in this language,
 * which languages does it also exist in, what should the page put in `<head>`,
 * and is a given path the current one - so a frontend can render a page, an
 * `hreflang` set and a sitemap entry from data the engine already has.
 *
 * It deliberately does **not** render anything. There is no layout here, no
 * React, no Next.js and no `Metadata`: those belong to the application, and the
 * `content/next` adapter is the thin translation layer between the two.
 */

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

/**
 * Resolves one SEO field name to the descriptor it addresses, or `null`.
 *
 * A leaf path resolves through its **group**, and a repeatable is deliberately
 * not resolvable here: `assertSeoField` needs to tell "this leaf is a column on
 * the row" from "this leaf is a column on a child row", and only the first can
 * be one page's title.
 */
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

/**
 * Checks one configured SEO field name.
 *
 * The public-exposure rule is the important one, and it is what makes "SEO
 * metadata cannot leak a private value" a property of the definition rather than
 * of every consumer: a `<title>` is rendered into a public page, so it has to be
 * something the public API would already have said out loud.
 */
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

/**
 * Checks and fills in `delivery`.
 *
 * Runs after `resolvePublicApi` and after the field partition, because every rule
 * here is stated in terms of both: the public allowlist decides which fields may
 * be projected, and the partition decides which language a historical URL belongs
 * to.
 *
 * Nothing is silently ignored. An invalid delivery block fails at definition
 * time - a canonical URL that quietly stopped being generated is a page that
 * quietly stopped being indexable, and that is not a symptom anybody notices.
 */
export const resolveContentDelivery = ({
  delivery,
  fields,
  id,
  localization,
  localizedFields,
  publicApi,
  publication,
}: {
  delivery: ContentDeliveryConfig | undefined;
  fields: ContentFieldMap;
  id: string;
  localization: { defaultLocale: string; enabled: boolean };
  localizedFields: ContentFieldMap;
  publicApi: ResolvedContentPublicApiConfig;
  publication: boolean;
}): ResolvedContentDeliveryConfig => {
  if (!delivery?.enabled) return contentDeliveryDisabled;

  if (!publicApi.enabled) {
    throw new ContentEngineError(
      "delivery needs `publicApi: { enabled: true, path, fields }`. A content type with no public API has no public URL, so there is no canonical path, no redirect and no sitemap entry for delivery to produce.",
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

  const redirects = delivery.redirects?.enabled === true;
  const sitemapConfig =
    delivery.sitemap?.enabled === true ? delivery.sitemap : null;
  const slugScope =
    localizedFields[slugField] === undefined ? "shared" : "localized";

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
      "delivery.sitemap needs `publication: { enabled: true }`. A sitemap lists what is publicly reachable, and without the lifecycle every row would be listed the moment it was created.",
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
        "delivery.hreflang needs `localization: { enabled: true, defaultLocale }`. A content type with one language has no alternates, so there is nothing for an x-default to be the default of.",
        { contentTypeId: id },
      );
    }
  }

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

/**
 * The canonical **path** of one record, in one language.
 *
 * ```text
 * /articles/my-article           nonlocalized
 * /pl/articles/moj-artykul       localized
 * ```
 *
 * Relative, always, and that is the point: a content type definition lives in
 * source control and gets deployed to a preview domain, a staging domain and
 * production, so an origin baked into it would be wrong in two of the three
 * places. {@link contentDeliveryUrl} adds one when a caller has one to add.
 *
 * The locale segment is **normalized** through `normalizeContentLocale`, so
 * `PL`, `pl` and `" pl "` produce one path and therefore one cache key. The slug
 * is percent-encoded: a generated slug is already URL-safe, but a row written
 * straight into the database is not, and a path is what this function promises.
 *
 * `null` for an empty slug or an empty public path, rather than a link to
 * `/articles/` - a canonical URL that points at a list page is worse than no
 * canonical URL at all.
 */
export const contentDeliveryPath = ({
  definition,
  locale,
  slug,
}: {
  definition: AnyContentTypeDefinition;
  /** Required for a localized content type, ignored otherwise. */
  locale?: null | string;
  slug: string;
}): null | string => {
  const path = definition.publicApi.path;
  const trimmed = slug.trim();
  if (path === "" || trimmed === "") return null;

  const segments: string[] = [];

  if (definition.localization.enabled) {
    const normalized = normalizeContentLocale(locale ?? "");
    // A localized record has one URL per language and no locale-less one. Without
    // a locale there is no path to build, and guessing would hand a reader the
    // wrong language under a URL that claims otherwise.
    if (normalized === "") return null;

    segments.push(encodeURIComponent(normalized));
  }

  segments.push(path, encodeURIComponent(trimmed));

  return `/${segments.join("/")}`;
};

/**
 * A canonical path turned absolute, when the caller has an origin.
 *
 * `origin` is whatever the request or the deployment says it is - a configured
 * public URL, `NEXT_PUBLIC_WEB_URL`, a forwarded host. It is separate from the
 * path for the reason {@link contentDeliveryPath} explains, and it is validated
 * here rather than concatenated: `https://example.com` and
 * `https://example.com/` have to produce the same URL, and a malformed origin
 * has to be a `null` rather than a link with two schemes in it.
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
  /** The canonical `core_languages.code`. */
  locale: string;
  path: string;
}

/**
 * The `hreflang` set of one record, as a framework-neutral map.
 *
 * `{ languages, xDefault? }` rather than a Next.js `Metadata` object, because the
 * core engine has no business knowing which framework renders it - `content/next`
 * turns this into `alternates.languages` in one line, and an Astro or Remix
 * adapter would do the same.
 *
 * Built from {@link ContentDeliveryAlternate}s, which are **real published
 * translations** and nothing else. A fallback translation is not an alternate: it
 * has no URL in the language that fell back to it, so listing one would announce
 * a page that answers 404.
 */
export interface ContentDeliveryHreflang {
  languages: Record<string, string>;
  /** Present only with `delivery.hreflang.xDefault` and a resolvable default. */
  xDefault?: string;
}

export const contentDeliveryHreflang = ({
  alternates,
  definition,
}: {
  alternates: readonly ContentDeliveryAlternate[];
  definition: AnyContentTypeDefinition;
}): ContentDeliveryHreflang => {
  const languages: Record<string, string> = {};
  for (const alternate of alternates)
    languages[alternate.locale] = alternate.path;

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
    : { languages, xDefault: fallback.path };
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

/**
 * Reads one configured SEO slot out of a **public** row.
 *
 * The row is the public projection - the same object the public API returns - so
 * a field the allowlist omits is not merely skipped here, it is absent from the
 * object entirely. That is what makes "SEO cannot leak a private field" true at
 * runtime as well as at definition time.
 *
 * A whitespace-only value counts as empty, because a `<title>` of three spaces is
 * a missing title with extra steps - and that is exactly when the fallback should
 * take over.
 */
const readSeoText = (
  row: Record<string, unknown>,
  primary: null | string,
  fallback: null | string,
): null | string => {
  for (const name of [primary, fallback]) {
    if (name === null) continue;

    const value = readContentPath(row, name);
    if (typeof value !== "string") continue;

    const trimmed = value.trim();
    if (trimmed !== "") return trimmed;
  }

  return null;
};

/**
 * The `<title>` and `<meta name="description">` of one record.
 *
 * `{ description: null, title: null }` for a content type whose `delivery.seo`
 * names nothing - the shape is stable so a frontend never branches on whether
 * the block was configured, only on whether a value came back.
 */
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

/**
 * The Open Graph pair, or `null` when the content type configured none.
 *
 * `null` rather than an object of nulls, because "this content type does not
 * publish Open Graph metadata" and "it does, and this page has no title" are
 * different facts and a renderer treats them differently: the first emits no
 * tags at all.
 *
 * Each slot falls back to the ordinary SEO one, which is what makes the common
 * case - the same title in both places - a two-line config rather than four.
 */
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

/**
 * The `robots` directive of one record, or `null` without a `noIndexField`.
 *
 * `follow` is always `true`: "do not list this page" and "do not follow the links
 * on it" are different instructions, and a content type that asked for the first
 * has not asked for the second. A `noindex, nofollow` page is a dead end for a
 * crawler walking the site, which is a decision for site-wide robots
 * configuration rather than for one record.
 *
 * The same field drives the sitemap exclusion, which is what keeps the two from
 * disagreeing: a record cannot be absent from the sitemap and `index: true` at
 * the same time, because there is one boolean behind both.
 */
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

/**
 * Splits a public path back into its locale and its slug.
 *
 * The inverse of {@link contentDeliveryPath}, and deliberately strict: it accepts
 * exactly the shape that function produces and refuses everything else. A path
 * with an extra segment, a different public prefix or a traversal in it is `null`
 * rather than a best guess - a resolver that guessed would answer one content
 * type's URL with another's record.
 *
 * A query string and a fragment are stripped first, because a browser sends them
 * and they are not part of the identity of a page.
 */
export const parseContentDeliveryPath = (
  definition: AnyContentTypeDefinition,
  path: string,
): ContentDeliveryPathParts | null => {
  if (path.length > CONTENT_DELIVERY_PATH_MAX_LENGTH) return null;

  const withoutQuery = path.split(/[?#]/)[0] ?? "";
  const segments = withoutQuery
    .split("/")
    .filter(segment => segment !== "")
    .map(segment => {
      try {
        return decodeURIComponent(segment);
      } catch {
        // A malformed escape is not a path this engine produced.
        return null;
      }
    });

  if (segments.some(segment => segment === null)) return null;

  const parts = segments as string[];
  const localized = definition.localization.enabled;
  const expected = localized ? 3 : 2;
  if (parts.length !== expected) return null;

  const [prefix, slug] = localized
    ? [parts[1], parts[2]]
    : [parts[0], parts[1]];
  if (prefix !== definition.publicApi.path) return null;
  if (slug === "" || slug === "." || slug === "..") return null;

  return {
    locale: localized ? normalizeContentLocale(parts[0]) : null,
    slug,
  };
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Every delivery-enabled content type of an installation, in a stable order.
 *
 * What a site-level sitemap index is built from: it enumerates the content types
 * that have public URLs at all, so an application never hardcodes plugin names -
 * installing a plugin adds its content types to the sitemap and removing it takes
 * them out again.
 *
 * Ordered by content type id, so two processes building the same sitemap index
 * produce the same document.
 */
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
