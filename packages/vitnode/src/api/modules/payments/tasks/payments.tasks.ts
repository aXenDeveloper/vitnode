import { z } from "zod";

import { buildCron } from "@/api/lib/cron";
import { buildQueueTask } from "@/api/lib/queue";
import {
  FULFILL_TASK,
  runFulfillment,
} from "@/api/models/payments/fulfillment";
import { reconcilePayments } from "@/api/models/payments/reconcile";
import {
  PROCESS_EVENT_TASK,
  processWebhookEvent,
} from "@/api/models/payments/webhooks";

export const processPaymentEventTask = buildQueueTask({
  name: PROCESS_EVENT_TASK,
  description:
    "Re-read a payment provider object named by a verified webhook and apply it.",
  maxAttempts: 8,
  handler: async (c, payload) => {
    const { eventId } = z.object({ eventId: z.number().int() }).parse(payload);
    await processWebhookEvent(c, eventId);
  },
});

export const fulfillPaymentTask = buildQueueTask({
  name: FULFILL_TASK,
  description:
    "Run a plugin's handler for a paid purchase, a refund or a subscription change.",
  maxAttempts: 5,
  handler: async (c, payload) => {
    const { fulfillmentId } = z
      .object({ fulfillmentId: z.number().int() })
      .parse(payload);
    await runFulfillment(c, fulfillmentId);
  },
});

export const reconcilePaymentsCron = buildCron({
  name: "payments-reconcile",
  description:
    "Check unfinished checkouts, processing payments and subscriptions due a renewal with the provider, and re-queue stuck payment work.",
  schedule: "*/5 * * * *",
  handler: async c => {
    await reconcilePayments(c);
  },
});
