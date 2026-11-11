import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { core_files, core_files_alt } from "@/database/files";
import { core_languages } from "@/database/languages";

export const updateFileAltAdminRoute = buildRoute({
  adminStaffPermission: { module: "files", permission: "can_edit_alt" },
  route: {
    method: "put",
    description: "Set an image's ALT text in one language.",
    path: "/{id}/alt",
    request: {
      params: z.object({ id: z.coerce.number().int() }),
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              languageCode: z.string().min(2).max(32),
              text: z.string().max(1_000),
            }),
          },
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
      404: { description: "No such file or language" },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const { languageCode, text } = c.req.valid("json");
    const db = c.get("db");
    const [[file], [language]] = await Promise.all([
      db
        .select({ fingerprint: core_files.fingerprint })
        .from(core_files)
        .where(eq(core_files.id, id)),
      db
        .select({ code: core_languages.code })
        .from(core_languages)
        .where(eq(core_languages.code, languageCode)),
    ]);
    if (!file) throw new HTTPException(404, { message: "File not found" });
    if (!language) {
      throw new HTTPException(404, { message: "Unknown language" });
    }

    const values = {
      fileFingerprint: file.fingerprint,
      origin: "human" as const,
      runId: null,
      text: text.trim(),
      updatedById: c.get("admin")?.user.id ?? null,
    };
    await db
      .insert(core_files_alt)
      .values({ ...values, fileId: id, languageCode })
      .onConflictDoUpdate({
        set: { ...values, updatedAt: new Date() },
        target: [core_files_alt.fileId, core_files_alt.languageCode],
      });
    await c.get("events").emit("files.alt.updated", {
      fileId: id,
      languageCodes: [languageCode],
      origin: "human",
    });

    return c.json({ ok: true as const }, 200);
  },
});
