import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import {
  and,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  isNotNull,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type { ModeratorContext } from "@/api/lib/moderation/access";

import { buildRoute } from "@/api/builders";
import { requireModerator } from "@/api/lib/moderation/access";
import {
  canWarnAnywhere,
  hasWarningPermission,
  viewableWarningsCondition,
} from "@/api/lib/moderation/warnings/access";
import {
  listWarningReasons,
  warningReasonSchema,
} from "@/api/lib/moderation/warnings/reasons";
import { findActiveSuspension } from "@/api/lib/moderation/warnings/suspension";
import { core_users } from "@/database/users";
import { core_moderation_warnings } from "@/database/warnings";
import { containsLikePattern } from "@/lib/api/like-pattern";
import {
  WARNING_LIMITS,
  WARNING_PERMISSIONS,
  WARNING_THRESHOLD_ACTIONS,
} from "@/lib/moderation/warnings";

import type { WarningDraftInput } from "../lib/warnings-service";

import { loadReportPeople } from "../lib/people";
import { errorSchema, json, reportPersonSchema } from "../lib/schema";
import {
  issueWarning,
  loadActivePoints,
  projectWarning,
  resolveWarningDraft,
  revokeSanction,
  revokeWarning,
} from "../lib/warnings-service";
import {
  loadUserSanctions,
  loadUserWarnings,
  sanctionSchema,
  serializeSanctions,
  serializeStaffWarnings,
  staffWarningSchema,
} from "../lib/warnings-view";

const body = <T extends z.ZodType>(schema: T) => ({
  body: { content: { "application/json": { schema } }, required: true },
});

const idParams = z.object({
  id: z.coerce.number().int().positive().openapi({ example: 1 }),
});

const expirationSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("default") }),
  z.object({ mode: z.literal("never") }),
  z.object({
    mode: z.literal("hours"),
    hours: z.number().int().min(1).max(WARNING_LIMITS.maxDurationHours),
  }),
  z.object({ mode: z.literal("at"), at: z.iso.datetime() }),
]);

const draftSchema = z.object({
  userId: z.number().int().positive(),
  reasonId: z.number().int().positive().nullable(),
  points: z.number().int().min(0).max(WARNING_LIMITS.maxPoints).nullish(),
  expiration: expirationSchema.default({ mode: "default" }),
  content: z
    .object({
      pluginId: z.string().min(1).max(100),
      targetType: z.string().min(1).max(100),
      targetId: z.string().min(1).max(64),
    })
    .nullish(),
  reportId: z.number().int().positive().nullish(),
});

const issueSchema = draftSchema.extend({
  message: z
    .string()
    .trim()
    .min(WARNING_LIMITS.messageMinLength)
    .max(WARNING_LIMITS.messageMaxLength),
  staffNote: z.string().trim().max(WARNING_LIMITS.noteMaxLength).nullish(),
  overrideNote: z.string().trim().max(WARNING_LIMITS.noteMaxLength).nullish(),
  resolveReport: z.boolean().default(false),
  idempotencyKey: z
    .string()
    .min(8)
    .max(64)
    .regex(/^[\w-]+$/),
});

const revokeSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(WARNING_LIMITS.explanationMinLength)
    .max(WARNING_LIMITS.noteMaxLength),
});

const toDraft = (input: z.infer<typeof draftSchema>): WarningDraftInput => ({
  content: input.content ?? null,
  expiration:
    input.expiration.mode === "at"
      ? { at: new Date(input.expiration.at), mode: "at" }
      : input.expiration,
  points: input.points ?? null,
  reasonId: input.reasonId,
  reportId: input.reportId ?? null,
  userId: input.userId,
});

const commonResponses = {
  400: json(errorSchema, "Invalid input"),
  401: { description: "Sign in first" },
  403: json(errorSchema, "Not allowed for this moderator or this member"),
  404: json(errorSchema, "No such member, reason, content or report"),
  409: json(errorSchema, "The state changed, or the reason is disabled"),
};

const requireWarner = async (c: Context): Promise<ModeratorContext> => {
  const moderator = await requireModerator(c);
  if (!canWarnAnywhere(c, moderator.set)) {
    throw new HTTPException(403, { message: "Forbidden" });
  }

  return moderator;
};

