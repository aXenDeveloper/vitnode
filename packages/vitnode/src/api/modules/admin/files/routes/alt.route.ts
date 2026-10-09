import { and, asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_files, core_files_alt } from "@/database/files";
import { core_languages } from "@/database/languages";

const zodAltPolicy = z.enum(["automatic", "manual", "disabled"]);

export const getFileAltAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
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

export const updateFileAltAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
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

export const deleteFileAltAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
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

export const updateFileAltPolicyAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
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
