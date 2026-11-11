import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { contentAnyIdSchema } from "@/content/ids";
import { core_ai_translation_sources } from "@/database/ai";

import { assertCanEditContentItem } from "../lib/assert-can-edit-content-item";

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
  route: {
    method: "get",
    description:
      "What each translated field of an item was translated from, to tell which fields are outdated.",
    path: "/translation-sources",
    request: {
      query: z.object({
        contentTypeId: z.string().min(1).max(255),
        itemId: contentAnyIdSchema,
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
    const { contentTypeId, itemId: requestedItemId } = c.req.valid("query");
    const itemId = await assertCanEditContentItem(
      c,
      contentTypeId,
      requestedItemId,
    );

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
