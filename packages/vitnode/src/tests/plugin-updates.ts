import type {
  AdminComponentUpdate,
  AdminPluginUpdates,
} from "@/views/admin/views/core/system/plugins/plugin-updates-query";
import type { AdminInstalledPlugin } from "@/views/admin/views/core/system/plugins/plugins-query";

type UpdateResult = NonNullable<AdminComponentUpdate["result"]>;

export const securityFinding = (
  fixed: null | string,
): UpdateResult["securityUpdates"][number] => ({
  affected: "<9.9.9",
  fixed,
  id: `ACME-${fixed ?? "none"}`,
  url: "https://acme.example.com/advisories/1",
  versions: ["1.0.0"],
});

export const componentUpdate = (
  id: string,
  result: null | Partial<UpdateResult> = {},
): AdminComponentUpdate => ({
  id,
  lastAttemptAt: "2026-10-15T03:00:00.000Z",
  lastError: null,
  lastSuccessAt: "2026-10-15T03:00:00.000Z",
  result:
    result === null
      ? null
      : {
          alternative: null,
          channel: "stable",
          compatibility: "compatible",
          latest: {
            publishedAt: null,
            requiresCore: null,
            url: null,
            version: "1.1.0",
          },
          securityUpdates: [],
          status: "update_available",
          ...result,
        },
  sourceUrl: "https://acme.example.com/updates.json",
  stale: false,
  state: "checked",
});

export const pluginUpdates = (
  core: AdminComponentUpdate,
  plugins: AdminComponentUpdate[] = [],
): AdminPluginUpdates => ({
  channelOverride: null,
  core,
  enabled: true,
  lastManualAt: null,
  manualCooldownSeconds: 0,
  plugins,
  running: false,
});

export const installedPlugin = (
  id: string,
  title: string,
): AdminInstalledPlugin => ({
  author: null,
  description: null,
  icon: null,
  id,
  license: null,
  registrations: { api: null, frontend: null },
  title,
  version: "1.0.0",
  versionMismatch: false,
});
