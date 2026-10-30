import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { and, count, eq, inArray, max, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";

import { buildRoute } from "@/api/builders";
import { multiLangAuditLabel } from "@/api/lib/audit/labels";
import { writeAuditLog } from "@/api/lib/audit/write";
import {
  listReportReasons,
  REPORT_REASON_WORDS,
  reportReasonSchema,
} from "@/api/lib/moderation/report-reasons";
import { saveLanguageWords } from "@/api/lib/save-language-words";
import { errorSchema, json } from "@/api/modules/moderation/lib/schema";
import { core_languages_words } from "@/database/languages";
import { core_moderation_report_reasons } from "@/database/moderation";
import { auditDiff } from "@/lib/audit/diff";
import { MODERATION_LIMITS } from "@/lib/moderation/const";

const titleSchema = z
  .array(
    z.object({
      languageCode: z.string(),
      value: z
        .string()
        .trim()
        .min(1)
        .max(MODERATION_LIMITS.reasonTitleMaxLength),
    }),
  )
  .min(1);

const descriptionSchema = z.array(
  z.object({
    languageCode: z.string(),
    value: z.string().trim().max(MODERATION_LIMITS.reasonDescriptionMaxLength),
  }),
);

const reasonBody = z.object({
  title: titleSchema,
  description: descriptionSchema,
  requiresDetails: z.boolean(),
});

const idParams = z.object({
  id: z.coerce.number().int().positive().openapi({ example: 1 }),
});

const LOCK_REASONS = sql`lock table ${core_moderation_report_reasons} in share row exclusive mode`;

const filledIn = (values: z.infer<typeof descriptionSchema>) =>
  values.filter(item => item.value.length > 0);

const saveReasonWords = async (
  c: Context,
  reasonId: number,
  body: Partial<z.infer<typeof reasonBody>>,
) => {
  if (body.title !== undefined) {
    await saveLanguageWords(c, {
      ...REPORT_REASON_WORDS,
      itemId: reasonId,
      values: filledIn(body.title),
      variable: "title",
    });
  }
  if (body.description !== undefined) {
    await saveLanguageWords(c, {
      ...REPORT_REASON_WORDS,
      itemId: reasonId,
      values: filledIn(body.description),
      variable: "description",
    });
  }
};

const findReasonRow = async (c: Context, id: number) => {
  const [row] = await c
    .get("db")
    .select({
      code: core_moderation_report_reasons.code,
      id: core_moderation_report_reasons.id,
      requiresDetails: core_moderation_report_reasons.requiresDetails,
    })
    .from(core_moderation_report_reasons)
    .where(eq(core_moderation_report_reasons.id, id))
    .limit(1);

  return row;
};

export const listReportReasonsAdminRoute = buildRoute({
  adminStaffPermission: { module: "report_reasons", permission: "can_view" },
  route: {
    method: "get",
    path: "/",
    description: "Every report reason in display order (Admin only)",
    responses: {
      200: json(
        z.object({ reasons: z.array(reportReasonSchema) }),
        "Report reasons",
      ),
      403: { description: "Access Denied" },
    },
  },
  handler: async c => c.json({ reasons: await listReportReasons(c) }, 200),
});

export const createReportReasonAdminRoute = buildRoute({
  adminStaffPermission: { module: "report_reasons", permission: "can_create" },
  route: {
    method: "post",
    path: "/create",
    description:
      "Add a report reason at the end of the list (Admin only). Members see it in the report dialog right away. There can be at most 10 reasons",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: reasonBody } },
      },
    },
    responses: {
      201: json(z.object({ id: z.number() }), "Report reason created"),
      403: { description: "Access Denied" },
      409: json(
        errorSchema,
        "The list already holds the maximum number of reasons",
      ),
    },
  },
  handler: async c => {
    const body = c.req.valid("json");
    const code = `reason_${randomBytes(6).toString("hex")}`;
    const created = await c.get("db").transaction(async tx => {
      await tx.execute(LOCK_REASONS);
      const [{ position: lastPosition, total }] = await tx
        .select({
          position: max(core_moderation_report_reasons.position),
          total: count(),
        })
        .from(core_moderation_report_reasons);
      if (total >= MODERATION_LIMITS.maxReportReasons) return null;

      const [row] = await tx
        .insert(core_moderation_report_reasons)
        .values({
          code,
          position: (lastPosition ?? -1) + 1,
          requiresDetails: body.requiresDetails,
        })
        .returning({ id: core_moderation_report_reasons.id });

      await writeAuditLog(
        c,
        {
          action: "report_reason.created",
          changes: auditDiff({
            after: {
              requiresDetails: body.requiresDetails,
              title: multiLangAuditLabel(body.title),
            },
            before: null,
          }),
          target: {
            id: row.id,
            label: multiLangAuditLabel(body.title),
            type: "report_reason",
          },
        },
        tx,
      );

      return row;
    });
    if (!created) return c.json({ error: "limit_reached" }, 409);

    await saveReasonWords(c, created.id, body);
    await c
      .get("events")
      .emit("moderation.report_reason.created", { code, reasonId: created.id });

    return c.json({ id: created.id }, 201);
  },
});

