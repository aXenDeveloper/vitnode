import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/builders";
import {
  core_legal_notice_dismissals,
  core_legal_versions,
} from "@/database/legal";

export const dismissLegalRoute = buildRoute({
  termsAcceptance: "exempt",
  route: {
    method: "post",
    description:
      "Dismiss the informational notice of one version. Records only the dismissal - never an acceptance.",
    path: "/notices/{versionId}/dismiss",
    request: {
      params: z.object({ versionId: z.coerce.number().int().positive() }),
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ ok: z.literal(true) }) },
        },
        description: "Dismissed",
      },
      401: { description: "Not signed in" },
      404: { description: "No such version" },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401);
    const { versionId } = c.req.valid("param");
    const db = c.get("db");
    const [version] = await db
      .select({ id: core_legal_versions.id })
      .from(core_legal_versions)
      .where(eq(core_legal_versions.id, versionId))
      .limit(1);
    if (!version) throw new HTTPException(404);

    await db
      .insert(core_legal_notice_dismissals)
      .values({ userId: user.id, versionId })
      .onConflictDoNothing();

    return c.json({ ok: true as const }, 200);
  },
});