export const listWarningReasonsRoute = buildRoute({
  route: {
    method: "get",
    path: "/warnings/reasons",
    description:
      "Enabled warning reasons, in display order, for the warn form (moderators who can warn)",
    responses: {
      200: json(
        z.object({ reasons: z.array(warningReasonSchema) }),
        "Warning reasons",
      ),
      401: commonResponses[401],
      403: { description: "Cannot warn anyone" },
    },
  },
  handler: async c => {
    await requireWarner(c);

    return c.json(
      { reasons: await listWarningReasons(c, { enabledOnly: true }) },
      200,
    );
  },
});

const projectedSanctionSchema = z.object({
  action: z.enum(WARNING_THRESHOLD_ACTIONS),
  durationHours: z.number().nullable(),
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
      staffNote: input.staffNote ?? null,
    });

    return c.json(result, 200);
  },
});

export const revokeWarningRoute = buildRoute({
  route: {
    method: "post",
    path: "/warnings/{id}/revoke",
    description:
      "Revoke a warning with a reason. Its points stop counting at once; the record and any suspension it led to stay",
    request: { params: idParams, ...body(revokeSchema) },
    responses: {
      200: json(
        z.object({ warningId: z.number(), userId: z.number() }),
        "Warning revoked",
      ),
      ...commonResponses,
    },
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    const { id } = c.req.valid("param");
    const { reason } = c.req.valid("json");

    return c.json(await revokeWarning(c, moderator, { id, reason }), 200);
  },
});

export const revokeSanctionRoute = buildRoute({
  route: {
    method: "post",
    path: "/sanctions/{id}/revoke",
    description:
      "Lift one sanction with a reason. Other active sanctions of the member keep applying",
    request: { params: idParams, ...body(revokeSchema) },
    responses: {
      200: json(
        z.object({ sanctionId: z.number(), userId: z.number() }),
        "Sanction revoked",
      ),
      ...commonResponses,
    },
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    const { id } = c.req.valid("param");
    const { reason } = c.req.valid("json");

    return c.json(await revokeSanction(c, moderator, { id, reason }), 200);
  },
});

const statusCondition = (
  status: "active" | "all" | "expired" | "revoked",
  now: Date,
) => {
  const table = core_moderation_warnings;
  switch (status) {
    case "active":
      return and(
        isNull(table.revokedAt),
        or(isNull(table.expiresAt), gt(table.expiresAt, now)),
      );
    case "all":
      return undefined;
    case "expired":
      return and(isNull(table.revokedAt), lte(table.expiresAt, now));
    case "revoked":
      return isNotNull(table.revokedAt);
  }
};

