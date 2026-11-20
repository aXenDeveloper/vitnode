import { z } from "@hono/zod-openapi";

import { reactionImageSchema } from "@/lib/reactions/catalog";
import {
  REACTION_CODE_PATTERN,
  REACTION_KINDS,
  REACTIONS_LIMITS,
} from "@/lib/reactions/const";

export const errorSchema = z.object({ error: z.string() });

export const idParams = z.object({
  id: z.coerce.number().int().positive().openapi({ example: 1 }),
});

export const dailyLimitSchema = z
  .number()
  .int()
  .min(1)
  .max(REACTIONS_LIMITS.maxDailyLimit)
  .nullable();

export const reactionRoleRuleSchema = z.object({
  dailyLimit: dailyLimitSchema,
  roleId: z.number().int().positive(),
});

const titleSchema = z
  .array(
    z.object({
      languageCode: z.string(),
      value: z.string().trim().min(1).max(REACTIONS_LIMITS.titleMaxLength),
    }),
  )
  .min(1);

export const reactionBody = z.object({
  allRoles: z.boolean(),
  code: z.string().min(1).max(32).regex(REACTION_CODE_PATTERN),
  enabled: z.boolean(),
  fileId: z.number().int().positive().nullable(),
  /** `emoji:<emoji>` or `icon:<lucide-name>`, for those kinds. */
  icon: z.string().max(100).nullable(),
  kind: z.enum(REACTION_KINDS),
  points: z
    .number()
    .int()
    .min(-REACTIONS_LIMITS.maxPoints)
    .max(REACTIONS_LIMITS.maxPoints),
  posterFileId: z.number().int().positive().nullable(),
  /** Roles with their own daily limit; with `allRoles` off, the only roles allowed. */
  roles: z.array(reactionRoleRuleSchema).max(200),
  title: titleSchema,
});

export type ReactionBody = z.infer<typeof reactionBody>;

export const adminReactionSchema = z.object({
  allRoles: z.boolean(),
  code: z.string(),
  enabled: z.boolean(),
  fileId: z.number().int().nullable(),
  icon: z.string().nullable(),
  id: z.number().int(),
  image: reactionImageSchema.nullable(),
  kind: z.enum(REACTION_KINDS),
  points: z.number().int(),
  position: z.number().int(),
  posterFileId: z.number().int().nullable(),
  roles: z.array(reactionRoleRuleSchema),
  title: z.array(z.object({ languageCode: z.string(), value: z.string() })),
});

export const uploadResultSchema = z.object({
  fileId: z.number().int(),
  image: reactionImageSchema,
  posterFileId: z.number().int().nullable(),
});
