import { eq } from "drizzle-orm";
import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { core_files } from "@/database/files";

import { zodAltPolicy } from "../alt.schema";

export const updateFileAltPolicyAdminRoute = buildRoute({
  adminStaffPermission: { module: "files", permission: "can_edit_alt" },
  route: {
    method: "put",
    description:
      "Choose whether automatic ALT may describe this file: automatic, manual only, or disabled (never sent to an external AI).",
    path: "/{id}/alt-policy",
    request: {
      params: z.object({ id: z.coerce.number().int() }),
      body: {
        required: true,
        content: {
          "application/json": { schema: z.object({ altPolicy: zodAltPolicy }) },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ ok: z.literal(true) }) },
        },
        description: "Saved",
      },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const { altPolicy } = c.req.valid("json");
    await c
      .get("db")
      .update(core_files)
      .set({ altPolicy })
      .where(eq(core_files.id, id));

    return c.json({ ok: true as const }, 200);
  },
});
