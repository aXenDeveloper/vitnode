import { count } from "drizzle-orm";

import { buildRoute } from "@/builders";
import { core_legal_drafts, core_legal_versions } from "@/database/legal";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { LEGAL_DOCUMENT_TYPES } from "@/lib/legal/contract";

import { zodAdminLegalOverview } from "../legal.schema";
import { adminLegalVersionsOf, adminLegalVersionSummaries } from "../lib";

export const overviewLegalAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.legal.canView,
  route: {
    method: "get",
    description:
      "Each legal document type with its effective and upcoming version, its draft and how many versions were announced.",
    path: "/",
    responses: {
      200: {
        content: { "application/json": { schema: zodAdminLegalOverview } },
        description: "Legal documents overview",
      },
    },
  },
  handler: async c => {
    const db = c.get("db");
    const drafts = await db.select().from(core_legal_drafts);
    const counts = await db
      .select({
        count: count(),
        documentType: core_legal_versions.documentType,
      })
      .from(core_legal_versions)
      .groupBy(core_legal_versions.documentType);

    const documents = await Promise.all(
      LEGAL_DOCUMENT_TYPES.map(async documentType => {
        const rows = await adminLegalVersionsOf(c, documentType);
        const summaries = await adminLegalVersionSummaries(c, rows.slice(0, 2));
        const draft = drafts.find(item => item.documentType === documentType);
        const basedOn = rows.find(row => row.id === draft?.basedOnVersionId);

        return {
          current: summaries.find(item => item.status === "current") ?? null,
          documentType,
          draft: draft
            ? {
                basedOnVersion: basedOn?.version ?? null,
                revision: draft.revision,
                updatedAt: draft.updatedAt.toISOString(),
              }
            : null,
          upcoming: summaries.find(item => item.status === "upcoming") ?? null,
          versionsCount:
            counts.find(item => item.documentType === documentType)?.count ?? 0,
        };
      }),
    );

    return c.json(
      { documents, emailConfigured: Boolean(c.get("core").email?.adapter) },
      200,
    );
  },
});
