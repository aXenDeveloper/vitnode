import type { Context } from "hono";

import type { ContentLocaleResolution } from "../locale";
import type { AnyContentTypeDefinition } from "../types";

import { resolveContentPublicLocale } from "../locale";
import { listContentLanguages } from "./language-resolver";

/**
 * Which language one public request of a content type is for. Server-only.
 *
 * `?locale=` wins, then `Accept-Language`, then the content type's default
 * locale. Only enabled languages count. `null` means an explicit locale this
 * install does not serve - answer it with a `404`, never with the default
 * language, or a Polish URL would be cached with English content.
 *
 * A nonlocalized content type always resolves to `{ locale: undefined }`.
 *
 * @example
 * ```ts
 * import { contentLocaleHeaders, resolveContentRequestLocale } from "@vitnode/core/content/server";
 *
 * const resolved = await resolveContentRequestLocale(c, categoryContent.definition);
 * if (!resolved) throw new HTTPException(404);
 *
 * return c.json(data, 200, contentLocaleHeaders(resolved));
 * ```
 */
export const resolveContentRequestLocale = async (
  c: Context,
  definition: AnyContentTypeDefinition,
): Promise<
  | null
  | { locale: string; source: ContentLocaleResolution["source"] }
  | { locale: undefined; source: "default" }
> => {
  if (!definition.localization.enabled) {
    return { locale: undefined, source: "default" };
  }

  const languages = await listContentLanguages(c);

  return resolveContentPublicLocale({
    acceptLanguage: c.req.header("accept-language"),
    // Only the locales this install actually serves. A disabled language is
    // readable in the AdminCP and unreachable in public, which is the read-side
    // half of the rule that already stops content being written into one.
    available: languages
      .filter(language => language.isEnabled)
      .map(language => language.locale),
    defaultLocale: definition.localization.defaultLocale,
    explicit: c.req.query("locale"),
  });
};

/**
 * The response headers a localized public read carries: `Content-Language`
 * with the resolved locale, plus `Vary: Accept-Language` only when the header
 * decided it - a response chosen by `?locale=` is keyed by its URL, and varying
 * on a header that decided nothing would fragment shared caches for nothing.
 * Empty for a nonlocalized content type.
 */
export const contentLocaleHeaders = ({
  locale,
  source,
}: {
  locale: string | undefined;
  source: ContentLocaleResolution["source"];
}): Record<string, string> => {
  if (locale === undefined) return {};

  return {
    "Content-Language": locale,
    ...(source === "negotiated" ? { Vary: "Accept-Language" } : {}),
  };
};
