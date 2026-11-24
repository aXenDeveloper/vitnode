import type { LocaleRouting } from "@vitnode/api/lib/i18n/locale-routing";

import { contentDeliverySitemapTag } from "@vitnode/api/content/cache";
import {
  contentSitemapIndexXml,
  contentSitemapXml,
} from "@vitnode/api/content/sitemap";

import type { SeoSitemapCache } from "./cache.server";
import type {
  SeoContentSitemapEntry,
  SeoContentSitemapFetch,
} from "./content-transport.server";
import type { SeoContentSitemapSource, SeoSitemapManifest } from "./manifest";
import type { ResolvedSeoPolicy } from "./policy.server";

import {
  SEO_SITEMAP_BUILD_TTL_SECONDS,
  SEO_SITEMAP_INDEX_TTL_SECONDS,
  SEO_SITEMAP_TTL_SECONDS,
  seoCachedState,
} from "./cache.server";
import { SeoSitemapSourceError } from "./content-transport.server";
import {
  SEO_SITEMAP_FILE_PATTERN,
  seoSitemapChildPath,
  seoSitemapSlug,
} from "./manifest";
import { localesOnOrigin, SeoConfigError } from "./policy.server";

/** URLs per child file: well under the protocol's 50,000, cheap on Workers. */
export const SEO_SITEMAP_PART_SIZE = 1_000;

/** The protocol's size limit for one uncompressed file. */
export const SEO_SITEMAP_MAX_BYTES = 50 * 1024 * 1024;

/** The protocol's limit on files in one index (and on URLs in one file). */
export const SEO_SITEMAP_MAX_FILES = 50_000;

/** Longer URLs are rejected by search engines, so they are left out. */
const MAX_URL_LENGTH = 2_048;

/** Delivery pages one request may read before answering. */
const INLINE_PAGE_BUDGET = 8;

/** Delivery pages one background run may read. */
const BACKGROUND_PAGE_BUDGET = 200;

/** Index files whose generations are resolved side by side. */
const SOURCE_CONCURRENCY = 2;

/** How long one instance owns an unfinished generation. */
const BUILD_LEASE_MS = 60_000;

/** One alternate of an app-owned URL, for `xhtml:link hreflang`. */
export interface SeoSitemapAlternate {
  /** A locale code, or `x-default`. */
  locale: string;
  /** A trusted origin; defaults to the web origin. */
  origin?: string;
  path: string;
}

/** One app-owned URL a {@link SeoSitemapListSource} lists. */
export interface SeoSitemapUrl {
  alternates?: readonly SeoSitemapAlternate[];
  /** Leave it out when there is no reliable modification date. */
  lastModified?: Date | null;
  /**
   * A configured origin (`VITNODE_WEB_URL` or an `i18n.domains` origin).
   * Defaults to the web origin; a URL on any other host is dropped.
   */
  origin?: string;
  /** The canonical pathname, e.g. `/docs/dev`. */
  path: string;
}

/**
 * A bounded, app-owned list of canonical URLs - the app's documentation, say
 * - published as `/sitemap-{id}-{n}.xml`. Read once per process and host,
 * since it only changes with a deployment.
 */
export interface SeoSitemapListSource {
  /** The file stem: lowercase letters, digits and dashes; not `pages`. */
  id: string;
  urls: () => Promise<readonly SeoSitemapUrl[]> | readonly SeoSitemapUrl[];
}

interface ListFile {
  file: string;
  kind: "list";
  source: SeoSitemapListSource;
}

interface ContentFile {
  file: string;
  kind: "content";
  locale: null | string;
  source: SeoContentSitemapSource;
  tags: string[];
}

type SitemapFile = ContentFile | ListFile;

interface PartRecord {
  /** The cursor after this part, `null` for the last. */
  end: null | string;
  lastmod: null | string;
  /** The cursor this part starts from, `null` for the first. */
  start: null | string;
  urls: number;
}

