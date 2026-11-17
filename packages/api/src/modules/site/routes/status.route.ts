import { buildRoute } from "@/builders";
import { setPageCacheTags } from "@/lib/page-cache";
import { SITE_STATUS_PAGE_CACHE_TAG, zodSiteStatus } from "@/lib/site-status";
import { loadSiteStatus } from "@/lib/site-status.server";

export const siteStatusRoute = buildRoute({
  allowWhenOffline: true,
  route: {
    method: "get",
    description:
      "Whether the public site is online. While it is offline, also the reason per language and the planned opening time.",
    path: "/status",
    responses: {
      200: {
        content: { "application/json": { schema: zodSiteStatus } },
        description: "Site status",
      },
    },
  },
  handler: async c => {
    const status = await loadSiteStatus(c);
    setPageCacheTags(c, [SITE_STATUS_PAGE_CACHE_TAG]);

    if (!status.offline) {
      return c.json(
        {
          message: [],
          offline: false,
          opensAt: null,
          serverNow: new Date().toISOString(),
          showCountdown: false,
        },
        200,
      );
    }

    return c.json(
      {
        message: status.message,
        offline: true,
        opensAt: status.opensAt,
        serverNow: new Date().toISOString(),
        showCountdown: status.showCountdown && status.opensAt !== null,
      },
      200,
    );
  },
});
