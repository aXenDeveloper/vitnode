/**
 * The cache half of a localized mutation, for the AdminCP Server Actions.
 *
 * A plain module rather than another `"use server"` file: everything here is a
 * helper the actions call, not an action a browser may invoke, and a file with
 * that directive exports only React Server Functions - which would force the
 * synchronous invalidator below to become an `async` one for no reason.
 */
import { z } from "zod";

import type { ContentPublicLocaleState } from "@/content/cache";
import type { AnyContentTypeDefinition } from "@/content/types";

import { contentApiFetch } from "@/content/admin/fetch.server";
import {
  contentLocaleInvalidationMode,
  contentLocaleInvalidations,
  diffContentPublicLocaleStates,
} from "@/content/cache";
import { revalidateContent } from "@/content/next/revalidate.server";

const zodPublicLocales = z.object({
  edges: z.array(
    z.object({
      hasOwnTranslation: z.boolean(),
      isPublic: z.boolean(),
      locale: z.string(),
      slug: z.string(),
    }),
  ),
});

/**
 * Which languages the record is publicly reachable in, straight from the API.
 *
 * Read rather than worked out here, and that is the point: whether a locale has a
 * page depends on the base row, that locale's translation, the fallback setting
 * and the language registry. A Server Action can see none of those - it talks to
 * the API over HTTP - so the answer comes from the one place that evaluates the
 * rule, and there is no second copy to drift.
 *
 * `[]` for anything that is not a localized public content type, which is what
 * keeps every Stage 1-4 mutation on exactly the path it was on before.
 */
export const readContentPublicLocales = async (
  definition: AnyContentTypeDefinition,
  pluginId: string,
  id: number,
): Promise<ContentPublicLocaleState[]> => {
  if (!definition.publicApi.enabled || !definition.localization.enabled) {
    return [];
  }

  const result = await contentApiFetch({
    definition,
    method: "get",
    path: `/${id}/public-locales`,
    pluginId,
    schema: zodPublicLocales,
  });

  return result.data?.edges ?? [];
};

/**
 * Expires the per-locale cache entries one mutation actually affected.
 *
 * A localized content type has no locale-less public URL, so its tags are the
 * per-locale ones and nothing else - and which locales a mutation reaches is the
 * fan-out rule, which lives in `contentLocaleInvalidations` so a shared-field
 * edit and a Polish publish cannot disagree about it.
 */
export const invalidateContentLocales = (
  definition: AnyContentTypeDefinition,
  id: number,
  before: readonly ContentPublicLocaleState[],
  after: readonly ContentPublicLocaleState[],
  {
    changed = "shared",
    locale,
  }: {
    /** `"shared"` for a base-row mutation, `"translation"` for a locale's own. */
    changed?: "shared" | "translation";
    /** The locale that moved, for a translation mutation. */
    locale?: string;
  } = {},
): void => {
  if (!definition.publicApi.enabled || !definition.localization.enabled) return;

  const states = diffContentPublicLocaleStates(before, after);
  const reached = contentLocaleInvalidations({
    changed,
    defaultLocale: definition.localization.defaultLocale,
    fallback: definition.localization.fallback,
    locale,
    states,
  });

  revalidateContent(
    {
      contentTypeId: definition.id,
      // The delivery tags, for a content type with `delivery`. Absent otherwise,
      // which is what keeps a Stage 1-7 content type's tag list byte-identical.
      //
      // Derived from the locales this mutation actually **reached**, which is the
      // Stage 5 fan-out rather than a second locale-propagation rule: a shared field
      // reaches every locale, a translation reaches its own, and `sitemap:pl` is
      // expired exactly when Polish's public representation moved. That is also what
      // makes a plain title edit expire the right file - the sitemap's `<lastmod>` is
      // derived from `updatedAt`, so any real edit to a published translation changes
      // that file's bytes even though its URL did not move.
      ...(definition.delivery.enabled
        ? {
            delivery: {
              sitemap: {
                // Every reached locale that is or was public has a file whose bytes
                // moved. This helper is only called for a real mutation.
                contentChanged: reached.some(
                  entry => entry.isPublic || entry.wasPublic,
                ),
                // Only a locale appearing or disappearing changes how many files the
                // index lists.
                indexChanged: reached.some(
                  entry => entry.isPublic !== entry.wasPublic,
                ),
              },
            },
          }
        : {}),
      id,
      // Not consulted when `locales` is present, and supplied truthfully anyway:
      // a record is publicly reachable when any of its languages is.
      isPublic: after.some(state => state.isPublic),
      locales: reached,
      slugs: [],
      wasPublic: before.some(state => state.isPublic),
    },
    { mode: contentLocaleInvalidationMode(reached) },
  );
};