/** A completed generation of one content file: what its parts are. */
interface GenerationRecord {
  /** After this, in ms, the generation is served while it is refreshed. */
  freshUntil: number;
  gen: string;
  parts: PartRecord[];
  startedAt: number;
}

/** An unfinished generation, built a few delivery pages at a time. */
interface BuildRecord {
  gen: string;
  leaseUntil: number;
  next: null | string;
  owner: string;
  parts: PartRecord[];
  startedAt: number;
}

interface IndexRecord {
  /** The generation of every content file the index was built from. */
  gens: Record<string, string>;
  xml: string;
}

interface ListPart {
  lastmod: Date | null;
  urls: number;
  xml: string;
}

/** What a sitemap request answers. */
export type SeoSitemapResult =
  | { etag: string; status: 200; xml: string }
  | { status: 404 }
  | { status: 503 };

/** Lets background work outlive the response. */
export type SeoBackground = (task: () => Promise<unknown>) => void;

interface Budget {
  pages: number;
}

const log = (message: string, error?: unknown): void => {
  // oxlint-disable-next-line no-console
  console.error(`[vitnode seo] ${message}`, error ?? "");
};

const randomId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const byteLength = (value: string): number =>
  new TextEncoder().encode(value).byteLength;

/** FNV-1a, for ETags. */
const fingerprint = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36);
};

const absoluteUrl = (origin: string, path: string): null | URL => {
  try {
    const url = new URL(path, origin);
    if (url.href.length > MAX_URL_LENGTH) return null;

    return url;
  } catch {
    return null;
  }
};

const latest = (dates: readonly (Date | null | undefined)[]): Date | null => {
  let max: Date | null = null;
  for (const date of dates) {
    if (!date || Number.isNaN(date.getTime())) continue;
    if (max === null || date > max) max = date;
  }

  return max;
};

