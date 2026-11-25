import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/builders";
import { core_legal_drafts } from "@/database/legal";
import { legalDraftUpdatedEvent } from "@/events/legal";
import { writeAuditLog } from "@/lib/audit/write";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

import { zodDocumentTypeParam } from "../legal.schema";

export const deleteDraftLegalAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.legal.canEdit,
  route: {
    method: "delete",
    description: "Discard the draft of a legal document.",
    path: "/{documentType}/draft",
    request: { params: zodDocumentTypeParam },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ ok: z.literal(true) }) },
        },
        description: "Discarded",
      },
      404: { description: "No draft" },
    },
  },
  handler: async c => {
    const { documentType } = c.req.valid("param");
    const actorId = c.get("admin")?.user.id ?? null;

    await c.get("db").transaction(async tx => {
      const deleted = await tx
        .delete(core_legal_drafts)
        .where(eq(core_legal_drafts.documentType, documentType))
        .returning({ revision: core_legal_drafts.revision });
      if (deleted.length === 0) throw new HTTPException(404);
      await writeAuditLog(
        c,
        {
          action: "legal.draft_discarded",
          target: {
            id: documentType,
            label: documentType,
            type: "legal_document",
          },
        },
        tx,
      );
    });

    await c.get("events").emit(legalDraftUpdatedEvent, {
      action: "discarded",
      actorId,
      documentType,
    });

    return c.json({ ok: true as const }, 200);
  },
});
