import { buildRoute } from "@/api/builders";
import {
  loadUpdatesOverview,
  summarizeUpdates,
} from "@/api/lib/updates/status";

import { iso, updatesSummarySchema } from "./updates.schema";

export const pluginUpdatesSummaryAdminRoute = buildRoute({
  adminStaffPermission: { module: "plugins", permission: "can_view" },
  route: {
    method: "get",
    description:
      "Counts behind the AdminCP update badge, security pill and dashboard widget, from stored results only. Never contacts a publisher or starts a check.",
    path: "/updates/summary",
    responses: {
      200: {
        content: { "application/json": { schema: updatesSummarySchema } },
        description: "Update summary",
      },
      403: { description: "Access Denied" },
    },
  },
  handler: async c => {
    const { channelOverride, components, coreVersion, enabled } =
      c.get("core").updates;
    const summary = summarizeUpdates(
      await loadUpdatesOverview({
        channelOverride,
        components,
        coreVersion,
        db: c.get("db"),
        enabled,
      }),
    );

    return c.json(
      {
        ...summary,
        core: { ...summary.core, version: coreVersion },
        lastAttemptAt: iso(summary.lastAttemptAt),
        oldestSuccessAt: iso(summary.oldestSuccessAt),
      },
      200,
    );
  },
});
