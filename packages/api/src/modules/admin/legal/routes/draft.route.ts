import { buildRoute } from "@/builders";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { legalDraftProblems } from "@/lib/legal/publish.server";

import {
  zodAdminLegalDraftContext,
  zodDocumentTypeParam,
} from "../legal.schema";
import {
  adminLegalDraftOf,
  adminLegalVersionsOf,
  adminLegalVersionSummaries,
} from "../lib";

export const draftLegalAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.legal.canView,
  route: {
    method: "get",
    description:
      "The draft of a legal document (or `null`), what still keeps it from being announced, and the context the editor needs.",
    path: "/{documentType}/draft",
    request: { params: zodDocumentTypeParam },
    responses: {
      200: {
        content: { "application/json": { schema: zodAdminLegalDraftContext } },
        description: "Draft",
      },
    },
  },
  handler: async c => {
    const { documentType } = c.req.valid("param");
    const versions = await adminLegalVersionsOf(c, documentType);
    const draft = await adminLegalDraftOf(c, documentType, versions);
    const summaries = await adminLegalVersionSummaries(c, versions.slice(0, 2));
    const defaultLanguageCode = c.get("core").i18n.defaultLocale;

    return c.json(
      {
        acceptanceForced: documentType === "terms" && versions.length === 0,
        current: summaries.find(item => item.status === "current") ?? null,
        defaultLanguageCode,
        draft,
        emailConfigured: Boolean(c.get("core").email?.adapter),
        nextVersion: (versions[0]?.version ?? 0) + 1,
        problems: draft
          ? legalDraftProblems(
              { ...draft, documentType },
              {
                defaultLanguageCode,
                hasPreviousVersion: versions.length > 0,
              },
            )
          : [],
        upcoming: summaries.find(item => item.status === "upcoming") ?? null,
        versions: versions.map(({ id, version }) => ({ id, version })),
      },
      200,
    );
  },
});
