import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/builders";
import { core_legal_drafts } from "@/database/legal";
import { legalDraftUpdatedEvent } from "@/events/legal";
import { writeAuditLog } from "@/lib/audit/write";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { throwLegalError } from "@/lib/legal/acceptance.server";
import { LEGAL_ERROR_CODES } from "@/lib/legal/contract";

import {
  zodAdminLegalDraft,
  zodAdminLegalDraftUpdate,
  zodDocumentTypeParam,
} from "../legal.schema";
import { adminLegalVersionsOf, serializeAdminLegalDraft } from "../lib";

export const updateDraftLegalAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.legal.canEdit,
  route: {
    method: "put",
    description:
      "Save the draft of a legal document: titles, bodies, the change summary and checkbox wording per language, the acceptance mode and the planned effective date.",
    path: "/{documentType}/draft",
    request: {
      params: zodDocumentTypeParam,
      body: {
        required: true,
        content: { "application/json": { schema: zodAdminLegalDraftUpdate } },
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: zodAdminLegalDraft } },
        description: "Saved",
      },
      404: { description: "No draft" },
      409: { description: "`LEGAL_DRAFT_CONFLICT`: someone saved it first" },
    },
  },
  handler: async c => {
    const { documentType } = c.req.valid("param");
    const body = c.req.valid("json");
    const actorId = c.get("admin")?.user.id ?? null;

    const draft = await c.get("db").transaction(async tx => {
      const [current] = await tx
        .select({ revision: core_legal_drafts.revision })
        .from(core_legal_drafts)
        .where(eq(core_legal_drafts.documentType, documentType))
        .for("update")
        .limit(1);
      if (!current) throw new HTTPException(404);
      if (current.revision !== body.revision) {
        return throwLegalError(409, LEGAL_ERROR_CODES.draftConflict, {
          revision: current.revision,
        });
      }

      const [saved] = await tx
        .update(core_legal_drafts)
        .set({
          acceptanceLabel: body.acceptanceLabel,
          body: body.body,
          effectiveAt: body.effectiveAt ? new Date(body.effectiveAt) : null,
          requiresAcceptance:
            documentType === "terms" ? body.requiresAcceptance : false,
          revision: current.revision + 1,
          summary: body.summary,
          title: body.title,
          updatedById: actorId,
        })
        .where(
          and(
            eq(core_legal_drafts.documentType, documentType),
            eq(core_legal_drafts.revision, body.revision),
          ),
        )
        .returning();
      if (!saved) throw new Error("The draft was not saved.");

      await writeAuditLog(
        c,
        {
          action: "legal.draft_saved",
          metadata: { revision: saved.revision },
          target: {
            id: documentType,
            label: documentType,
            type: "legal_document",
          },
        },
        tx,
      );

      return saved;
    });

    await c.get("events").emit(legalDraftUpdatedEvent, {
      action: "saved",
      actorId,
      documentType,
    });

    return c.json(
      await serializeAdminLegalDraft(
        c,
        draft,
        await adminLegalVersionsOf(c, documentType),
      ),
      200,
    );
  },
});
