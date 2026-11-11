import { z } from "zod";

import { buildQueueTask } from "@/api/builders";
import { CONTENT_QUEUE_TASK_NOTIFICATIONS } from "@/content/const";

/**
 * The intent a content operation stores in its own transaction, as the payload
 * of a `content-notifications` queue task. Only identities and the facts of
 * the operation (who acted, which decision) - the records themselves are
 * reloaded when it is processed, so a change in between is respected.
 */
export const contentNotificationIntentSchema = z.discriminatedUnion("trigger", [
  z.object({
    actorId: z.number().int().positive().nullable(),
    contentTypeId: z.string().min(1),
    itemId: z.string().min(1),
    ruleIds: z.array(z.string().min(1)).min(1),
    trigger: z.literal("firstPublication"),
    v: z.literal(1),
  }),
  z.object({
    actorId: z.number().int().positive().nullable(),
    contentTypeId: z.string().min(1),
    decision: z.enum(["approved", "rejected"]),
    itemId: z.string().min(1),
    ruleIds: z.array(z.string().min(1)).min(1),
    submissionId: z.number().int().positive(),
    trigger: z.literal("moderationDecision"),
    v: z.literal(1),
  }),
  z.object({
    contentTypeId: z.string().min(1),
    itemId: z.string().min(1),
    trigger: z.literal("deleted"),
    v: z.literal(1),
  }),
  z.object({
    contentTypeId: z.string().min(1),
    itemId: z.string().min(1),
    ruleIds: z.array(z.string().min(1)).min(1),
    submissionId: z.number().int().positive(),
    trigger: z.literal("approvalSubmitted"),
    v: z.literal(1),
  }),
  z.object({
    contentTypeId: z.string().min(1),
    itemId: z.string().min(1),
    ruleIds: z.array(z.string().min(1)).min(1),
    submissionId: z.number().int().positive(),
    trigger: z.literal("approvalResolved"),
    v: z.literal(1),
  }),
]);

export type ContentNotificationIntent = z.infer<
  typeof contentNotificationIntentSchema
>;

export const contentNotificationsQueueTask = buildQueueTask({
  name: CONTENT_QUEUE_TASK_NOTIFICATIONS,
  payload: contentNotificationIntentSchema,
  description:
    "Turn a committed content operation into core notifications, or clean up after a deleted record. Idempotent per operation.",
  maxAttempts: 5,
  handler: async (c, intent) => {
    const { processContentNotificationIntent } =
      await import("../../../../content/server/notifications/process");
    await processContentNotificationIntent(c, intent);
  },
});
