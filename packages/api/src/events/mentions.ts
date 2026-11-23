import { z } from "zod";

import { manifest } from "@/manifest";

import { defineEvent } from "../lib/event-definition";

const pluginId = manifest.id;

const mentionTarget = {
  actorId: z.number().int().nullable(),
  pluginId: z.string(),
  targetId: z.string(),
  targetType: z.string(),
};

/**
 * Members were `@mentioned` for the first time in a target's text. `notified`
 * is `false` for those who got no notification: they can't read the target,
 * the author's role may not mention, or the role's per-item cap was reached.
 */
export const mentionCreatedEvent = defineEvent({
  pluginId,
  name: "mention.created",
  payload: z.object({
    ...mentionTarget,
    users: z.array(z.object({ id: z.number().int(), notified: z.boolean() })),
  }),
});

/** An edit removed mentions; their notifications are already retracted. */
export const mentionRemovedEvent = defineEvent({
  pluginId,
  name: "mention.removed",
  payload: z.object({
    ...mentionTarget,
    userIds: z.array(z.number().int()),
  }),
});

/** Every `mention.*` event core defines. */
export const mentionEventDefinitions = [
  mentionCreatedEvent,
  mentionRemovedEvent,
];
