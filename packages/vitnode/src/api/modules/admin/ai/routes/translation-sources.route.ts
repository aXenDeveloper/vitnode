import type { Context } from "hono";

import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { checkStaffPermission } from "@/api/lib/check-staff-permission";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_ai_translation_sources } from "@/database/ai";

const assertCanEditContent = async (c: Context, contentTypeId: string) => {
  const registered = c
    .get("core")
    .contentTypes.find(entry => entry.definition.id === contentTypeId);
  if (!registered) {
    throw new HTTPException(404, { message: "Unknown content type" });
  }
  const allowed = await checkStaffPermission(c, {
    module: registered.definition.permissionModule,
    permission: "can_edit",
    plugin: registered.pluginId,
    type: "admin",
  });
  if (!allowed) throw new HTTPException(403);
};

const zodTranslationSourceRecord = z.object({
  field: z.string(),
  locale: z.string(),
  origin: z.enum(["ai", "human"]),
  sourceFingerprint: z.string(),
  sourceLocale: z.string(),
  targetFingerprint: z.string(),
  updatedAt: z.date(),
});

export const getTranslationSourcesAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description:
      "What each translated field of an item was translated from, to tell which fields are outdated.",
    path: "/translation-sources",
    request: {
      query: z.object({
        contentTypeId: z.string().min(1).max(255),
        itemId: z.coerce.number().int().positive(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ records: z.array(zodTranslationSourceRecord) }),
          },
        },
        description: "Translation source records",
      },
    },
  },
  handler: async c => {
    const { contentTypeId, itemId } = c.req.valid("query");
    await assertCanEditContent(c, contentTypeId);

    const records = await c
      .get("db")
      .select({
        field: core_ai_translation_sources.field,
        locale: core_ai_translation_sources.locale,
        origin: core_ai_translation_sources.origin,
        sourceFingerprint: core_ai_translation_sources.sourceFingerprint,
        sourceLocale: core_ai_translation_sources.sourceLocale,
        targetFingerprint: core_ai_translation_sources.targetFingerprint,
        updatedAt: core_ai_translation_sources.updatedAt,
      })
      .from(core_ai_translation_sources)
      .where(
        and(
          eq(core_ai_translation_sources.contentTypeId, contentTypeId),
          eq(core_ai_translation_sources.itemId, itemId),
        ),
      );

    return c.json({ records }, 200);
  },
});

export const saveTranslationSourcesAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "put",
    description:
      "Record what translated fields were made from - after an AI translation was saved, or when a person confirms a translation matches its source.",
    path: "/translation-sources",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              contentTypeId: z.string().min(1).max(255),
              fields: z
                .array(
                  z.object({
                    field: z.string().min(1).max(255),
                    origin: z.enum(["ai", "human"]),
                    sourceFingerprint: z.string().min(1).max(64),
                    targetFingerprint: z.string().min(1).max(64),
                  }),
                )
                .min(1)
                .max(100),
              itemId: z.number().int().positive(),
              locale: z.string().min(2).max(32),
              sourceLocale: z.string().min(2).max(32),
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
    },
  },
  handler: async c => {
    const { contentTypeId, fields, itemId, locale, sourceLocale } =
      c.req.valid("json");
    await assertCanEditContent(c, contentTypeId);

    const updatedById = c.get("admin")?.user.id ?? null;
    for (const entry of fields) {
      const values = {
        origin: entry.origin,
        sourceFingerprint: entry.sourceFingerprint,
        sourceLocale,
        targetFingerprint: entry.targetFingerprint,
        updatedById,
      };
      await c
        .get("db")
        .insert(core_ai_translation_sources)
        .values({
          ...values,
          contentTypeId,
          field: entry.field,
          itemId,
          locale,
        })
        .onConflictDoUpdate({
          set: { ...values, updatedAt: new Date() },
          target: [
            core_ai_translation_sources.contentTypeId,
            core_ai_translation_sources.itemId,
            core_ai_translation_sources.locale,
            core_ai_translation_sources.field,
          ],
        });
    }

    return c.json({ ok: true as const }, 200);
  },
});
