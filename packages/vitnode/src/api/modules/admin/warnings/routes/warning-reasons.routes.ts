import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { count, eq, inArray, max, sql } from "drizzle-orm";

import { buildRoute } from "@/api/builders";
import {
  appendModerationAudit,
  listWarningReasons,
  WARNING_REASON_WORDS,
  warningReasonSchema,
} from "@/api/lib/moderation/warnings/reasons";
import { saveLanguageWords } from "@/api/lib/save-language-words";
import { errorSchema, json } from "@/api/modules/moderation/lib/schema";
import { core_moderation_warning_reasons } from "@/database/warnings";
import { WARNING_LIMITS } from "@/lib/moderation/warnings";

const wordsSchema = (maxLength: number) =>
  z.array(
    z.object({
      languageCode: z.string(),
      value: z.string().trim().max(maxLength),
    }),
  );

const reasonBody = z.object({
  title: z
    .array(
      z.object({
        languageCode: z.string(),
        value: z
          .string()
          .trim()
          .min(1)
          .max(WARNING_LIMITS.reasonTitleMaxLength),
      }),
    )
    .min(1),
  description: wordsSchema(WARNING_LIMITS.reasonDescriptionMaxLength),
  message: wordsSchema(WARNING_LIMITS.reasonMessageMaxLength),
  points: z.number().int().min(0).max(WARNING_LIMITS.maxPoints),
  expiresAfterHours: z
    .number()
    .int()
    .min(1)
    .max(WARNING_LIMITS.maxDurationHours)
    .nullable(),
  enabled: z.boolean(),
});

const idParams = z.object({
  id: z.coerce.number().int().positive().openapi({ example: 1 }),
});

const LOCK_REASONS = sql`lock table ${core_moderation_warning_reasons} in share row exclusive mode`;

const saveReasonWords = async (
  c: Context,
  reasonId: number,
  body: Partial<z.infer<typeof reasonBody>>,
) => {
  for (const variable of ["title", "description", "message"] as const) {
    const values = body[variable];
    if (values === undefined) continue;
    await saveLanguageWords(c, {
      ...WARNING_REASON_WORDS,
      itemId: reasonId,
      values: values.filter(item => item.value.length > 0),
      variable,
    });
  }
};

/** What an audit entry keeps of a reason: settings, never the words. */
const auditedSettings = (body: Partial<z.infer<typeof reasonBody>>) => ({
  enabled: body.enabled,
  expiresAfterHours: body.expiresAfterHours,
  points: body.points,
});

export const listWarningReasonsAdminRoute = buildRoute({
  adminStaffPermission: { module: "warning_settings", permission: "can_view" },
  route: {
    method: "get",
    path: "/reasons",
    description:
      "Every warning reason in display order, disabled ones too (Admin only)",
    responses: {
      200: json(
        z.object({ reasons: z.array(warningReasonSchema) }),
        "Warning reasons",
      ),
      403: { description: "Access Denied" },
    },
  },
  handler: async c => c.json({ reasons: await listWarningReasons(c) }, 200),
});

export const createWarningReasonAdminRoute = buildRoute({
  adminStaffPermission: {
    module: "warning_settings",
    permission: "can_manage",
  },
  route: {
    method: "post",
    path: "/reasons",
    description: `Add a warning reason at the end of the list (Admin only). There can be at most ${WARNING_LIMITS.maxReasons}`,
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: reasonBody } },
      },
    },
    responses: {
      201: json(z.object({ id: z.number() }), "Warning reason created"),
      403: { description: "Access Denied" },
      409: json(errorSchema, "The list already holds the maximum number"),
    },
  },
  handler: async c => {
    const body = c.req.valid("json");
    const created = await c.get("db").transaction(async tx => {
      await tx.execute(LOCK_REASONS);
      const [{ position: lastPosition, total }] = await tx
        .select({
          position: max(core_moderation_warning_reasons.position),
          total: count(),
        })
        .from(core_moderation_warning_reasons);
      if (total >= WARNING_LIMITS.maxReasons) return null;

      const [row] = await tx
        .insert(core_moderation_warning_reasons)
        .values({
          enabled: body.enabled,
          expiresAfterHours: body.expiresAfterHours,
          points: body.points,
          position: (lastPosition ?? -1) + 1,
        })
        .returning({ id: core_moderation_warning_reasons.id });
      await appendModerationAudit(tx, {
        actorId: c.get("admin")?.user.id ?? null,
        data: { reasonId: row.id, ...auditedSettings(body) },
        type: "reason_created",
      });

      return row;
    });
    if (!created) return c.json({ error: "limit_reached" }, 409);

    await saveReasonWords(c, created.id, body);
    await c
      .get("events")
      .emit("moderation.warning_reason.created", { reasonId: created.id });

    return c.json({ id: created.id }, 201);
  },
});

