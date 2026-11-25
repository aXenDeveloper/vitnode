import { desc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/builders";
import { core_legal_acceptances, core_legal_versions } from "@/database/legal";
import { zodLegalAcceptanceRecord } from "@/lib/legal/contract";

export const acceptancesLegalRoute = buildRoute({
  termsAcceptance: "exempt",
  route: {
    method: "get",
    description:
      "The signed-in member's own Terms of Service acceptances, newest first: version, time, language and the wording accepted.",
    path: "/me/acceptances",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ items: z.array(zodLegalAcceptanceRecord) }),
          },
        },
        description: "Acceptance history",
      },
      401: { description: "Not signed in" },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401);
    const rows = await c
      .get("db")
      .select({
        acceptance: core_legal_acceptances,
        documentType: core_legal_versions.documentType,
        version: core_legal_versions.version,
      })
      .from(core_legal_acceptances)
      .innerJoin(
        core_legal_versions,
        eq(core_legal_versions.id, core_legal_acceptances.versionId),
      )
      .where(eq(core_legal_acceptances.userId, user.id))
      .orderBy(desc(core_legal_acceptances.acceptedAt));
    c.header("Cache-Control", "private, no-store");

    return c.json(
      {
        items: rows.map(({ acceptance, documentType, version }) => ({
          acceptedAt: acceptance.acceptedAt.toISOString(),
          documentType,
          id: acceptance.id,
          locale: acceptance.locale,
          source: acceptance.source,
          version,
          versionId: acceptance.versionId,
          wording: acceptance.wording,
        })),
      },
      200,
    );
  },
});
