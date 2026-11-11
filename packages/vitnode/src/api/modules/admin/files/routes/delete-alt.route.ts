import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { core_files_alt } from "@/database/files";

export const deleteFileAltAdminRoute = buildRoute({
  adminStaffPermission: { module: "files", permission: "can_edit_alt" },
  route: {
    method: "delete",
    description: "Remove an image's ALT text in one language.",
    path: "/{id}/alt",
    request: {
      params: z.object({ id: z.coerce.number().int() }),
      query: z.object({ languageCode: z.string().min(2).max(32) }),
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ ok: z.literal(true) }) },
        },
        description: "Removed",
      },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const { languageCode } = c.req.valid("query");
    const removed = await c
      .get("db")
      .delete(core_files_alt)
      .where(
        and(
          eq(core_files_alt.fileId, id),
          eq(core_files_alt.languageCode, languageCode),
        ),
      )
      .returning({ origin: core_files_alt.origin });
    if (removed.length > 0) {
      await c.get("events").emit("files.alt.updated", {
        fileId: id,
        languageCodes: [languageCode],
        origin: removed[0].origin,
      });
    }

    return c.json({ ok: true as const }, 200);
  },
});