export const updateWarningReasonAdminRoute = buildRoute({
  adminStaffPermission: {
    module: "warning_settings",
    permission: "can_manage",
  },
  route: {
    method: "patch",
    path: "/reasons/{id}",
    description:
      "Edit or disable a warning reason (Admin only). Warnings already issued keep the points, expiry and title they were issued with",
    request: {
      params: idParams,
      body: {
        required: true,
        content: { "application/json": { schema: reasonBody.partial() } },
      },
    },
    responses: {
      200: json(z.object({ id: z.number() }), "Warning reason updated"),
      403: { description: "Access Denied" },
      404: json(errorSchema, "Warning reason not found"),
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const settings = auditedSettings(body);
    const patch = Object.fromEntries(
      Object.entries(settings).filter(([, value]) => value !== undefined),
    );

    const found = await c.get("db").transaction(async tx => {
      const [row] = await tx
        .select({ id: core_moderation_warning_reasons.id })
        .from(core_moderation_warning_reasons)
        .where(eq(core_moderation_warning_reasons.id, id))
        .limit(1);
      if (!row) return false;
      if (Object.keys(patch).length > 0) {
        await tx
          .update(core_moderation_warning_reasons)
          .set(patch)
          .where(eq(core_moderation_warning_reasons.id, id));
      }
      await appendModerationAudit(tx, {
        actorId: c.get("admin")?.user.id ?? null,
        data: {
          reasonId: id,
          ...patch,
          wordsChanged: body.title !== undefined,
        },
        type: "reason_updated",
      });

      return true;
    });
    if (!found) return c.json({ error: "not_found" }, 404);

    await saveReasonWords(c, id, body);
    await c
      .get("events")
      .emit("moderation.warning_reason.updated", { reasonId: id });

    return c.json({ id }, 200);
  },
});

export const reorderWarningReasonsAdminRoute = buildRoute({
  adminStaffPermission: {
    module: "warning_settings",
    permission: "can_manage",
  },
  route: {
    method: "put",
    path: "/reasons/reorder",
    description:
      "Set the order of every warning reason at once (Admin only). `ids` must list each reason exactly once",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({ ids: z.array(z.number().int()).min(1) }),
          },
        },
      },
    },
    responses: {
      200: { description: "Order saved" },
      400: json(errorSchema, "`ids` does not match the current reasons"),
      403: { description: "Access Denied" },
    },
  },
  handler: async c => {
    const { ids } = c.req.valid("json");
    const db = c.get("db");
    const current = await db
      .select({ id: core_moderation_warning_reasons.id })
      .from(core_moderation_warning_reasons);
    const known = new Set(current.map(row => row.id));
    if (
      ids.length !== known.size ||
      new Set(ids).size !== ids.length ||
      ids.some(id => !known.has(id))
    ) {
      return c.json({ error: "mismatch" }, 400);
    }

    const positionById = sql.join(
      ids.map(
        (id, position) =>
          sql`when ${core_moderation_warning_reasons.id} = ${id} then ${position}::integer`,
      ),
      sql` `,
    );
    await db
      .update(core_moderation_warning_reasons)
      .set({ position: sql`case ${positionById} end` })
      .where(inArray(core_moderation_warning_reasons.id, ids));

    return c.body(null, 200);
  },
});