export const listWarningsRoute = buildRoute({
  route: {
    method: "get",
    path: "/warnings",
    description:
      "Warnings the moderator may see, newest first, with filters. Moderators without `can_view` see the warnings they issued and those linked to content in their scope",
    request: {
      query: z.object({
        userId: z.coerce.number().int().positive().optional(),
        reasonId: z.coerce.number().int().positive().optional(),
        issuedById: z.coerce.number().int().positive().optional(),
        status: z.enum(["all", "active", "expired", "revoked"]).default("all"),
        pluginId: z.string().max(100).optional(),
        targetType: z.string().max(100).optional(),
        from: z.iso.datetime().optional(),
        to: z.iso.datetime().optional(),
        page: z.coerce.number().int().positive().max(10_000).default(1),
        pageSize: z.coerce
          .number()
          .int()
          .positive()
          .max(100)
          .default(WARNING_LIMITS.pageSize),
      }),
    },
    responses: {
      200: json(
        z.object({
          items: z.array(
            staffWarningSchema.extend({ user: reportPersonSchema.nullable() }),
          ),
          page: z.number(),
          pageSize: z.number(),
          total: z.number(),
        }),
        "One page of warnings",
      ),
      401: commonResponses[401],
      403: { description: "Not a moderator" },
    },
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    const query = c.req.valid("query");
    const table = core_moderation_warnings;
    const now = new Date();
    const where = and(
      viewableWarningsCondition(c, moderator),
      statusCondition(query.status, now),
      query.userId ? eq(table.userId, query.userId) : undefined,
      query.reasonId ? eq(table.reasonId, query.reasonId) : undefined,
      query.issuedById ? eq(table.issuedById, query.issuedById) : undefined,
      query.pluginId ? eq(table.pluginId, query.pluginId) : undefined,
      query.targetType ? eq(table.targetType, query.targetType) : undefined,
      query.from ? gte(table.issuedAt, new Date(query.from)) : undefined,
      query.to ? lte(table.issuedAt, new Date(query.to)) : undefined,
    );

    const [[totalRow], rows] = await Promise.all([
      c.get("db").select({ value: count() }).from(table).where(where),
      c
        .get("db")
        .select()
        .from(table)
        .where(where)
        .orderBy(desc(table.issuedAt), desc(table.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
    ]);
    const [items, people] = await Promise.all([
      serializeStaffWarnings(c, moderator, rows, now),
      loadReportPeople(
        c,
        rows.map(row => row.userId),
      ),
    ]);

    return c.json(
      {
        items: items.map(item => ({
          ...item,
          user: people.get(item.userId) ?? null,
        })),
        page: query.page,
        pageSize: query.pageSize,
        total: totalRow?.value ?? 0,
      },
      200,
    );
  },
});

export const searchMembersRoute = buildRoute({
  route: {
    method: "get",
    path: "/members",
    description:
      "Find members by name for the ModCP member lookup (moderators who can warn or view warnings)",
    request: {
      query: z.object({ search: z.string().trim().min(1).max(100) }),
    },
    responses: {
      200: json(
        z.object({ items: z.array(reportPersonSchema) }),
        "Up to 10 members",
      ),
      401: commonResponses[401],
      403: { description: "Cannot warn or view warnings" },
    },
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    if (
      !hasWarningPermission(moderator.set, WARNING_PERMISSIONS.view) &&
      !hasWarningPermission(moderator.set, WARNING_PERMISSIONS.warn)
    ) {
      throw new HTTPException(403, { message: "Forbidden" });
    }
    const { search } = c.req.valid("query");
    const pattern = containsLikePattern(search);
    const rows = await c
      .get("db")
      .select({ id: core_users.id })
      .from(core_users)
      .where(
        or(
          ilike(core_users.name, pattern),
          ilike(core_users.nameCode, pattern),
        ),
      )
      .orderBy(core_users.name)
      .limit(10);
    const people = await loadReportPeople(
      c,
      rows.map(row => row.id),
    );

    return c.json(
      {
        items: rows.flatMap(row => {
          const person = people.get(row.id);

          return person ? [person] : [];
        }),
      },
      200,
    );
  },
});

export const memberStandingRoute = buildRoute({
  route: {
    method: "get",
    path: "/members/{id}",
    description:
      "A member's standing for the ModCP: global active points, the warnings this moderator may see and, with `can_view_sanctions`, their sanctions",
    request: { params: idParams },
    responses: {
      200: json(
        z.object({
          user: reportPersonSchema,
          activePoints: z.number(),
          hiddenWarnings: z.number(),
          warnings: z.array(staffWarningSchema),
          sanctions: z.array(sanctionSchema).nullable(),
          permissions: z.object({
            warn: z.boolean(),
            revoke: z.boolean(),
            viewSanctions: z.boolean(),
            manageSanctions: z.boolean(),
          }),
        }),
        "The member's standing",
      ),
      401: commonResponses[401],
      403: { description: "Not a moderator" },
      404: json(errorSchema, "No such member"),
    },
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    const { id } = c.req.valid("param");
    const has = (
      permission: (typeof WARNING_PERMISSIONS)[keyof typeof WARNING_PERMISSIONS],
    ) => hasWarningPermission(moderator.set, permission);
    if (!has(WARNING_PERMISSIONS.view) && !canWarnAnywhere(c, moderator.set)) {
      throw new HTTPException(403, { message: "Forbidden" });
    }

    const people = await loadReportPeople(c, [id]);
    const user = people.get(id);
    if (!user) return c.json({ error: "not_found" }, 404);

    const now = new Date();
    const viewSanctions = has(WARNING_PERMISSIONS.viewSanctions);
    const [rows, sanctionRows, activePoints] = await Promise.all([
      loadUserWarnings(c, id),
      viewSanctions ? loadUserSanctions(c, id) : null,
      loadActivePoints(c.get("db"), id, now),
    ]);
    const warnings = await serializeStaffWarnings(c, moderator, rows, now);

    return c.json(
      {
        user,
        activePoints,
        hiddenWarnings: rows.length - warnings.length,
        warnings,
        sanctions: sanctionRows
          ? await serializeSanctions(c, sanctionRows, now)
          : null,
        permissions: {
          warn: has(WARNING_PERMISSIONS.warn) && id !== moderator.user.id,
          revoke: has(WARNING_PERMISSIONS.revoke),
          viewSanctions,
          manageSanctions: has(WARNING_PERMISSIONS.manageSanctions),
        },
      },
      200,
    );
  },
});
