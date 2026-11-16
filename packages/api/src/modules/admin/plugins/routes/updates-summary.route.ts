import { buildRoute } from "@/builders";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { loadUpdatesOverview, summarizeUpdates } from "@/lib/updates/status";

import { iso } from "../lib/serialize-update";
import { updatesSummarySchema } from "../updates.schema";

export const pluginUpdatesSummaryAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.plugins.canView,
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
