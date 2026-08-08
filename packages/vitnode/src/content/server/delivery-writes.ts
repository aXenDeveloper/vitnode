import type { Context } from "hono";

import type { AnyContentTypeDefinition } from "../types";
import type { ContentDatabase } from "./service";
import type { ContentSlugHistoryModel } from "./slug-history-model";

import { contentDeliveryPath } from "../delivery";
import { createContentSlugHistoryModel } from "./slug-history-model";

/**
 * What one mutation did to a record's public URLs.
 *
 * Carried on the editorial outcome so the post-commit effects can emit the delivery
 * events and pick the cache tags without re-reading anything: once the transaction
 * returns, the *old* URL is gone from the row, and it is the one fact that cannot be
 * recovered afterwards - the same reason `previousSlug` is already on the outcome.
 *
 * Optional on both outcome types rather than required, which is what keeps every
 * Stage 1-7 construction site compiling untouched and every content type without
 * delivery producing exactly the outcome it always produced.
 */
export interface ContentDeliveryOutcome {
  /** The path the record answers to after this mutation. */
  canonicalPath: null | string;
  itemId: number;
  /** `null` when the slug is shared - see `core_content_slug_history`. */
  locale: null | string;
  /** The path it answered to before, when the mutation moved it. */
  previousPath: null | string;
  previousSlug: null | string;
  /**
   * Whether a historical URL became a redirect.
   *
   * `true` only when the old slug had genuinely been publicly addressable, which is
   * the difference between "somebody fixed a typo in a draft" and "a live URL
   * moved". It is what the `delivery_redirect_created` event is gated on.
   */
  redirectCreated: boolean;
  /** Whether the set of URLs a sitemap lists changed. */
  sitemapChanged: boolean;
  /** The slug the record answers to now, or `null` once it is deleted. */
  slug: null | string;
  /** Whether the canonical URL is different from what it was. */
  slugChanged: boolean;
}

/**
 * One record's addressability, before and after a mutation.
 *
 * Supplied by the caller rather than derived here, because only the caller knows:
 * it holds the row on both sides of its own guarded write, and re-reading would
 * both cost a query and race with a concurrent writer.
 */
export interface ContentDeliveryTransition {
  /** Whether the record is publicly reachable *after* the mutation. */
  isPublic: boolean;
  itemId: number;
  /** `null` when the slug is shared. */
  languageId: null | number;
  /** The canonical locale code, or `null` when the slug is shared. */
  locale: null | string;
  previousSlug: null | string;
  slug: null | string;
  /** Whether it was publicly reachable *before*. */
  wasPublic: boolean;
}

/**
 * The delivery half of one slug-bearing mutation, inside its transaction.
 *
 * The order below is the whole correctness argument, and it is why this is one
 * function rather than three calls sprinkled through the editorial services:
 *
 * 1. **Retire the old address first.** It has to stop being the record's current
 *    slug before the new one can be reserved, or a move from `a` to `b` and back to
 *    `a` would hit its own live reservation.
 * 2. **Reserve the new one second**, and only when the record is publicly
 *    reachable. A draft has no public URL, so reserving its slug would hand out a
 *    permanent claim on a URL that was never live - and then refuse it to somebody
 *    who wants it.
 * 3. **Report, never act.** Nothing here emits an event, writes a cache tag or
 *    calls the search index. The caller is inside a transaction that may still roll
 *    back, and a rollback cannot un-send any of those.
 *
 * `retire` returning `{ retired: false }` is not a failure: it is the answer to
 * "was that slug ever a live URL", and a `false` is what keeps a corrected draft
 * from creating a redirect nobody asked for.
 */
export const applyContentDeliveryWrite = async ({
  definition,
  slugHistory,
  transition,
  tx,
}: {
  definition: AnyContentTypeDefinition;
  /** `null` for a content type with `delivery` but no `redirects`. */
  slugHistory: ContentSlugHistoryModel | null;
  transition: ContentDeliveryTransition;
  tx: ContentDatabase;
}): Promise<ContentDeliveryOutcome> => {
  const {
    isPublic,
    itemId,
    languageId,
    locale,
    previousSlug,
    slug,
    wasPublic,
  } = transition;
  const pathFor = (value: null | string): null | string =>
    value === null
      ? null
      : contentDeliveryPath({ definition, locale, slug: value });

  const canonicalPath = pathFor(slug);
  const previousPath = pathFor(previousSlug);
  const slugChanged =
    previousSlug !== null && slug !== null && previousSlug !== slug;

  let redirectCreated = false;

  if (slugHistory !== null) {
    if (slugChanged && previousSlug !== null) {
      const { retired } = await slugHistory.retire(tx, {
        itemId,
        languageId,
        slug: previousSlug,
      });
      // A retired row is proof the URL was live: it is only ever written by a
      // publish or by a slug change on an already-public record.
      redirectCreated = retired;
    }

    if (isPublic && slug !== null && canonicalPath !== null) {
      // Reserved whenever the record is publicly reachable *now*, whether or not
      // the slug moved: this is also the publish path, where the address becomes
      // live for the first time. Idempotent, so a republish of an unchanged slug
      // re-activates the row it already has - and it throws when another record
      // owns the address, which is the reservation being enforced.
      await slugHistory.reserve(tx, {
        itemId,
        languageId,
        locale,
        path: canonicalPath,
        slug,
      });
    } else if (slug !== null && slug !== previousSlug) {
      // A draft taking a *new* slug is checked but not reserved. Not reserved,
      // because a draft has no public URL and claiming one would refuse a live
      // address to somebody who wants it; checked, because telling an editor "that
      // address is taken" at save time is far better than at publish time, when
      // they have moved on.
      await slugHistory.assertAvailable(tx, {
        itemId,
        languageId,
        locale,
        slug,
      });
    }
  }

  return {
    canonicalPath,
    itemId,
    locale,
    previousPath: slugChanged ? previousPath : null,
    previousSlug: slugChanged ? previousSlug : null,
    redirectCreated,
    // A line is added, removed or moved when public reachability changed or when
    // the URL did. An edit that only changed what an already-listed page says
    // leaves the sitemap byte-identical.
    sitemapChanged: wasPublic !== isPublic || slugChanged,
    slug,
    slugChanged,
  };
};

/** Builds the history model a content type with `delivery` writes through. */
export const contentSlugHistoryFor = ({
  c,
  definition,
  pluginId,
}: {
  c: Context;
  definition: AnyContentTypeDefinition;
  pluginId: string;
}): ContentSlugHistoryModel | null =>
  definition.delivery.enabled && definition.delivery.redirects.enabled
    ? createContentSlugHistoryModel({ c, definition, pluginId })
    : null;
