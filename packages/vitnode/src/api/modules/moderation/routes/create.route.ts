import { z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/builders";
import { isUniqueViolation } from "@/api/lib/db-errors";
import { findReportTarget } from "@/api/lib/moderation/registry";
import { sealReportSnapshot } from "@/api/lib/moderation/snapshot";
import {
  core_moderation_report_reasons,
  core_moderation_reports,
} from "@/database/moderation";
import { MODERATION_LIMITS } from "@/lib/moderation/const";

import {
  appendReportEvent,
  countRecentReports,
  reportError,
  reportOpenKey,
} from "../lib/reports";
import { errorSchema, json, reasonSchema } from "../lib/schema";

const localeSchema = z
  .string()
  .max(20)
  .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/);

const createBody = z.object({
  pluginId: z.string().min(1).max(100),
  targetType: z.string().min(1).max(100),
  targetId: z.string().min(1).max(64),
  locale: localeSchema.nullable().optional(),
  requestedLocale: localeSchema.nullable().optional(),
  reason: reasonSchema,
  description: z
    .string()
    .trim()
    .max(MODERATION_LIMITS.descriptionMaxLength)
    .nullable()
    .optional(),
});

export const createReportRoute = buildRoute({
  route: {
    method: "post",
    path: "/reports",
    description:
      "Report content to the moderators. The server captures the snapshot - the client sends only the target, locale, reason code and description. A reason that requires details needs a description",
    request: {
      body: { content: { "application/json": { schema: createBody } } },
    },
    responses: {
      201: json(z.object({ id: z.number() }), "Report filed"),
      400: json(
        errorSchema,
        "The reason does not exist (`reason_not_found`) or needs details (`details_required`)",
      ),
      401: { description: "Sign in first" },
      404: json(
        errorSchema,
        "The target does not exist, or the reporter cannot read it",
      ),
      409: json(
        errorSchema,
        "The reporter already has an open report about this target",
      ),
      429: json(errorSchema, "Too many reports"),
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "Sign in first." });

    const body = c.req.valid("json");
    const [reason] = await c
      .get("db")
      .select({
        requiresDetails: core_moderation_report_reasons.requiresDetails,
      })
      .from(core_moderation_report_reasons)
      .where(eq(core_moderation_report_reasons.code, body.reason))
      .limit(1);
    if (!reason) throw reportError(400, { error: "reason_not_found" });
    if (
      reason.requiresDetails &&
      (body.description?.length ?? 0) <
        MODERATION_LIMITS.requiredDescriptionMinLength
    ) {
      throw reportError(400, { error: "details_required" });
    }

    const registered = findReportTarget(c.get("core").moderation, {
      pluginId: body.pluginId,
      type: body.targetType,
    });
    if (!registered) throw reportError(404, { error: "not_found" });
    const { definition, pluginId } = registered;

    const targetId = definition.parseId(body.targetId);
    if (targetId === null) throw reportError(404, { error: "not_found" });

    if (
      (await countRecentReports(c, user.id)) >=
      MODERATION_LIMITS.reportsPerUserPerHour
    ) {
      c.header("Retry-After", "3600");
      throw reportError(429, { error: "rate_limited" });
    }

    const openKey = reportOpenKey({
      pluginId,
      reporterId: user.id,
      targetId,
      targetType: definition.type,
    });
    const [existing] = await c
      .get("db")
      .select({ id: core_moderation_reports.id })
      .from(core_moderation_reports)
      .where(and(eq(core_moderation_reports.openKey, openKey)))
      .limit(1);
    if (existing) throw reportError(409, { error: "duplicate" });

    const capture = await definition.capture(c, {
      locale: body.locale ?? null,
      targetId,
    });
    if (!capture) throw reportError(404, { error: "not_found" });

    const scopeId = definition.scope
      ? ((await definition.resolveScope?.(c, targetId)) ?? null)
      : null;
    const requested = body.requestedLocale ?? capture.locale.requested;
    const snapshot = sealReportSnapshot({
      capture: {
        ...capture,
        locale: {
          fallback:
            requested !== null &&
            capture.locale.served !== null &&
            requested.toLowerCase() !== capture.locale.served.toLowerCase(),
          requested,
          served: capture.locale.served,
        },
        scope:
          definition.scope && scopeId
            ? { family: definition.scope, id: scopeId }
            : capture.scope,
      },
      target: { id: targetId, pluginId, type: definition.type },
    });

    let reportId: number;
    try {
      reportId = await c.get("db").transaction(async tx => {
        const [created] = await tx
          .insert(core_moderation_reports)
          .values({
            description:
              body.description?.trim() === ""
                ? null
                : (body.description ?? null),
            openKey,
            pluginId,
            reason: body.reason,
            reporterId: user.id,
            scopeFamily: definition.scope ?? null,
            scopeId,
            snapshot,
            targetId,
            targetTitle: snapshot.title,
            targetType: definition.type,
          })
          .returning({ id: core_moderation_reports.id });

        await appendReportEvent(tx, {
          actorId: user.id,
          data: { reason: body.reason },
          reportId: created.id,
          type: "created",
        });

        return created.id;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw reportError(409, { error: "duplicate" });
      }
      throw error;
    }

    await c.get("events").emit("moderation.report.created", {
      pluginId,
      reason: body.reason,
      reportId,
      targetId,
      targetType: definition.type,
    });

    return c.json({ id: reportId }, 201);
  },
});
