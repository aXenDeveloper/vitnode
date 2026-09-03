import type { Context } from "hono";

import type { ContentSitemapChange } from "../cache";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentDatabase } from "./service";
import type { ContentSlugHistoryModel } from "./slug-history-model";

import { contentDeliveryPath } from "../delivery";
import { createContentSlugHistoryModel } from "./slug-history-model";

export interface ContentDeliveryOutcome {
  /** The path the record answers to after this mutation. */
  canonicalPath: null | string;
  itemId: number;
  /** `null` when the slug is shared - see `core_content_slug_history`. */
  locale: null | string;
  /** The path it answered to before, when the mutation moved it. */
  previousPath: null | string;
  previousSlug: null | string;

  redirectCreated: boolean;

  sitemap: ContentSitemapChange;
  /** The slug the record answers to now, or `null` once it is deleted. */
  slug: null | string;
  /** Whether the canonical URL is different from what it was. */
  slugChanged: boolean;
}

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
    const leavingService = slugChanged || slug === null || !isPublic;

    // The lazy bootstrap, and the reason Stage 8 ships no backfill migration.
    //
    // A record published *before* this table existed has no row in it, so the
    // first mutation that moved it would find nothing to retire and
    // `/articles/hello` would simply be forgotten - a redirect the documentation
    // promises and the engine never wrote. Backfilling every content type at
    // migration time cannot fix that: the database has one slug per row and no
    // record of which historical values were ever public, so it would have to
    // choose between missing the same URLs and inventing redirects for slugs that
    // only ever existed on a draft.
    //
    // This mutation does not have to choose. It is holding the row on both sides
    // of its own write, so `wasPublic` is evidence: that address was reachable a
    // moment ago, and it is going away now. `previousPath !== null` is the second
    // half - an address the engine cannot even build a path for was never
    // addressable, so there is nothing to preserve.
    //
    // `ensureCurrent` rather than `reserve`: a row that is already on file is left
    // exactly as it stands. Establishing a missing fact and resurrecting a retired
    // address are different operations, and only the first one belongs here.
    if (
      wasPublic &&
      previousSlug !== null &&
      previousPath !== null &&
      leavingService
    ) {
      await slugHistory.ensureCurrent(tx, {
        itemId,
        languageId,
        locale,
        path: previousPath,
        slug: previousSlug,
      });
    }

    if (slugChanged && previousSlug !== null) {
      const { retired } = await slugHistory.retire(tx, {
        itemId,
        languageId,
        slug: previousSlug,
      });
      // A retired row is proof the URL was live: it is only ever written by a
      // publish, by a slug change on an already-public record, or by the
      // bootstrap above - which runs on the same proof.
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
    sitemap: {
      // Any real mutation of a record that is or was publicly reachable changes the
      // file: it gained a line, lost one, moved one, or moved its own `<lastmod>`.
      // This function is only ever reached for a real mutation - a no-op update
      // returns before the delivery step - so "was or is public" is the whole test.
      contentChanged: wasPublic || isPublic,
      // Only appearing or disappearing changes how many files an index lists. A slug
      // change rewrites one line inside a file; a title edit rewrites a timestamp.
      indexChanged: wasPublic !== isPublic,
    },
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
