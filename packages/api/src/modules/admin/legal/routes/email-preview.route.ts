import { eq, max } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/builders";
import { core_legal_drafts, core_legal_versions } from "@/database/legal";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { buildLegalUpdateEmail } from "@/lib/legal/delivery.server";

import { zodDocumentTypeParam } from "../legal.schema";

export const emailPreviewLegalAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.legal.canView,
  route: {
    method: "get",
    description:
      "Render the announcement email the draft would send, in one language, exactly as members would get it.",
    path: "/{documentType}/draft/email-preview",
    request: {
      params: zodDocumentTypeParam,
      query: z.object({ locale: z.string().min(1).max(32) }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              subject: z.string(),
              html: z.string(),
              text: z.string(),
            }),
          },
        },
        description: "Rendered email",
      },
      404: { description: "No draft" },
    },
  },
  handler: async c => {
    const { documentType } = c.req.valid("param");
    const { locale } = c.req.valid("query");
    const db = c.get("db");
    const [draft] = await db
      .select()
      .from(core_legal_drafts)
      .where(eq(core_legal_drafts.documentType, documentType))
      .limit(1);
    if (!draft) throw new HTTPException(404);
    const [latest] = await db
      .select({ version: max(core_legal_versions.version) })
      .from(core_legal_versions)
      .where(eq(core_legal_versions.documentType, documentType));
    const version = (latest?.version ?? 0) + 1;

    const email = await buildLegalUpdateEmail(
      c,
      {
        ...draft,
        defaultLanguageCode: c.get("core").i18n.defaultLocale,
        effectiveAt: draft.effectiveAt ?? new Date(),
        requiresAcceptance:
          documentType === "terms" &&
          (version === 1 || draft.requiresAcceptance),
        version,
      },
      {
        email: c.get("admin")?.user.email ?? "preview@example.com",
        language: locale,
      },
    );
    c.header("Cache-Control", "no-store");

    return c.json(
      { html: email.html, subject: email.subject, text: email.text },
      200,
    );
  },
});
