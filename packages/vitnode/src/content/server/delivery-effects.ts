import type { Context } from "hono";

import type { EventEmitResult } from "../../api/models/events";
import type { ContentDeliveryInvalidation } from "../cache";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentDeliveryOutcome } from "./delivery-writes";

import { reportContentEventFailures } from "./effects-log";
import { emitContentEvent } from "./emit";

export interface ContentDeliveryEffectsResult {
  events: EventEmitResult[];
}

export const contentDeliveryEffects = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  delivery: ContentDeliveryOutcome | undefined,
  { pluginId }: { pluginId: string },
): Promise<ContentDeliveryEffectsResult> => {
  const events: EventEmitResult[] = [];

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
