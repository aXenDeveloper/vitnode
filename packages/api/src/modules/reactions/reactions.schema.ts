import { z } from "@hono/zod-openapi";

import { zodPublicPerson } from "@/lib/public-people";
import { reactionImageSchema } from "@/lib/reactions/catalog";
import { REACTION_KINDS } from "@/lib/reactions/const";

export const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});

export const reactionErrorSchema = z.object({
  error: z.string(),
  /** When a daily limit is used up: the next midnight in the member's time zone. */
  resetsAt: z.string().nullable().optional(),
});

export const targetFields = {
  pluginId: z
    .string()
    .min(1)
    .max(100)
    .openapi({ example: "@vitnode/newsroom" }),
  type: z.string().min(1).max(100).openapi({ example: "newsroom.comment" }),
};

export const reactionCountsSchema = z.object({
  counts: z.array(z.object({ code: z.string(), count: z.number().int() })),
  seq: z.number().int(),
  total: z.number().int(),
});

export const reactionSummarySchema = reactionCountsSchema.extend({
  canReact: z.boolean(),
  id: z.string(),
  viewer: z.array(z.string()),
});

export const reactionPublicSchema = z.object({
  code: z.string(),
  icon: z.string().nullable(),
  image: reactionImageSchema.nullable(),
  kind: z.enum(REACTION_KINDS),
  points: z.number().int(),
  title: z.array(z.object({ languageCode: z.string(), value: z.string() })),
});

export const reactionCatalogItemSchema = reactionPublicSchema.extend({
  /** Left today for the viewer; `null` = unlimited. */
  remainingToday: z.number().int().nullable(),
  /** The viewer's roles may use it. */
  usable: z.boolean(),
});

export const reactionCatalogSchema = z.object({
  items: z.array(reactionCatalogItemSchema),
  /** The WebSocket is mounted, so the browser may follow live counts. */
  live: z.boolean(),
  /** Different reactions the viewer may give one item; `null` = unlimited, `0` = cannot react. */
  maxPerItem: z.number().int().nullable(),
  /** Reactions the viewer has left today over every reaction; `null` = unlimited. */
  remainingToday: z.number().int().nullable(),
  /** The next midnight in the viewer's time zone, when daily limits reset. */
  resetsAt: z.string(),
  signedIn: z.boolean(),
});

export const reactionUserSchema = z.object({
  createdAt: z.date(),
  reaction: z.string(),
  user: zodPublicPerson,
});
