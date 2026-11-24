import type { ContentSitemapChangeFrequency } from "@vitnode/api/content/types";

import { isContentSitemapChangeFrequency } from "@vitnode/api/content/const";

import type { SeoContentSitemapSource } from "./manifest";

import { guestRawFetcher } from "../fetcher/server";

/** One URL of a content sitemap page, as the delivery route reports it. */
export interface SeoContentSitemapEntry {
  changeFrequency: ContentSitemapChangeFrequency | null;
  lastModified: Date | null;
  origin?: string;
  path: string;
  priority: null | number;
}

export interface SeoContentSitemapPage {
  entries: SeoContentSitemapEntry[];
  /** Opaque: only ever passed back as `cursor`. `null` on the last page. */
  nextCursor: null | string;
}

export interface SeoContentSitemapPageRequest {
  cursor: null | string;
  limit: number;
  /** `null` for a content type that is not localized. */
  locale: null | string;
  signal?: AbortSignal;
  source: SeoContentSitemapSource;
}

/**
 * Reads one page of a content type's `/delivery/sitemap` route. Internal: the
 * default is {@link fetchContentSitemapPage}; tests and unusual deployments
 * pass their own to `withSeo`.
 *
 * @throws When the source cannot confirm its answer - a network failure, a
 * non-`2xx` status or a body of the wrong shape. Never resolves with an empty
 * page it did not receive.
 */
export type SeoContentSitemapFetch = (
  request: SeoContentSitemapPageRequest,
) => Promise<SeoContentSitemapPage>;

/** Thrown when a sitemap source answers with something that is not a page. */
export class SeoSitemapSourceError extends Error {
  constructor(message: string) {
    super(`[VitNode SEO] ${message}`);
    this.name = "SeoSitemapSourceError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const REQUEST_TIMEOUT_MS = 10_000;

const readEntry = (value: unknown, where: string): SeoContentSitemapEntry => {
  if (!isRecord(value) || typeof value.path !== "string") {
    throw new SeoSitemapSourceError(
      `${where} returned an entry without a path.`,
    );
  }
  const lastModified =
    typeof value.lastModified === "string"
      ? new Date(value.lastModified)
      : null;

  return {
    changeFrequency: isContentSitemapChangeFrequency(value.changeFrequency)
      ? value.changeFrequency
      : null,
    lastModified:
      lastModified && !Number.isNaN(lastModified.getTime())
        ? lastModified
        : null,
    ...(typeof value.origin === "string" ? { origin: value.origin } : {}),
    path: value.path,
    priority:
      typeof value.priority === "number" &&
      value.priority >= 0 &&
      value.priority <= 1
        ? value.priority
        : null,
  };
};

/** Checks a delivery sitemap body. */
export const readContentSitemapPage = (
  body: unknown,
  where: string,
): SeoContentSitemapPage => {
  if (!isRecord(body) || !Array.isArray(body.entries)) {
    throw new SeoSitemapSourceError(`${where} did not return a sitemap page.`);
  }
  const { nextCursor } = body;
  if (
    nextCursor !== null &&
    typeof nextCursor !== "string" &&
    typeof nextCursor !== "number"
  ) {
    throw new SeoSitemapSourceError(`${where} returned an invalid nextCursor.`);
  }

  return {
    entries: body.entries.map(entry => readEntry(entry, where)),
    nextCursor: nextCursor === null ? null : String(nextCursor),
  };
};

/**
 * The default {@link SeoContentSitemapFetch}: an anonymous request with no
 * cookie or `Authorization`, in process when the API is mounted here and
 * over the network to `VITNODE_API_URL` otherwise. The API keeps its own
 * publication, visibility, locale and `noindex` filtering.
 *
 * In a single app the API's direct handler is registered only once its
 * route module loads, so `localTransport` - the app's own server entry -
 * answers the first requests in process instead of over the network.
 */
export const createContentSitemapFetch =
  ({
    localTransport,
  }: {
    /** Serves `/api/*` in this process when the API is mounted here. */
    localTransport?: (request: Request) => Promise<Response>;
  } = {}): SeoContentSitemapFetch =>
  async ({ cursor, limit, locale, signal, source }) => {
    const where = `${source.pluginId} ${source.module}${source.path}`;
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const response = await guestRawFetcher({
      localTransport,
      method: "get",
      module: source.module,
      options: {
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      },
      path: source.path,
      pluginId: source.pluginId,
      query: {
        cursor: cursor ?? undefined,
        limit: String(limit),
        locale: locale ?? undefined,
      },
    });

    if (!response.ok) {
      await response.body?.cancel();
      throw new SeoSitemapSourceError(
        `${where} answered ${String(response.status)}.`,
      );
    }

    return readContentSitemapPage(await response.json(), where);
  };
