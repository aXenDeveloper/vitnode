import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { WARNING_LIMITS } from "@/lib/moderation/warnings";

import { requireWarner } from "../lib/require-warner";
import { toDraft } from "../lib/warning-draft";
import { issueWarning } from "../lib/warnings";
import {
  json,
  warningMessageInputSchema,
  warningStaffNoteInputSchema,
} from "../moderation.schema";
import { body, commonResponses, draftSchema } from "../warnings.schema";

const issueSchema = draftSchema.extend({
  message: warningMessageInputSchema,
  staffNote: warningStaffNoteInputSchema,
  overrideNote: z.string().trim().max(WARNING_LIMITS.noteMaxLength).nullish(),
  resolveReport: z.boolean().default(false),
  idempotencyKey: z
    .string()
    .min(8)
    .max(64)
    .regex(/^[\w-]+$/),
});

export const issueWarningRoute = buildRoute({
  route: {
    method: "post",
    path: "/warnings",
    description:
      "Issue a warning. The server resolves the content's author and scope, recalculates points under the member's lock, applies at most one threshold suspension and notifies the member. Retrying with the same `idempotencyKey` returns the first result",
    request: body(issueSchema),
    responses: {
      200: json(
        z.object({
          warningId: z.number(),
          duplicate: z.boolean(),
          points: z.object({ before: z.number(), after: z.number() }),
          reportResolved: z.boolean(),
          sanction: z
            .object({
              id: z.number(),
              endsAt: z.date().nullable(),
              thresholdId: z.number().nullable(),
            })
            .nullable(),
        }),
        "The warning as issued",
      ),
      ...commonResponses,
    },
  },
  handler: async c => {
    const moderator = await requireWarner(c);
    const input = c.req.valid("json");
    const result = await issueWarning(c, moderator, {
      ...toDraft(input),
      idempotencyKey: input.idempotencyKey,
      message: input.message,
      overrideNote: input.overrideNote ?? null,
      resolveReport: input.resolveReport,
      staffNote: input.staffNote,
    });

    return c.json(result, 200);
  },
});
