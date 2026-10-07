import type { Context } from "hono";

import type { AnyContentTypeDefinition } from "../types";
import type {
  ContentEditorialEffectsOptions,
  ContentEditorialEffectsResult,
} from "./editorial-effects";
import type { ContentEditorialOutcome } from "./editorial-service";
import type { AnyContentModel } from "./model";
import type { ContentRevalidationRequest } from "./revalidate-bridge";
import type { ContentVisibilityChange } from "./visibility";

import {
  contentLocaleInvalidations,
  diffContentPublicLocaleStates,
} from "../cache";
import { contentEditorialEffects } from "./editorial-effects";
import { contentDefinitionOf } from "./model";
import { contentPublicLocaleStates } from "./public-locales";
import { dispatchContentRevalidation } from "./revalidate-bridge";

export interface ContentVisibilityEffectsResult extends ContentEditorialEffectsResult {
  /** The front-end cache notification. `attempted: 0` means nothing to tell. */
  revalidation: { attempted: number; delivered: number };
}

const NOTHING: ContentVisibilityEffectsResult = {
  event: null,
  revalidation: { attempted: 0, delivered: 0 },
  search: null,
};

/**
 * What a hide or an unhide expires, in the shape the revalidation bridge takes.
 *
 * Built from the reachability the service measured on both sides of its write,
 * never from the operation's name: hiding a draft expires nothing, because there
 * was no public page to take down.
 */
export const contentVisibilityRevalidation = async (
  c: Context,
  model: AnyContentModel,
  {
    row,
    visibility,
  }: {
    row: Record<string, unknown>;
    visibility: ContentVisibilityChange;
  },
): Promise<ContentRevalidationRequest> => {
  const definition: AnyContentTypeDefinition = contentDefinitionOf(model);
  const { isPublic, wasPublic } = visibility;
  const id = typeof row.id === "number" ? row.id : 0;
  const slug = definition.publicApi.enabled
    ? row[definition.publicApi.slugField]
    : undefined;

  // A hidden record is hidden in every language, so each locale that had a page
  // - its own or the fallback's - or has one now is expired. The before-state is
  // the same row with the visibility columns it held a moment ago.
  const locales =
    definition.localization.enabled && definition.publicApi.enabled
      ? contentLocaleInvalidations({
          changed: "shared",
          defaultLocale: definition.localization.defaultLocale,
          fallback: definition.localization.fallback,
          states: diffContentPublicLocaleStates(
            await contentPublicLocaleStates(c, model, id, {
              row: { ...row, ...visibility.before },
            }),
            await contentPublicLocaleStates(c, model, id, { row }),
          ),
        })
      : undefined;

  return {
    contentTypeId: definition.id,
    // Exactly what `applyContentDeliveryWrite` reports for the same move: the file
    // changed when the record was or is listed in it, and the index only when it
    // appeared or disappeared.
    ...(definition.delivery.enabled
      ? {
          delivery: {
            sitemap: {
              contentChanged: wasPublic || isPublic,
              indexChanged: wasPublic !== isPublic,
            },
          },
        }
      : {}),
    id,
    isPublic,
    ...(locales === undefined ? {} : { locales }),
    // A hidden page must stop being served now, not after its next revalidation.
    mode: "immediate",
    slugs: typeof slug === "string" && slug !== "" ? [slug] : [],
    wasPublic,
  };
};

/**
 * Everything a committed hide or unhide announces, after the transaction.
 *
 * The event, the delivery events and the search document go through
 * `contentEditorialEffects` - the helper a publish uses - so a hidden record's
 * document turns private exactly the way an unpublished one does. Then the
 * configured front ends are told, like a scheduled publish tells them: hiding is
 * usually urgent, and a cached page that outlives it defeats the point.
 *
 * Works for both services: a content type without `editorial` hands in an
 * outcome with no revision, the same way the scheduled path builds one.
 */
export const contentVisibilityEffects = async (
  c: Context,
  model: AnyContentModel,
  outcome: ContentEditorialOutcome<AnyContentTypeDefinition>,
  { pluginId }: Pick<ContentEditorialEffectsOptions, "pluginId">,
): Promise<ContentVisibilityEffectsResult> => {
  if (!outcome.changed || !outcome.visibility) return NOTHING;

  const definition = contentDefinitionOf(model);
  const effects = await contentEditorialEffects(c, definition, outcome, {
    model,
    pluginId,
  });

  const revalidation = await dispatchContentRevalidation(
    c,
    await contentVisibilityRevalidation(c, model, {
      row: outcome.row,
      visibility: outcome.visibility,
    }),
  );

  return { ...effects, revalidation };
};