const mapLimit = async <T, R>(
  items: readonly T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = Array.from({ length: items.length });
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await run(items[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );

  return results;
};

/**
 * Serializes `entries` into one or more `<urlset>` documents, each within the
 * byte limit: a document over it is split in half until every half fits.
 */
const serializeWithinLimit = <T>(
  entries: readonly T[],
  serialize: (slice: readonly T[]) => string,
): string[] => {
  const xml = serialize(entries);
  if (byteLength(xml) <= SEO_SITEMAP_MAX_BYTES) return [xml];
  if (entries.length <= 1) {
    throw new SeoSitemapSourceError(
      "One sitemap URL is larger than the 50 MB file limit.",
    );
  }
  const half = Math.ceil(entries.length / 2);

  return [
    ...serializeWithinLimit(entries.slice(0, half), serialize),
    ...serializeWithinLimit(entries.slice(half), serialize),
  ];
};

export interface SeoSitemapEngineOptions {
  cache: SeoSitemapCache;
  fetchPage: SeoContentSitemapFetch;
  listSources: readonly SeoSitemapListSource[];
  manifest: SeoSitemapManifest;
  policy: ResolvedSeoPolicy;
  routing: LocaleRouting;
}

/**
 * Generates and caches the site's sitemap index and child files.
 *
 * - App paths and list sources are deterministic per deployment, so they are
 *   chunked once per process and host.
 * - Each content file (content type, locale, host) is a *generation*: its
 *   delivery pages are read in cursor order, each page stored as one part,
 *   and the generation's part list is published only once every part is
 *   stored. A request reads at most a few pages; the rest continue in the
 *   background, and until a generation is complete the previous one is
 *   served - unless it was hard-invalidated, which answers `503` rather than
 *   listing a URL that left the public site.
 * - A child request reads its part directly from the published part list,
 *   never walking the cursors before it.
 * - The index records which generation of each file it lists, so it is
 *   rebuilt as soon as any of them changes.
 */
export const createSeoSitemapEngine = ({
  cache,
  fetchPage,
  listSources,
  manifest,
  policy,
  routing,
}: SeoSitemapEngineOptions) => {
  const owner = randomId();
  const revision = manifest.revision;
  const inflight = new Map<string, Promise<GenerationRecord | null>>();
  const listParts = new Map<string, Promise<ListPart[]>>();
  const filesByOrigin = new Map<string, SitemapFile[]>();

  for (const source of listSources) {
    if (!SEO_SITEMAP_FILE_PATTERN.test(source.id) || source.id === "pages") {
      throw new SeoConfigError(
        `Sitemap source id "${source.id}" must be lowercase letters, digits and dashes, and not "pages".`,
      );
    }
  }

  const pagesSource: SeoSitemapListSource = {
    id: "pages",
    urls: () =>
      policy.sitemap.paths.flatMap(path => {
        const alternates = routing.alternatesFor(path);
        const fallback = alternates.find(
          alternate => alternate.locale === routing.defaultLocale,
        );
        const links: SeoSitemapAlternate[] = [
          ...alternates.map(alternate => ({
            locale: alternate.locale,
            ...(alternate.origin === undefined
              ? {}
              : { origin: alternate.origin }),
            path: alternate.pathname,
          })),
          ...(fallback && alternates.length > 1
            ? [
                {
                  locale: "x-default",
                  ...(fallback.origin === undefined
                    ? {}
                    : { origin: fallback.origin }),
                  path: fallback.pathname,
                },
              ]
            : []),
        ];

        return alternates.map(alternate => ({
          alternates: alternates.length > 1 ? links : [],
          ...(alternate.origin === undefined
            ? {}
            : { origin: alternate.origin }),
          path: alternate.pathname,
        }));
      }),
  };

  const trustedOrigins = (webOrigin: string): Set<string> =>
    new Set([webOrigin, ...routing.domains.map(domain => domain.origin)]);

  const filesFor = (origin: string, webOrigin: string): SitemapFile[] => {
    const known = filesByOrigin.get(origin);
    if (known) return known;

    const files: SitemapFile[] = [
      ...(policy.sitemap.paths.length > 0
        ? [{ file: "pages", kind: "list" as const, source: pagesSource }]
        : []),
      ...listSources.map(source => ({
        file: source.id,
        kind: "list" as const,
        source,
      })),
    ];
    const locales = localesOnOrigin(routing, origin, webOrigin);
    const defaultOrigin =
      routing.domainForLocale(routing.defaultLocale)?.origin ?? webOrigin;

    for (const source of manifest.sources) {
      if (source.localized) {
        for (const locale of locales) {
          files.push({
            file: `${source.file}-${seoSitemapSlug(locale)}`,
            kind: "content",
            locale,
            source,
            tags: [
              contentDeliverySitemapTag(source.contentTypeId),
              contentDeliverySitemapTag(source.contentTypeId, locale),
            ],
          });
        }
      } else if (defaultOrigin === origin) {
        files.push({
          file: source.file,
          kind: "content",
          locale: null,
          source,
          tags: [contentDeliverySitemapTag(source.contentTypeId)],
        });
      }
    }

    const seen = new Set<string>();
    for (const { file } of files) {
      if (!SEO_SITEMAP_FILE_PATTERN.test(file) || seen.has(file)) {
        throw new SeoConfigError(
          `Two sitemap sources would publish "/sitemap-${file}-1.xml". Rename the app's sitemap source.`,
        );
      }
      seen.add(file);
    }

    filesByOrigin.set(origin, files);

    return files;
  };

  // --- App-owned lists ------------------------------------------------------

  const buildListParts = async (
    file: ListFile,
    origin: string,
    webOrigin: string,
  ): Promise<ListPart[]> => {
    const trusted = trustedOrigins(webOrigin);
    const urls = await file.source.urls();
    const seen = new Set<string>();
    const entries: {
      alternates: SeoSitemapAlternate[];
      lastModified: Date | null;
      loc: URL;
    }[] = [];

    for (const url of urls) {
      const own = url.origin ?? webOrigin;
      if (own !== origin || !trusted.has(own)) continue;
      const loc = absoluteUrl(own, url.path);
      if (loc === null || seen.has(loc.href)) continue;
      seen.add(loc.href);
      entries.push({
        alternates: (url.alternates ?? []).filter(alternate =>
          trusted.has(alternate.origin ?? webOrigin),
        ),
        lastModified: url.lastModified ?? null,
        loc,
      });
    }

    const parts: ListPart[] = [];
    for (
      let start = 0;
      start < entries.length;
      start += SEO_SITEMAP_PART_SIZE
    ) {
      const slice = entries.slice(start, start + SEO_SITEMAP_PART_SIZE);
      for (const xml of serializeWithinLimit(slice, chunk =>
        contentSitemapXml({
          alternates: new Map(
            chunk.flatMap((entry, index) =>
              entry.alternates.length > 0
                ? [
                    [
                      index,
                      entry.alternates.map(alternate => ({
                        locale: alternate.locale,
                        origin: alternate.origin ?? webOrigin,
                        path: alternate.path,
                      })),
                    ] as const,
                  ]
                : [],
            ),
          ),
          entries: chunk.map((entry, index) => ({
            itemId: index,
            lastModified: entry.lastModified,
            origin: entry.loc.origin,
            path: `${entry.loc.pathname}${entry.loc.search}`,
          })),
          origin,
        }),
      )) {
        parts.push({
          lastmod: latest(slice.map(entry => entry.lastModified)),
          urls: slice.length,
          xml,
        });
      }
    }

    return parts;
  };

  const listPartsFor = async (
    file: ListFile,
    origin: string,
    webOrigin: string,
  ): Promise<ListPart[]> => {
    const key = `${origin}|${file.file}`;
    let pending = listParts.get(key);
    if (!pending) {
      pending = buildListParts(file, origin, webOrigin).catch(
        (error: unknown) => {
          listParts.delete(key);
          throw error;
        },
      );
      listParts.set(key, pending);
    }

    return await pending;
  };

  // --- Content generations ------------------------------------------------

  const keyOf = (kind: string, origin: string, file: string): string =>
    `${revision}:${kind}:${encodeURIComponent(origin)}:${file}`;
  const partKey = (
    origin: string,
    file: string,
    gen: string,
    part: number,
  ): string => `${keyOf("x", origin, file)}:${gen}:${String(part)}`;

  const PART_TTL =
    SEO_SITEMAP_TTL_SECONDS * 2 +
    SEO_SITEMAP_INDEX_TTL_SECONDS +
    SEO_SITEMAP_BUILD_TTL_SECONDS;

  const serializeContentPart = (
    entries: readonly SeoContentSitemapEntry[],
    origin: string,
    webOrigin: string,
  ): { lastmod: Date | null; urls: number; xml: string } => {
    const seen = new Set<string>();
    const kept: (SeoContentSitemapEntry & { loc: URL })[] = [];
    for (const entry of entries) {
      // Each host lists only its own URLs: a locale served from another
      // domain is in that domain's sitemap.
      if ((entry.origin ?? webOrigin) !== origin) continue;
      const loc = absoluteUrl(origin, entry.path);
      if (loc === null || seen.has(loc.href)) continue;
      seen.add(loc.href);
      kept.push({ ...entry, loc });
    }
    const [xml, ...rest] = serializeWithinLimit(kept, chunk =>
      contentSitemapXml({
        entries: chunk.map((entry, index) => ({
          changeFrequency: entry.changeFrequency,
          itemId: index,
          lastModified: entry.lastModified,
          path: `${entry.loc.pathname}${entry.loc.search}`,
          priority: entry.priority,
        })),
        origin,
      }),
    );
    if (rest.length > 0) {
      throw new SeoSitemapSourceError(
        "One delivery page does not fit in one 50 MB sitemap file.",
      );
    }

    return {
      lastmod: latest(kept.map(entry => entry.lastModified)),
      urls: kept.length,
      xml,
    };
  };

  /**
   * Reads up to `budget.pages` delivery pages of `file`'s current generation
   * and stores each as a part. Publishes the generation once its last page is
   * stored, unless the file was invalidated after it started - an older read
   * never replaces a newer invalidation.
   */
  const advance = async (
    file: ContentFile,
    origin: string,
    webOrigin: string,
    budget: Budget,
  ): Promise<GenerationRecord | null> => {
    const buildKey = keyOf("b", origin, file.file);
    const manifestKey = keyOf("m", origin, file.file);
    let stored = await cache.get<BuildRecord>(buildKey);

    if (stored) {
      const state = await seoCachedState(cache, file.tags, stored.startedAt);
      if (state !== "fresh") {
        stored = null;
      } else if (stored.owner !== owner && stored.leaseUntil > Date.now()) {
        // Another instance is building it; serve what there is meanwhile.
        return null;
      }
    }

    const build: BuildRecord = stored
      ? { ...stored, owner, parts: [...stored.parts] }
      : {
          gen: randomId(),
          leaseUntil: 0,
          next: null,
          owner,
          parts: [],
          startedAt: Date.now(),
        };

    let done = false;
    while (budget.pages > 0) {
      budget.pages -= 1;
      const page = await fetchPage({
        cursor: build.next,
        limit: SEO_SITEMAP_PART_SIZE,
        locale: file.locale,
        source: file.source,
      });
      if (page.nextCursor !== null && page.nextCursor === build.next) {
        throw new SeoSitemapSourceError(
          `${file.source.contentTypeId} returned the cursor it was given; its sitemap cannot advance.`,
        );
      }

      const part = serializeContentPart(page.entries, origin, webOrigin);
      build.parts.push({
        end: page.nextCursor,
        lastmod: part.lastmod?.toISOString() ?? null,
        start: build.next,
        urls: part.urls,
      });
      await cache.set(
        partKey(origin, file.file, build.gen, build.parts.length),
        part.xml,
        PART_TTL,
      );
      build.next = page.nextCursor;

      if (page.nextCursor === null) {
        done = true;
        break;
      }
      if (build.parts.length >= SEO_SITEMAP_MAX_FILES) {
        throw new SeoSitemapSourceError(
          `${file.source.contentTypeId} needs more than ${String(SEO_SITEMAP_MAX_FILES)} sitemap files.`,
        );
      }
    }

    if (!done) {
      build.leaseUntil = Date.now() + BUILD_LEASE_MS;
      await cache.set(buildKey, build, SEO_SITEMAP_BUILD_TTL_SECONDS);

      return null;
    }

    await cache.delete(buildKey);
    const [state, current] = await Promise.all([
      seoCachedState(cache, file.tags, build.startedAt),
      cache.get<GenerationRecord>(manifestKey),
    ]);
    if (current && current.startedAt > build.startedAt) return current;

    const record: GenerationRecord = {
      freshUntil: build.startedAt + SEO_SITEMAP_TTL_SECONDS * 1000,
      gen: build.gen,
      parts: build.parts,
      startedAt: build.startedAt,
    };
    if (state !== "fresh") {
      // Invalidated around the time it started. Read entirely after a hard
      // invalidation by this clock, it may answer the request that built it,
      // but it is not published: another server's clock may disagree.
      const hardAt = await cache.invalidatedAt(file.tags, "hard");

      return hardAt < build.startedAt ? record : null;
    }

    const lifetime =
      SEO_SITEMAP_TTL_SECONDS * 2 - (Date.now() - build.startedAt) / 1000;
    if (lifetime <= 0) return null;
    await cache.set(manifestKey, record, lifetime);

    return record;
  };

  /** One advance per file at a time in this process. */
  const advanceOnce = async (
    file: ContentFile,
    origin: string,
    webOrigin: string,
    budget: Budget,
  ): Promise<GenerationRecord | null> => {
    const key = keyOf("b", origin, file.file);
    const running = inflight.get(key);
    if (running) return await running;

    const task = advance(file, origin, webOrigin, budget).finally(() => {
      inflight.delete(key);
    });
    inflight.set(key, task);

    return await task;
  };

  const continueInBackground = (
    background: SeoBackground,
    file: ContentFile,
    origin: string,
    webOrigin: string,
  ): void => {
    background(async () => {
      const budget = { pages: BACKGROUND_PAGE_BUDGET };
      while (budget.pages > 0) {
        const before = budget.pages;
        const record = await advanceOnce(file, origin, webOrigin, budget);
        if (record !== null || budget.pages === before) return;
      }
    });
  };

  /**
   * The generation of `file` that may be served now, or `null` when there is
   * none: no completed generation, or only one a hard invalidation retired.
   */
  const usableGeneration = async (
    file: ContentFile,
    origin: string,
    webOrigin: string,
    budget: Budget,
    background: SeoBackground,
  ): Promise<GenerationRecord | null> => {
    const current = await cache.get<GenerationRecord>(
      keyOf("m", origin, file.file),
    );
    if (current) {
      const state = await seoCachedState(cache, file.tags, current.startedAt);
      if (state === "fresh" && current.freshUntil > Date.now()) return current;
      if (state !== "invalid") {
        continueInBackground(background, file, origin, webOrigin);

        return current;
      }
    }

    try {
      const built = await advanceOnce(file, origin, webOrigin, budget);
      if (built) return built;
    } catch (error) {
      log(`The ${file.file} sitemap could not be generated.`, error);

      return null;
    }
    continueInBackground(background, file, origin, webOrigin);

    return null;
  };

  // --- Requests ------------------------------------------------------------

  const servableIndex = async (
    origin: string,
    webOrigin: string,
    background: SeoBackground,
  ): Promise<SeoSitemapResult> => {
    const files = filesFor(origin, webOrigin);
    const budget = { pages: INLINE_PAGE_BUDGET };
    type Resolved =
      | { file: ContentFile; generation: GenerationRecord | null }
      | { file: ListFile; parts: ListPart[] };
    const resolved = await mapLimit(
      files,
      SOURCE_CONCURRENCY,
      async (file): Promise<Resolved> =>
        file.kind === "list"
          ? {
              file,
              parts: await listPartsFor(file, origin, webOrigin),
            }
          : {
              file,
              generation: await usableGeneration(
                file,
                origin,
                webOrigin,
                budget,
                background,
              ),
            },
    );

    const gens: Record<string, string> = {};
    const entries: { lastModified?: Date; path: string }[] = [];
    for (const item of resolved) {
      if ("parts" in item) {
        if (item.parts.every(part => part.urls === 0)) continue;
        item.parts.forEach((part, index) => {
          entries.push({
            ...(part.lastmod ? { lastModified: part.lastmod } : {}),
            path: seoSitemapChildPath(item.file.file, index + 1),
          });
        });
        continue;
      }
      // An index without one of its sources would quietly drop its URLs.
      if (item.generation === null) return { status: 503 };
      gens[item.file.file] = item.generation.gen;
      if (item.generation.parts.every(part => part.urls === 0)) continue;
      item.generation.parts.forEach((part, index) => {
        entries.push({
          ...(part.lastmod ? { lastModified: new Date(part.lastmod) } : {}),
          path: seoSitemapChildPath(item.file.file, index + 1),
        });
      });
    }
    if (entries.length > SEO_SITEMAP_MAX_FILES) {
      log(
        `The sitemap index for ${origin} would list more than ${String(SEO_SITEMAP_MAX_FILES)} files.`,
      );

      return { status: 503 };
    }

    const etag = `W/"${fingerprint(`${revision}|${JSON.stringify(gens)}`)}"`;
    const indexKey = keyOf("i", origin, "index");
    const cached = await cache.get<IndexRecord>(indexKey);
    if (cached && JSON.stringify(cached.gens) === JSON.stringify(gens)) {
      return { etag, status: 200, xml: cached.xml };
    }

    const xml = contentSitemapIndexXml({ entries, origin });
    await cache.set(
      indexKey,
      { gens, xml } satisfies IndexRecord,
      SEO_SITEMAP_INDEX_TTL_SECONDS,
    );

    return { etag, status: 200, xml };
  };

  const servableChild = async (
    origin: string,
    webOrigin: string,
    name: string,
    part: number,
    background: SeoBackground,
  ): Promise<SeoSitemapResult> => {
    const file = filesFor(origin, webOrigin).find(
      candidate => candidate.file === name,
    );
    if (!file) return { status: 404 };

    if (file.kind === "list") {
      const parts = await listPartsFor(file, origin, webOrigin);
      const found = parts[part - 1];
      if (!found) {
        // A list with nothing on this host still answers its first file.
        return part === 1 && parts.length === 0
          ? {
              etag: `W/"${fingerprint(`${revision}|${name}|empty`)}"`,
              status: 200,
              xml: contentSitemapXml({ entries: [], origin }),
            }
          : { status: 404 };
      }

      return {
        etag: `W/"${fingerprint(`${revision}|${name}|${String(part)}`)}"`,
        status: 200,
        xml: found.xml,
      };
    }

    const budget = { pages: INLINE_PAGE_BUDGET };
    const generation = await usableGeneration(
      file,
      origin,
      webOrigin,
      budget,
      background,
    );
    if (generation === null) return { status: 503 };

    const record = generation.parts[part - 1] as PartRecord | undefined;
    if (!record) return { status: 404 };

    const etag = `W/"${fingerprint(`${revision}|${generation.gen}|${String(part)}`)}"`;
    const key = partKey(origin, file.file, generation.gen, part);
    const cached = await cache.get<string>(key);
    if (cached !== null) return { etag, status: 200, xml: cached };

    // Evicted: read just this part again from the cursor it starts at. A
    // different end cursor means the data moved under the generation, so it
    // is retired rather than served with gaps or duplicates.
    try {
      const page = await fetchPage({
        cursor: record.start,
        limit: SEO_SITEMAP_PART_SIZE,
        locale: file.locale,
        source: file.source,
      });
      if (page.nextCursor !== record.end) {
        await cache.delete(keyOf("m", origin, file.file));
        continueInBackground(background, file, origin, webOrigin);

        return { status: 503 };
      }
      const { xml } = serializeContentPart(page.entries, origin, webOrigin);
      await cache.set(key, xml, PART_TTL);

      return { etag, status: 200, xml };
    } catch (error) {
      log(
        `Part ${String(part)} of the ${name} sitemap could not be read.`,
        error,
      );

      return { status: 503 };
    }
  };

  return {
    /** `/sitemap.xml` for one trusted origin. */
    index: async ({
      background,
      origin,
      webOrigin,
    }: {
      background: SeoBackground;
      origin: string;
      webOrigin: string;
    }): Promise<SeoSitemapResult> => {
      try {
        return await servableIndex(origin, webOrigin, background);
      } catch (error) {
        log(`The sitemap index for ${origin} could not be generated.`, error);

        return { status: 503 };
      }
    },
    /** `/sitemap-{file}-{part}.xml` for one trusted origin. */
    child: async ({
      background,
      file,
      origin,
      part,
      webOrigin,
    }: {
      background: SeoBackground;
      file: string;
      origin: string;
      part: number;
      webOrigin: string;
    }): Promise<SeoSitemapResult> => {
      try {
        return await servableChild(origin, webOrigin, file, part, background);
      } catch (error) {
        if (error instanceof SeoConfigError) throw error;
        log(`The ${file} sitemap could not be generated.`, error);

        return { status: 503 };
      }
    },
  };
};

export type SeoSitemapEngine = ReturnType<typeof createSeoSitemapEngine>;