export const updateReportReasonAdminRoute = buildRoute({
  adminStaffPermission: { module: "report_reasons", permission: "can_edit" },
  route: {
    method: "patch",
    path: "/{id}",
    description:
      "Edit a report reason (Admin only). Existing reports show the new title",
    request: {
      params: idParams,
      body: {
        required: true,
        content: { "application/json": { schema: reasonBody.partial() } },
      },
    },
    responses: {
      200: json(z.object({ id: z.number() }), "Report reason updated"),
      403: { description: "Access Denied" },
      404: json(errorSchema, "Report reason not found"),
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const row = await findReasonRow(c, id);
    if (!row) return c.json({ error: "not_found" }, 404);

    await c.get("db").transaction(async tx => {
      if (body.requiresDetails !== undefined) {
        await tx
          .update(core_moderation_report_reasons)
          .set({ requiresDetails: body.requiresDetails })
          .where(eq(core_moderation_report_reasons.id, id));
      }
      await writeAuditLog(
        c,
        {
          action: "report_reason.updated",
          changes: auditDiff({
            after: {
              requiresDetails: body.requiresDetails ?? row.requiresDetails,
              ...(body.title === undefined
                ? {}
                : { title: multiLangAuditLabel(body.title) }),
            },
            before: { requiresDetails: row.requiresDetails },
          }),
          metadata:
            body.description === undefined ? {} : { descriptionChanged: true },
          target: {
            id,
            label: multiLangAuditLabel(body.title) ?? row.code,
            type: "report_reason",
          },
        },
        tx,
      );
    });
    await saveReasonWords(c, id, body);
    await c.get("events").emit("moderation.report_reason.updated", {
      code: row.code,
      reasonId: id,
    });

    return c.json({ id }, 200);
  },
});

export const deleteReportReasonAdminRoute = buildRoute({
  adminStaffPermission: { module: "report_reasons", permission: "can_delete" },
  route: {
    method: "delete",
    path: "/{id}",
    description:
      "Delete a report reason (Admin only). Reports filed with it keep the report but lose the reason's title. The last reason cannot be deleted",
    request: { params: idParams },
    responses: {
      200: { description: "Report reason deleted" },
      403: { description: "Access Denied" },
      404: json(errorSchema, "Report reason not found"),
      409: json(errorSchema, "The last reason cannot be deleted"),
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const row = await findReasonRow(c, id);
    if (!row) return c.json({ error: "not_found" }, 404);

    const deleted = await c.get("db").transaction(async tx => {
      await tx.execute(LOCK_REASONS);
      const [{ total }] = await tx
        .select({ total: count() })
        .from(core_moderation_report_reasons);
      if (total <= 1) return false;

      await tx
        .delete(core_languages_words)
        .where(
          and(
            eq(core_languages_words.pluginCode, REPORT_REASON_WORDS.pluginCode),
            eq(core_languages_words.tableName, REPORT_REASON_WORDS.tableName),
            eq(core_languages_words.itemId, id),
          ),
        );
      await tx
        .delete(core_moderation_report_reasons)
        .where(eq(core_moderation_report_reasons.id, id));
      await writeAuditLog(
        c,
        {
          action: "report_reason.deleted",
          target: { id, label: row.code, type: "report_reason" },
        },
        tx,
      );

      return true;
    });
    if (!deleted) return c.json({ error: "last_reason" }, 409);

    await c.get("events").emit("moderation.report_reason.deleted", {
      code: row.code,
      reasonId: id,
    });

    return c.body(null, 200);
  },
});

export const reorderReportReasonsAdminRoute = buildRoute({
  adminStaffPermission: { module: "report_reasons", permission: "can_edit" },
  route: {
    method: "put",
    path: "/reorder",
    description:
      "Set the order of every report reason at once (Admin only). `ids` must list each reason exactly once",
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
      .select({ id: core_moderation_report_reasons.id })
      .from(core_moderation_report_reasons);
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
          sql`when ${core_moderation_report_reasons.id} = ${id} then ${position}::integer`,
      ),
      sql` `,
    );
    await db.transaction(async tx => {
      await tx
        .update(core_moderation_report_reasons)
        .set({ position: sql`case ${positionById} end` })
        .where(inArray(core_moderation_report_reasons.id, ids));
      await writeAuditLog(
        c,
        {
          action: "report_reason.reordered",
          metadata: { order: ids },
          target: { type: "report_reason" },
        },
        tx,
      );
    });
    await c
      .get("events")
      .emit("moderation.report_reason.reordered", { reasonIds: ids });

    return c.body(null, 200);
  },
});
