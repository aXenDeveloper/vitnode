import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/builders";
import { core_legal_drafts, core_legal_versions } from "@/database/legal";
import { legalDraftUpdatedEvent } from "@/events/legal";
import { writeAuditLog } from "@/lib/audit/write";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

import { zodAdminLegalDraft, zodDocumentTypeParam } from "../legal.schema";
import { adminLegalVersionsOf, serializeAdminLegalDraft } from "../lib";

export const createDraftLegalAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.legal.canEdit,
  route: {
    method: "post",
    description:
      "Start the draft of a legal document, empty or as a copy of an announced version. A document type has at most one draft.",
    path: "/{documentType}/draft",
    request: {
      params: zodDocumentTypeParam,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              /** Copy this version's content; `null` starts empty. */
              basedOnVersionId: z.number().int().positive().nullable(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: zodAdminLegalDraft } },
        description: "Draft created",
      },
      404: { description: "The version to copy does not exist" },
      409: { description: "A draft already exists" },
    },
  },
  handler: async c => {
    const { documentType } = c.req.valid("param");
    const { basedOnVersionId } = c.req.valid("json");
    const actorId = c.get("admin")?.user.id ?? null;
    const db = c.get("db");

    const [source] = basedOnVersionId
      ? await db
          .select()
          .from(core_legal_versions)
          .where(
            and(
              eq(core_legal_versions.id, basedOnVersionId),
              eq(core_legal_versions.documentType, documentType),
            ),
          )
          .limit(1)
      : [];
    if (basedOnVersionId && !source) throw new HTTPException(404);

    const draft = await db.transaction(async tx => {
      const [inserted] = await tx
        .insert(core_legal_drafts)
        .values({
          acceptanceLabel: source?.acceptanceLabel ?? [],
          basedOnVersionId: source?.id ?? null,
          body: source?.body ?? [],
          createdById: actorId,
          documentType,
          requiresAcceptance: false,
          summary: [],
          title: source?.title ?? [],
          updatedById: actorId,
        })
        .onConflictDoNothing()
        .returning();
      if (!inserted) {
        throw new HTTPException(409, { message: "A draft already exists." });
      }
      await writeAuditLog(
        c,
        {
          action: "legal.draft_created",
          metadata: { basedOnVersion: source?.version ?? null },
          target: {
            id: documentType,
            label: documentType,
            type: "legal_document",
          },
        },
        tx,
      );

      return inserted;
    });

    await c.get("events").emit(legalDraftUpdatedEvent, {
      action: "created",
      actorId,
      documentType,
    });

    return c.json(
      await serializeAdminLegalDraft(
        c,
        draft,
        await adminLegalVersionsOf(c, documentType),
      ),
      201,
    );
  },
});
