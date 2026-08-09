import type { Context } from "hono";

import type { EventEmitResult } from "../../api/models/events";
import type { ContentDeliveryInvalidation } from "../cache";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentDeliveryOutcome } from "./delivery-writes";

import { reportContentEventFailures } from "./effects-log";
import { emitContentEvent } from "./emit";

export interface ContentDeliveryEffectsResult {
  /**
   * What the event transport reported for each delivery event, in the order they
   * were emitted. Empty when the mutation moved no URL.
   *
   * Present rather than discarded for the same reason the editorial effects keep
   * theirs: `EventsModel.emit` does not throw, so `failures` is the only place a
   * dead listener or a broker outage is visible.
   */
  events: EventEmitResult[];
}

/**
 * The delivery events one mutation owes the rest of the system, after it commits.
 *
 * Two events at most, and each one is gated on a fact rather than on an operation:
 *
 * - **`delivery_slug_changed`** whenever the canonical URL is different from what
 *   it was. Emitted *alongside* `updated` or `restored`, never instead of one: the
 *   field mutation and the URL change are different facts with different audiences,
 *   and a listener that warms a CDN or writes an edge redirect table would
 *   otherwise have to inspect `changedFields` for a slug field whose name it cannot
 *   know.
 * - **`delivery_redirect_created`** only when the old address had genuinely been
 *   live. A draft whose slug was corrected three times before it was ever published
 *   emits nothing at all, which is the difference between "a URL now needs a
 *   redirect" and "somebody edited a field".
 *
 * There is deliberately no sitemap event. Every mutation that changes a sitemap
 * line already emits `published`, `unpublished`, `deleted` or one of the two above,
 * and a fifth event carrying no new information would be one more thing to keep
 * consistent for no listener's benefit.
 *
 * **Call it only after the write has returned - never inside the transaction.** A
 * rollback cannot un-emit an event.
 */
export const contentDeliveryEffects = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  delivery: ContentDeliveryOutcome | undefined,
  { pluginId }: { pluginId: string },
): Promise<ContentDeliveryEffectsResult> => {
  const events: EventEmitResult[] = [];

  /**
   * Emits one delivery event and reports whoever did not hear it.
   *
   * The reporting is not optional decoration. `EventsModel.emit` reports rather
   * than throws, so `failures` is the only place a dead listener is visible - and
   * these events are the ones with the most expensive silent failure in the engine:
   * a listener that writes an edge redirect table or purges a CDN missing a
   * `delivery_slug_changed` leaves a moved URL 404ing at the edge while the origin
   * is perfectly correct. The base and translation effects log their own event for
   * exactly this reason, and a delivery event that skipped the log would be the one
   * announcement nobody could find afterwards.
   *
   * The write has already committed, so this never fails the request - see
   * `reportContentEventFailures`.
   */
  const announce = async (
    action: "delivery_redirect_created" | "delivery_slug_changed",
    payload: Record<string, unknown>,
    { itemId, locale }: { itemId: number; locale: null | string },
  ): Promise<void> => {
    const event = await emitContentEvent(
      c,
      definition,
      action,
      payload as never,
      { pluginId },
    );

    events.push(event);
    await reportContentEventFailures(c, {
      action,
      contentTypeId: definition.id,
      event,
      itemId,
      // Present only for a localized URL: "nobody heard the Polish article moved"
      // is a different incident from "nobody heard the article moved".
      ...(locale === null ? {} : { locale }),
    });
  };

  // A canonical path this engine could not build is a URL nobody can visit, so
  // there is no delivery fact to announce. It happens for a slug written straight
  // into the database, and for a localized content type whose slug is shared - which
  // has one segment and several URLs, so no single canonical path.
  if (
    delivery === undefined ||
    !delivery.slugChanged ||
    delivery.canonicalPath === null
  ) {
    return { events };
  }

  await announce(
    "delivery_slug_changed",
    {
      canonicalPath: delivery.canonicalPath,
      contentId: delivery.itemId,
      locale: delivery.locale,
      previousPath: delivery.previousPath,
      previousSlug: delivery.previousSlug,
      slug: delivery.slug,
    },
    { itemId: delivery.itemId, locale: delivery.locale },
  );

  if (
    delivery.redirectCreated &&
    delivery.previousPath !== null &&
    delivery.previousSlug !== null
  ) {
    await announce(
      "delivery_redirect_created",
      {
        canonicalPath: delivery.canonicalPath,
        contentId: delivery.itemId,
        locale: delivery.locale,
        previousPath: delivery.previousPath,
        previousSlug: delivery.previousSlug,
      },
      { itemId: delivery.itemId, locale: delivery.locale },
    );
  }

  return { events };
};

/**
 * The delivery half of a mutation's cache invalidation, or `undefined`.
 *
 * `undefined` for a content type without `delivery`, which is what makes
 * `contentInvalidationTags` return exactly the strings it always returned - and
 * therefore what makes Stage 8 opt-in at the cache layer as well as everywhere
 * else.
 */
export const contentDeliveryInvalidation = (
  definition: AnyContentTypeDefinition,
  delivery: ContentDeliveryOutcome | undefined,
): ContentDeliveryInvalidation | undefined => {
  if (!definition.delivery.enabled) return undefined;

  // A content type with delivery whose mutation reported nothing still expires its
  // delivery metadata - a shared SEO field moving changes what every locale's
  // `<head>` renders even though no URL moved. Only the sitemap is conditional, and
  // an absent outcome means the mutation touched no slug-bearing path at all.
  return {
    sitemap: delivery?.sitemap ?? {
      contentChanged: false,
      indexChanged: false,
    },
  };
};
