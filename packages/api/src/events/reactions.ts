import { z } from "zod";

import { manifest } from "@/manifest";

import { defineEvent } from "../lib/event-definition";

const pluginId = manifest.id;

const reactionPayload = z.object({
  pluginId: z.string(),
  points: z.number().int(),
  reaction: z.string(),
  targetAuthorId: z.number().int().nullable(),
  targetId: z.string(),
  targetType: z.string(),
  userId: z.number().int(),
});

/** A member added a reaction. `targetAuthorId` is `null` when it earns no reputation. */
export const reactionAddedEvent = defineEvent({
  pluginId,
  name: "reaction.added",
  payload: reactionPayload,
});

/** A member removed a reaction. Deleting a target removes its reactions without this event. */
export const reactionRemovedEvent = defineEvent({
  pluginId,
  name: "reaction.removed",
  payload: reactionPayload,
});

/** One reaction replaced another (a role allows one reaction per item). */
export const reactionChangedEvent = defineEvent({
  pluginId,
  name: "reaction.changed",
  payload: reactionPayload.extend({ previousReaction: z.string() }),
});

/** A member's reputation moved, by a reaction or by a recount. */
export const reputationChangedEvent = defineEvent({
  pluginId,
  name: "reputation.changed",
  payload: z.object({
    delta: z.number().int(),
    reason: z.enum(["reaction", "recount"]),
    total: z.number().int(),
    userId: z.number().int(),
  }),
});

/** An admin created, edited, deleted or reordered reactions; `reactionId` is `null` for a reorder. */
export const reactionCatalogChangedEvent = defineEvent({
  pluginId,
  name: "reaction.catalog_changed",
  payload: z.object({
    action: z.enum(["created", "updated", "deleted", "reordered"]),
    reactionId: z.number().int().nullable(),
  }),
});

/** Every `reaction.*` and `reputation.*` event core defines. */
export const reactionEventDefinitions = [
  reactionAddedEvent,
  reactionRemovedEvent,
  reactionChangedEvent,
  reputationChangedEvent,
  reactionCatalogChangedEvent,
];
