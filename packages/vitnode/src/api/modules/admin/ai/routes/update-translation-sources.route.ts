import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { contentAnyIdSchema } from "@/content/ids";
import { core_ai_translation_sources } from "@/database/ai";

import { assertCanEditContentItem } from "../lib/assert-can-edit-content-item";

export const saveTranslationSourcesAdminRoute = buildRoute({
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
              itemId: contentAnyIdSchema,
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
    const {
      contentTypeId,
      fields,
      itemId: requestedItemId,
      locale,
      sourceLocale,
    } = c.req.valid("json");
    const itemId = await assertCanEditContentItem(
      c,
      contentTypeId,
      requestedItemId,
    );

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
