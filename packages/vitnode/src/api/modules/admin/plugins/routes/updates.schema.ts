import { z } from "zod";

import type { ComponentUpdateState } from "@/api/lib/updates/status";

import { UPDATE_CHANNELS } from "@/lib/updates/manifest";

const releaseSchema = z.object({
  version: z.string(),
  publishedAt: z.string().nullable(),
  requiresCore: z.string().nullable(),
  url: z.string().nullable(),
});

export const componentUpdateSchema = z.object({
  id: z.string(),
  sourceUrl: z.string().nullable(),
  state: z.enum(["checked", "not_checked", "unavailable"]),
  stale: z.boolean(),
  lastAttemptAt: z.string().nullable(),
  lastSuccessAt: z.string().nullable(),
  lastError: z
    .object({ code: z.string(), detail: z.string().nullable() })
    .nullable(),
  result: z
    .object({
      status: z.enum([
        "package_missing",
        "channel_missing",
        "unknown_channel",
        "up_to_date",
        "update_available",
        "version_unknown",
      ]),
      channel: z.enum(UPDATE_CHANNELS).nullable(),
      latest: releaseSchema.nullable(),
      compatibility: z
        .enum(["compatible", "incompatible", "unknown"])
        .nullable(),
      alternative: releaseSchema.nullable(),
      securityUpdates: z.array(
        z.object({
          id: z.string(),
          affected: z.string(),
          fixed: z.string().nullable(),
          url: z.string(),
          versions: z.array(z.string()),
        }),
      ),
    })
    .nullable(),
});

export const updatesOverviewSchema = z.object({
  enabled: z.boolean(),
  channelOverride: z.enum(UPDATE_CHANNELS).nullable(),
  running: z.boolean(),
  lastManualAt: z.string().nullable(),
  manualCooldownSeconds: z.number(),
  core: componentUpdateSchema,
  plugins: z.array(componentUpdateSchema),
});

export const iso = (date: Date | null): null | string =>
  date?.toISOString() ?? null;

export const serializeComponentUpdate = (
  state: ComponentUpdateState,
): z.infer<typeof componentUpdateSchema> => ({
  ...state,
  lastAttemptAt: iso(state.lastAttemptAt),
  lastSuccessAt: iso(state.lastSuccessAt),
});

export const updatesSummarySchema = z.object({
  enabled: z.boolean(),
  running: z.boolean(),
  totalComponents: z.number(),
  checkedComponents: z.number(),
  updatesAvailable: z.number(),
  pluginUpdatesAvailable: z.number(),
  affectedComponents: z.number(),
  unconfirmedComponents: z.number(),
  notCheckedComponents: z.number(),
  failedComponents: z.number(),
  stale: z.boolean(),
  oldestSuccessAt: z.string().nullable(),
  lastAttemptAt: z.string().nullable(),
  core: z.object({
    version: z.string().nullable(),
    latestVersion: z.string().nullable(),
  }),
});
