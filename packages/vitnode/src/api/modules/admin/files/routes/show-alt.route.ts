import { asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { core_files, core_files_alt } from "@/database/files";
import { core_languages } from "@/database/languages";

import { zodAltPolicy } from "../alt.schema";

export const getFileAltAdminRoute = buildRoute({
  adminStaffPermission: { module: "files", permission: "can_view" },
  route: {
    method: "get",
    description: "An image's default ALT text in every site language.",
    path: "/{id}/alt",
    request: { params: z.object({ id: z.coerce.number().int() }) },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              altPolicy: zodAltPolicy,
              languages: z.array(
                z.object({
                  code: z.string(),
                  name: z.string(),
                  origin: z.enum(["ai", "human"]).nullable(),
                  stale: z.boolean(),
                  text: z.string().nullable(),
                  updatedAt: z.date().nullable(),
                }),
              ),
            }),
          },
        },
        description: "ALT texts",
      },
      404: { description: "No such file" },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const db = c.get("db");
    const [file] = await db
      .select({
        altPolicy: core_files.altPolicy,
        fingerprint: core_files.fingerprint,
      })
      .from(core_files)
      .where(eq(core_files.id, id));
    if (!file) throw new HTTPException(404, { message: "File not found" });

    const [languages, rows] = await Promise.all([
      db
        .select({ code: core_languages.code, name: core_languages.name })
        .from(core_languages)
        .orderBy(asc(core_languages.code)),
      db.select().from(core_files_alt).where(eq(core_files_alt.fileId, id)),
    ]);

    return c.json(
      {
        altPolicy: file.altPolicy,
        languages: languages.map(language => {
          const row = rows.find(entry => entry.languageCode === language.code);

          return {
            code: language.code,
            name: language.name,
            origin: row?.origin ?? null,
            stale:
              row?.origin === "ai" &&
              file.fingerprint !== null &&
              row.fileFingerprint !== file.fingerprint,
            text: row?.text ?? null,
            updatedAt: row?.updatedAt ?? null,
          };
        }),
      },
      200,
    );
  },
});
