import type { AnyContentTypeDefinition } from "@/content/types";

/**
 * Whether a content type has a delivery layer, and what its panel may ask for.
 *
 * Pure, and small on purpose: the delivery *feature* is `content/delivery.ts`'s,
 * this is only the two readings the AdminCP's panel needs. Both AdminCPs read
 * them, so a record's URL history opens the same way in either.
 */

/**
 * Whether the `Delivery` action is offered at all.
 *
 * `delivery.enabled` alone is the whole answer, and it already implies the rest:
 * `resolveContentDelivery` refuses a delivery layer without `publicApi`, so a
 * content type cannot reach a state where it has a canonical path and no public
 * projection to serve it from.
 *
 * When this is `false` the action is **absent**, never disabled or empty: a menu
 * entry that opens a panel saying "this content type has no URLs" is a control
 * that looks broken. `row-actions-model.ts` is where that absence is applied,
 * for both hosts at once.
 */
export const hasContentDelivery = (
  definition: AnyContentTypeDefinition,
): boolean => definition.delivery.enabled;

/**
 * The locale a delivery read is *for*, or `undefined`.
 *
 * The distinction this function exists to hold: `locale` here names **which
 * translation's URL** is being asked about, not which language the AdminCP is
 * being read in. They are the same string in practice - the administrator's
 * interface language decides which translation's row the list is showing, so it
 * is also the translation whose address the panel should describe - and that
 * coincidence is exactly why they are easy to conflate.
 *
 * For a content type with no translations there is no such thing as a
 * per-language address: one record, one canonical path. Sending the interface
 * language then would ask the API to resolve a locale that means nothing here,
 * and would key one cache entry per administrator language for identical
 * answers. So it is dropped, and the API answers about the record itself.
 */
export const contentDeliveryRequestLocale = (
  definition: AnyContentTypeDefinition,
  locale: string | undefined,
): string | undefined => (definition.localization.enabled ? locale : undefined);
