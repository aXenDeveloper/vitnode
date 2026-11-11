import { z } from "zod";

import { manifest } from "@/manifest";

import { defineEvent } from "../lib/event-definition";

const pluginId = manifest.id;

const payload = z.object({
  /** In minor units. */
  amount: z.number().int(),
  currency: z.string(),
  paymentId: z.string(),
  /** The plugin that created the payment. */
  pluginId: z.string(),
  /** The provider instance id. */
  providerId: z.string(),
  /** The plugin's own reference, e.g. `order:42`. */
  reference: z.string(),
  userId: z.number().int().nullable(),
});

/** The customer finished the checkout; a delayed payment method is still settling. */
export const paymentProcessingEvent = defineEvent({
  pluginId,
  name: "payment.processing",
  payload,
});

/**
 * The provider confirmed the payment, and the status is committed. Emitted
 * once per payment, after the commit, through the events adapter - with the
 * default local adapter that is in-process and not retried, so derive what a
 * customer owns from the stored payment, not from this event.
 */
export const paymentSucceededEvent = defineEvent({
  pluginId,
  name: "payment.succeeded",
  payload,
});

/** The provider reported a final failure for the checkout, or refused to create it. */
export const paymentFailedEvent = defineEvent({
  pluginId,
  name: "payment.failed",
  payload,
});

/**
 * The provider let the checkout lapse without a payment, or core closed an
 * attempt whose checkout was never created.
 */
export const paymentExpiredEvent = defineEvent({
  pluginId,
  name: "payment.expired",
  payload,
});

/** Every `payment.*` event core defines. */
export const paymentEventDefinitions = [
  paymentProcessingEvent,
  paymentSucceededEvent,
  paymentFailedEvent,
  paymentExpiredEvent,
];
