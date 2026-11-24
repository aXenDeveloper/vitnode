import type { ContentRevalidationRequest } from "@vitnode/api/content/server/revalidate-bridge";

import {
  contentDeliverySitemapTag,
  contentInvalidationTags,
} from "@vitnode/api/content/cache";
import {
  CONTENT_REVALIDATE_MAX_SKEW_MS,
  CONTENT_REVALIDATE_TIMESTAMP_HEADER,
} from "@vitnode/api/content/server/revalidate-bridge";
import { CONFIG, isCronSecretRejected } from "@vitnode/api/lib/config";
import { invalidatePageCacheTags } from "@vitnode/api/page-cache/store.server";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === "string");

const digest = async (value: string): Promise<Uint8Array> =>
  new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );

/** Compares two secrets in constant time, through fixed-length digests. */
const sameSecret = async (
  given: string,
  expected: string,
): Promise<boolean> => {
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a[index] ^ b[index];
  }

  return difference === 0;
};

/** Whether a request carries the shared `CRON_SECRET` and a recent timestamp. */
export const isTrustedContentRevalidation = async (
  request: Request,
  secret: string = CONFIG.cronJobSecret,
): Promise<boolean> => {
  if (isCronSecretRejected(secret)) return false;

  const bearer = /^Bearer (.+)$/.exec(
    request.headers.get("authorization") ?? "",
  )?.[1];
  if (bearer === undefined || !(await sameSecret(bearer, secret))) {
    return false;
  }

  const sentAt = Number(
    request.headers.get(CONTENT_REVALIDATE_TIMESTAMP_HEADER),
  );

  return (
    Number.isFinite(sentAt) &&
    Math.abs(Date.now() - sentAt) <= CONTENT_REVALIDATE_MAX_SKEW_MS
  );
};

/** The body `dispatchContentRevalidation` posts, or `null`. */
export const readContentRevalidation = (
  body: unknown,
): ContentRevalidationRequest | null => {
  if (
    !isRecord(body) ||
    typeof body.contentTypeId !== "string" ||
    (typeof body.id !== "string" && typeof body.id !== "number") ||
    typeof body.isPublic !== "boolean" ||
    typeof body.wasPublic !== "boolean" ||
    !isStringArray(body.slugs) ||
    (body.mode !== "immediate" && body.mode !== "stale-while-revalidate")
  ) {
    return null;
  }
  const { delivery, locales } = body;
  if (
    locales !== undefined &&
    !(
      Array.isArray(locales) &&
      locales.every(
        entry =>
          isRecord(entry) &&
          typeof entry.locale === "string" &&
          typeof entry.isPublic === "boolean" &&
          typeof entry.wasPublic === "boolean" &&
          isStringArray(entry.slugs),
      )
    )
  ) {
    return null;
  }
  const sitemap = isRecord(delivery) ? delivery.sitemap : undefined;
  if (
    delivery !== undefined &&
    !(
      isRecord(sitemap) &&
      typeof sitemap.contentChanged === "boolean" &&
      typeof sitemap.indexChanged === "boolean"
    )
  ) {
    return null;
  }

  return body as unknown as ContentRevalidationRequest;
};

/**
 * The sitemap tags one revalidation expires: the same tags
 * `contentInvalidationTags` lists for it, narrowed to the content type's
 * sitemap files.
 */
export const contentRevalidationSitemapTags = (
  input: ContentRevalidationRequest,
): string[] => {
  const sitemapTags = new Set([
    contentDeliverySitemapTag(input.contentTypeId),
    ...(input.locales ?? []).map(entry =>
      contentDeliverySitemapTag(input.contentTypeId, entry.locale),
    ),
  ]);

  return contentInvalidationTags(input).filter(tag => sitemapTags.has(tag));
};

const answer = (status: number): Response =>
  new Response(null, { headers: { "cache-control": "no-store" }, status });

/**
 * Answers `POST /api/vitnode/content/revalidate` from an API that lists this
 * site in `content.revalidateOrigins`: checks the bearer `CRON_SECRET` in
 * constant time and the timestamp, then expires the affected sitemap files.
 * `immediate` is a hard invalidation - the old XML is never served again.
 */
export const handleContentRevalidation = async (
  request: Request,
  ensureStore: () => void,
): Promise<Response> => {
  if (!(await isTrustedContentRevalidation(request))) return answer(403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return answer(400);
  }
  const input = readContentRevalidation(body);
  if (input === null) return answer(400);

  const tags = contentRevalidationSitemapTags(input);
  if (tags.length === 0) return answer(204);

  ensureStore();
  const result = await invalidatePageCacheTags(tags, {
    mode: input.mode === "immediate" ? "hard" : "soft",
  });

  return answer(result.status === "failed" ? 503 : 204);
};
