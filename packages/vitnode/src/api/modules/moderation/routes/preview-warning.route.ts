import { z } from "@hono/zod-openapi";
import { and, desc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/builders";
import { hasWarningPermission } from "@/api/lib/moderation/warnings/access";
import { findActiveSuspension } from "@/api/lib/moderation/warnings/suspension";
import { core_moderation_warnings } from "@/database/warnings";
import {
  WARNING_PERMISSIONS,
  WARNING_THRESHOLD_ACTIONS,
} from "@/lib/moderation/warnings";

import { loadReportPeople } from "../lib/people";
import { requireWarner } from "../lib/require-warner";
import { toDraft } from "../lib/warning-draft";
import { projectWarning, resolveWarningDraft } from "../lib/warnings";
import {
  serializeStaffWarnings,
  staffWarningSchema,
} from "../lib/warnings-view";
import { json, reportPersonSchema } from "../moderation.schema";
import { body, commonResponses, draftSchema } from "../warnings.schema";

const projectedSanctionSchema = z.object({
  action: z.enum(WARNING_THRESHOLD_ACTIONS),
  durationMinutes: z.number().nullable(),
  endsAt: z.date().nullable(),
  points: z.number(),
  thresholdId: z.number(),
});

export const previewWarningRoute = buildRoute({
  route: {
    method: "post",
    path: "/warnings/preview",
    description:
      "Runs every check of a warning without issuing it and predicts its consequences: the member's active points before and after, and the suspension a threshold would apply. Advisory - issuing recalculates",
    request: body(draftSchema),
    responses: {
      200: json(
        z.object({
          user: reportPersonSchema,
          points: z.object({
            current: z.number(),
            warning: z.number(),
            projected: z.number(),
          }),
          defaults: z.object({
            points: z.number(),
            expiresAfterHours: z.number().nullable(),
          }),
          expiresAt: z.date().nullable(),
          overrides: z.object({ points: z.boolean(), expiration: z.boolean() }),
          sanction: projectedSanctionSchema.nullable(),
          suspendedUntil: z.object({ endsAt: z.date().nullable() }).nullable(),
          permissions: z.object({
            overridePoints: z.boolean(),
            overrideExpiration: z.boolean(),
            resolveReport: z.boolean(),
            viewWarnings: z.boolean(),
          }),
          related: z.array(staffWarningSchema),
        }),
        "What the warning would do",
      ),
      ...commonResponses,
    },
  },
  handler: async c => {
    const moderator = await requireWarner(c);
    const draft = await resolveWarningDraft(
      c,
      moderator,
      toDraft(c.req.valid("json")),
    );
    const now = new Date();
    const expiresAt = draft.expiresAt(now);
    const projection = await projectWarning(c, {
      expiresAt,
      points: draft.points,
      userId: draft.user.id,
    });
    const canViewSanctions = hasWarningPermission(
      moderator.set,
      WARNING_PERMISSIONS.viewSanctions,
    );
    const [people, suspension, relatedRows] = await Promise.all([
      loadReportPeople(c, [draft.user.id]),
      canViewSanctions ? findActiveSuspension(c, draft.user.id, now) : null,
      draft.content
        ? c
            .get("db")
            .select()
            .from(core_moderation_warnings)
            .where(
              and(
                eq(core_moderation_warnings.pluginId, draft.content.pluginId),
                eq(
                  core_moderation_warnings.targetType,
                  draft.content.targetType,
                ),
                eq(core_moderation_warnings.targetId, draft.content.targetId),
              ),
            )
            .orderBy(desc(core_moderation_warnings.issuedAt))
            .limit(10)
        : [],
    ]);
    const user = people.get(draft.user.id);
    if (!user) throw new HTTPException(404, { message: "user_not_found" });

    return c.json(
      {
        user,
        points: {
          current: projection.before,
          warning: draft.points,
          projected: projection.after,
        },
        defaults: {
          points: draft.defaultPoints,
          expiresAfterHours: draft.defaultExpiresAfterHours,
        },
        expiresAt,
        overrides: draft.overrides,
        sanction: projection.sanction,
        suspendedUntil: suspension ? { endsAt: suspension.endsAt } : null,
        permissions: {
          overridePoints: hasWarningPermission(
            moderator.set,
            WARNING_PERMISSIONS.overridePoints,
          ),
          overrideExpiration: hasWarningPermission(
            moderator.set,
            WARNING_PERMISSIONS.overrideExpiration,
          ),
          resolveReport:
            draft.report !== null && draft.report.status !== "done",
          viewWarnings: hasWarningPermission(
            moderator.set,
            WARNING_PERMISSIONS.view,
          ),
        },
        related: await serializeStaffWarnings(c, moderator, relatedRows, now),
      },
      200,
    );
  },
});
