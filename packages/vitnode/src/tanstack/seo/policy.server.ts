import type { LocaleRouting } from "@vitnode/api/lib/i18n/locale-routing";

/** Thrown when `buildServerConfig({ seo })` holds an invalid value. */
export class SeoConfigError extends Error {
  constructor(message: string) {
    super(`[VitNode SEO] ${message}`);
    this.name = "SeoConfigError";
  }
}

/** One named `User-agent` group the config adds to `/robots.txt`. */
export interface SeoCrawlerRule {
  /** `true` allows the site with the baseline exclusions; `false` is `Disallow: /`. */
  allow: boolean;
  token: string;
}

export interface ResolvedSeoPolicy {
  crawlers: readonly SeoCrawlerRule[];
  indexing: boolean;
  sitemap: {
    enabled: boolean;
    /** Normalized, deduplicated, unlocalized paths. */
    paths: readonly string[];
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const assertKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
  where: string,
): void => {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new SeoConfigError(
        `${where}.${key} is not an option. Use ${allowed.map(name => `\`${name}\``).join(", ")}.`,
      );
    }
  }
};

const optionalBoolean = (
  value: unknown,
  where: string,
): boolean | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new SeoConfigError(`${where} must be \`true\` or \`false\`.`);
  }

  return value;
};

/** The order bots appear in `/robots.txt`, so the file is deterministic. */
const CRAWLER_TOKENS = {
  anthropic: { search: "Claude-SearchBot", training: "ClaudeBot" },
  googleExtended: "Google-Extended",
  openai: { search: "OAI-SearchBot", training: "GPTBot" },
} as const;

const resolveCrawlers = (value: unknown): SeoCrawlerRule[] => {
  if (value === undefined) return [];
  if (!isRecord(value)) {
    throw new SeoConfigError("`seo.crawlers` must be an object.");
  }
  assertKeys(value, ["anthropic", "googleExtended", "openai"], "seo.crawlers");

  const rules: SeoCrawlerRule[] = [];
  for (const vendor of ["openai", "anthropic"] as const) {
    const pair = value[vendor];
    if (pair === undefined) continue;
    const where = `seo.crawlers.${vendor}`;
    if (!isRecord(pair))
      throw new SeoConfigError(`${where} must be an object.`);
    assertKeys(pair, ["search", "training"], where);

    for (const use of ["search", "training"] as const) {
      const allow = optionalBoolean(pair[use], `${where}.${use}`);
      if (allow !== undefined) {
        rules.push({ allow, token: CRAWLER_TOKENS[vendor][use] });
      }
    }
  }

  const gemini = optionalBoolean(
    value.googleExtended,
    "seo.crawlers.googleExtended",
  );
  if (gemini !== undefined) {
    rules.push({ allow: gemini, token: CRAWLER_TOKENS.googleExtended });
  }

  return rules;
};

const RESERVED_PREFIXES = ["/admin", "/api"];
const PATH_BASE = "https://vitnode.invalid";

/**
 * One `seo.sitemap.paths` entry as a canonical unlocalized path, or a thrown
 * {@link SeoConfigError} saying why it cannot be one.
 */
export const normalizeSeoSitemapPath = (
  value: unknown,
  locales: readonly string[] = [],
): string => {
  const where = `seo.sitemap.paths entry ${JSON.stringify(value)}`;
  if (typeof value !== "string" || value === "") {
    throw new SeoConfigError(`${where} must be a non-empty string.`);
  }
  if (!value.startsWith("/") || value.startsWith("//")) {
    throw new SeoConfigError(
      `${where} must be a path on this site starting with a single "/", like "/about".`,
    );
  }
  if (/[\\?#\s]/.test(value)) {
    throw new SeoConfigError(
      `${where} must not hold a query, a hash, whitespace or a backslash. List canonical URLs only.`,
    );
  }
  if (value.split("/").some(segment => segment === "." || segment === "..")) {
    throw new SeoConfigError(`${where} must not hold "." or ".." segments.`);
  }
  if (/\/{2,}/.test(value)) {
    throw new SeoConfigError(`${where} must not hold empty segments ("//").`);
  }

  let pathname: string;
  try {
    pathname = new URL(value, PATH_BASE).pathname;
  } catch {
    throw new SeoConfigError(`${where} is not a valid URL path.`);
  }
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  const lower = pathname.toLowerCase();
  if (
    RESERVED_PREFIXES.some(
      prefix => lower === prefix || lower.startsWith(`${prefix}/`),
    )
  ) {
    throw new SeoConfigError(
      `${where} is under /admin or /api, which are never public pages.`,
    );
  }

  const [, first] = pathname.split("/");
  if (first !== undefined && locales.includes(first)) {
    throw new SeoConfigError(
      `${where} starts with the locale "${first}". List the unlocalized path - every locale's URL is added for you.`,
    );
  }

  return pathname;
};

/**
 * Checks `buildServerConfig({ seo })` and fills in its defaults, or returns
 * `null` when `seo` is left out (the feature is off). Server-only.
 *
 * @throws {SeoConfigError} When a value is invalid or `indexing` is missing.
 */
export const resolveSeoPolicy = (
  value: unknown,
  { locales = [] }: { locales?: readonly string[] } = {},
): null | ResolvedSeoPolicy => {
  if (value === undefined) return null;
  if (!isRecord(value)) throw new SeoConfigError("`seo` must be an object.");
  assertKeys(value, ["crawlers", "indexing", "sitemap"], "seo");

  if (typeof value.indexing !== "boolean") {
    throw new SeoConfigError(
      "`seo.indexing` is required: `true` for a site search engines may index, `false` for a preview or staging deployment.",
    );
  }
  const { indexing } = value;

  let sitemapEnabled = indexing;
  let paths: string[] = [];
  if (value.sitemap !== undefined) {
    if (!isRecord(value.sitemap)) {
      throw new SeoConfigError("`seo.sitemap` must be an object.");
    }
    assertKeys(value.sitemap, ["enabled", "paths"], "seo.sitemap");
    sitemapEnabled =
      optionalBoolean(value.sitemap.enabled, "seo.sitemap.enabled") ?? indexing;

    const declared = value.sitemap.paths ?? [];
    if (!Array.isArray(declared)) {
      throw new SeoConfigError("`seo.sitemap.paths` must be an array.");
    }
    paths = [
      ...new Set(declared.map(path => normalizeSeoSitemapPath(path, locales))),
    ];
  }

  return {
    crawlers: resolveCrawlers(value.crawlers),
    indexing,
    // Indexing off wins: a sitemap invites crawlers to index what it lists.
    sitemap: { enabled: indexing && sitemapEnabled, paths },
  } satisfies ResolvedSeoPolicy;
};

/**
 * The trusted origin a request is served for: a configured locale domain when
 * the request's host is one, else the web origin (`VITNODE_WEB_URL`). The
 * request's own `Host` or forwarding headers only ever pick among configured
 * origins; they never become a URL.
 */
export const trustedOriginFor = (
  url: URL,
  routing: LocaleRouting,
  webOrigin: string,
): string => routing.domainForHost(url.host)?.origin ?? webOrigin;

/** The locales whose canonical URLs live on `origin`. */
export const localesOnOrigin = (
  routing: LocaleRouting,
  origin: string,
  webOrigin: string,
): string[] =>
  routing.locales.filter(
    locale => (routing.domainForLocale(locale)?.origin ?? webOrigin) === origin,
  );
