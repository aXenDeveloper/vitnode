import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/builders";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { announceLegalDraft } from "@/lib/legal/publish.server";

import {
  zodAdminLegalPublish,
  zodAdminLegalVersion,
  zodDocumentTypeParam,
} from "../legal.schema";
import { adminLegalVersion } from "../lib";

export const publishLegalAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.legal.canPublish,
  route: {
    method: "post",
    description:
      "Announce the draft as the next immutable version, effective now or at a later time, and queue the mandatory announcement email to every member in the same transaction.",
    path: "/{documentType}/publish",
    request: {
      params: zodDocumentTypeParam,
      body: {
        required: true,
        content: { "application/json": { schema: zodAdminLegalPublish } },
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: zodAdminLegalVersion } },
        description: "Announced",
      },
      400: {
        description: "The draft is incomplete or the date is in the past",
      },
      404: { description: "No draft" },
      409: {
        description:
          "`LEGAL_EMAIL_ADAPTER_MISSING`, `LEGAL_UPCOMING_VERSION_EXISTS` or `LEGAL_DRAFT_CONFLICT`",
      },
    },
  },
  handler: async c => {
    const { documentType } = c.req.valid("param");
    const body = c.req.valid("json");
    const admin = c.get("admin");
    if (!admin) throw new HTTPException(403);

    const version = await announceLegalDraft(c, {
      actorId: admin.user.id,
      documentType,
      effectiveAt: new Date(body.effectiveAt),
      requiresAcceptance: body.requiresAcceptance,
      revision: body.revision,
    });
    const detail = await adminLegalVersion(c, version.id);
    if (!detail) throw new Error("The announced version vanished.");

    return c.json(detail, 201);
  },
});
