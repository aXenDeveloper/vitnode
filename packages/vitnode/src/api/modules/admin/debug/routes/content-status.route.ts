import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { contentEngineDiagnostics } from "@/content/server/diagnostics";

const localeDriftSchema = z.object({
  /** Documents `core_search_index` holds for this locale. */
  canonicalIndexed: z.number(),
  canonicalHealthy: z.boolean(),
  /** Published rows - or published translations - the database holds. */
  expected: z.number(),
  /** `""` for a content type that is not localized. */
  locale: z.string(),
  /** `null` when the provider offers no diagnostics - unverified, not healthy. */
  providerHealthy: z.boolean().nullable(),
  providerIndexed: z.number().nullable(),
});

const contentTypeSchema = z.object({
  contentTypeId: z.string(),
  features: z.object({
    editorial: z.boolean(),
    localization: z.boolean(),
    publicApi: z.boolean(),
    publication: z.boolean(),
    scheduling: z.boolean(),
    search: z.boolean(),
  }),
  pluginId: z.string(),
  /** `null` for a content type without `search`. */
  search: z
    .object({
      canonicalHealthy: z.boolean(),
      /** Documents `core_search_index` holds, every locale. */
      canonicalIndexedTotal: z.number(),
      contentTypeId: z.string(),
      /** Published rows - or translations - the database holds, every locale. */
      expectedTotal: z.number(),
      /** Canonical **and** provider both agree. Unverified is not healthy. */
      healthy: z.boolean(),
      locales: z.array(localeDriftSchema),
      provider: z.object({
        /** Why the provider could not be counted, when that is the answer. */
        error: z.string().optional(),
        healthy: z.boolean().nullable(),

        indexedTotal: z.number().nullable(),
        name: z.string(),
        /** Whether the provider was actually asked. */
        verified: z.boolean(),
      }),
    })
    .nullable(),
  /** `null` for a content type without scheduling. */
  schedules: z
    .object({
      /** Transitions that committed but were never announced. */
      failedEffects: z.number(),
      pending: z.number(),
      withErrors: z.number(),
    })
    .nullable(),
});

export const contentStatusDebugAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "system", permission: "can_view" },
  route: {
    method: "get",
    description:
      "Report every registered content type, its search index drift per locale, and its outstanding scheduled-effect failures.",
    path: "/content/status",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              contentTypes: z.array(contentTypeSchema),
              /** No scheduled transition committed without being announced. */
              effectsHealthy: z.boolean(),
              /** `searchHealthy && effectsHealthy`. */
              healthy: z.boolean(),
              searchHealthy: z.boolean(),
            }),
          },
        },
        description: "Content Engine status",
      },
    },
  },
  handler: async c => c.json(await contentEngineDiagnostics(c)),
});
