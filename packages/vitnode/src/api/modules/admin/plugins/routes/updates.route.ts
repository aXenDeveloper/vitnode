import { buildRoute } from "@/api/builders";
import { MANUAL_UPDATE_CHECK_COOLDOWN_MS } from "@/api/lib/updates/lock";
import { loadUpdatesOverview } from "@/api/lib/updates/status";

import {
  serializeComponentUpdate,
  updatesOverviewSchema,
} from "./updates.schema";

export const pluginUpdatesAdminRoute = buildRoute({
  adminStaffPermission: { module: "plugins", permission: "can_view" },
  route: {
    method: "get",
    description:
      "Stored update and security-advisory results for core and every installed plugin. Never contacts a publisher.",
    path: "/updates",
    responses: {
      200: {
        content: { "application/json": { schema: updatesOverviewSchema } },
        description: "Update status",
      },
      403: { description: "Access Denied" },
    },
  },
  handler: async c => {
    const { channelOverride, components, coreVersion, enabled } =
      c.get("core").updates;
    const overview = await loadUpdatesOverview({
      channelOverride,
      components,
      coreVersion,
      db: c.get("db"),
      enabled,
    });
    const [core, ...plugins] = overview.components.map(
      serializeComponentUpdate,
    );
    if (core === undefined) throw new Error("The core component is missing");

    return c.json(
      {
        channelOverride: overview.channelOverride,
        core,
        enabled: overview.enabled,
        lastManualAt: overview.lastManualAt?.toISOString() ?? null,
        manualCooldownSeconds: MANUAL_UPDATE_CHECK_COOLDOWN_MS / 1000,
        plugins,
        running: overview.running,
      },
      200,
    );
  },
});
